# backend/routers/vi_pham.py
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
import hmac
import json
import os
import re
from typing import Any, Dict, List, Optional
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import uuid
import zlib

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    AuditLog,
    CauHinhHeThong,
    ChiTietPhieuMuon,
    PhieuMuon,
    TrangThaiPhat,
    ViPhamPhat,
)
from schemas import (
    GiaoDichThanhToanOut,
    ThanhToanPhatStatusOut,
    ViPhamCreate,
    ViPhamOut,
    VietQRThanhToanOut,
)
from services.automation import (
    BROKEN_BOOK_COEFFICIENT,
    LOST_BOOK_COEFFICIENT,
    unlock_reader_card_if_paid,
)

router = APIRouter(prefix="/vi-pham", tags=["ViPham"])

DEFAULT_VIETQR_BANK = "MB"
DEFAULT_VIETQR_ACCOUNT_NO = "0355692135"
DEFAULT_VIETQR_ACCOUNT_NAME = "THU VIEN"
DEFAULT_VIETQR_TEMPLATE = "compact2"
PAYOS_API_URL = "https://api-merchant.payos.vn/v2/payment-requests"
FINE_CODE_RE = re.compile(r"\bVP-[A-Z0-9-]{3,30}\b", re.IGNORECASE)


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFD", value or "")
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return value.lower()


def should_use_book_price(reason: str) -> bool:
    reason = normalize_text(reason)
    return "mat" in reason or "hong" in reason or "rach" in reason


def fine_by_borrowed_book_price(pm: PhieuMuon, coefficient: float = 1.0) -> int:
    total = 0
    for ct in pm.chi_tiet:
        if ct.tai_lieu:
            total += int(float(ct.tai_lieu.gia or 0) * coefficient) * int(ct.so_luong or 1)
    return total


def get_setting(db: Session, key: str, env_key: str, default: str = "") -> str:
    row = db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == key).first()
    value = row.gia_tri if row and str(row.gia_tri).strip() else os.getenv(env_key, default)
    return str(value or "").strip()


def build_vietqr_url(bank: str, account_no: str, template: str, amount: int, info: str, account_name: str) -> str:
    params = urlencode({
        "amount": amount,
        "addInfo": info,
        "accountName": account_name,
    })
    return f"https://img.vietqr.io/image/{bank}-{account_no}-{template}.png?{params}"


def fine_order_code(ma_phat: str) -> int:
    return zlib.crc32((ma_phat or "").encode("utf-8")) & 0x7FFFFFFF


def payos_signature(data: Dict[str, Any], checksum_key: str) -> str:
    raw = "&".join(f"{key}={data[key]}" for key in sorted(data))
    return hmac.new(checksum_key.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_payos_webhook_signature(db: Session, payload: Dict[str, Any]) -> bool:
    checksum_key = get_setting(db, "payos_checksum_key", "PAYOS_CHECKSUM_KEY", "")
    data = payload.get("data")
    signature = payload.get("signature")
    if not checksum_key or not isinstance(data, dict) or not signature:
        return False
    expected = payos_signature(data, checksum_key)
    return hmac.compare_digest(str(signature), expected)


def payos_qr_image_url(qr_code: str) -> str:
    return "https://api.qrserver.com/v1/create-qr-code/?" + urlencode({
        "size": "260x260",
        "data": qr_code,
    })


def call_payos(method: str, url: str, client_id: str, api_key: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-client-id": client_id,
            "x-api-key": api_key,
        },
        method=method,
    )
    try:
        with urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=body or str(exc)) from exc
    except URLError as exc:
        raise HTTPException(status_code=400, detail=f"Không kết nối được PayOS: {exc.reason}") from exc


def create_payos_payment_link(db: Session, vp: ViPhamPhat, amount: int, info: str) -> Optional[Dict[str, Any]]:
    client_id = get_setting(db, "payos_client_id", "PAYOS_CLIENT_ID", "")
    api_key = get_setting(db, "payos_api_key", "PAYOS_API_KEY", "")
    checksum_key = get_setting(db, "payos_checksum_key", "PAYOS_CHECKSUM_KEY", "")
    if not client_id or not api_key or not checksum_key:
        return None

    base_url = get_setting(db, "payos_return_url", "PAYOS_RETURN_URL", "https://quanlithuvien1-production.up.railway.app")
    order_code = fine_order_code(vp.ma_phat)
    description = f"PHAT{order_code % 100000}"
    existing = call_payos("GET", f"{PAYOS_API_URL}/{order_code}", client_id, api_key)
    if existing.get("code") == "00" and existing.get("data"):
        data = existing["data"]
        if str(data.get("status") or "").upper() == "PAID":
            mark_fine_paid(db, vp, "payos", f"orderCode={order_code}; status=PAID")
            db.commit()
        data["orderCode"] = order_code
        data["description"] = data.get("description") or description
        data["noi_dung"] = info
        return data

    signed_data = {
        "amount": amount,
        "cancelUrl": base_url,
        "description": description,
        "orderCode": order_code,
        "returnUrl": base_url,
    }
    payload = {
        **signed_data,
        "items": [{
            "name": f"Tiền phạt {vp.ma_phat}",
            "quantity": 1,
            "price": amount,
        }],
        "signature": payos_signature(signed_data, checksum_key),
    }
    result = call_payos("POST", PAYOS_API_URL, client_id, api_key, payload)
    if result.get("code") != "00":
        raise HTTPException(status_code=400, detail=result.get("desc") or "Không tạo được link thanh toán PayOS")
    data = result.get("data") or {}
    data["orderCode"] = order_code
    data["description"] = description
    data["noi_dung"] = info
    return data


def flatten_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    flat = {}
    stack = [payload]
    while stack:
        current = stack.pop()
        if not isinstance(current, dict):
            continue
        for key, value in current.items():
            flat[str(key)] = value
            if isinstance(value, dict):
                stack.append(value)
    return flat


def extract_payment_content(flat: Dict[str, Any]) -> str:
    content_keys = (
        "ma_phat",
        "description",
        "content",
        "transferContent",
        "addInfo",
        "remark",
        "transaction_content",
        "noi_dung",
    )
    parts = [str(flat.get(key) or "") for key in content_keys]
    return " ".join(part for part in parts if part).strip()


def extract_fine_code(content: str) -> Optional[str]:
    match = FINE_CODE_RE.search(content or "")
    return match.group(0).upper() if match else None


def find_fine_by_order_code(db: Session, order_code: Any) -> Optional[ViPhamPhat]:
    try:
        expected = int(order_code)
    except (TypeError, ValueError):
        return None
    fines = db.query(ViPhamPhat).options(
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.doc_gia),
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.chi_tiet),
    ).filter(ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN).all()
    for fine in fines:
        if fine_order_code(fine.ma_phat) == expected:
            return fine
    return None


def parse_amount(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).strip()
    if not text:
        return None
    cleaned = re.sub(r"[^\d,.\-]", "", text)
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "." in cleaned and len(cleaned.rsplit(".", 1)[-1]) == 3:
        cleaned = cleaned.replace(".", "")
    elif "," in cleaned:
        if len(cleaned.rsplit(",", 1)[-1]) == 3:
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(",", ".")
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def extract_payment_amount(flat: Dict[str, Any]) -> Optional[Decimal]:
    amount_keys = (
        "amount",
        "transferAmount",
        "creditAmount",
        "money",
        "value",
        "so_tien",
        "gia_tri",
    )
    for key in amount_keys:
        amount = parse_amount(flat.get(key))
        if amount is not None:
            return amount
    return None


def is_incoming_payment(flat: Dict[str, Any]) -> bool:
    text = " ".join(
        str(flat.get(key) or "")
        for key in ("type", "transactionType", "direction", "status", "payment_status")
    ).lower()
    if any(word in text for word in ("out", "debit", "withdraw", "chi", "failed", "cancel")):
        return False
    return True


def fix_empty_book_codes(vp: ViPhamPhat) -> None:
    if not vp.phieu_muon:
        return
    for ct in vp.phieu_muon.chi_tiet:
        if ct.ma_tai_lieu is None:
            ct.ma_tai_lieu = ""


def mark_fine_paid(db: Session, vp: ViPhamPhat, actor: str, detail: str = "") -> bool:
    if vp.trang_thai_thanh_toan == TrangThaiPhat.DA_THANH_TOAN:
        return False
    vp.trang_thai_thanh_toan = TrangThaiPhat.DA_THANH_TOAN
    vp.ngay_thanh_toan = datetime.now()
    unlock_reader_card_if_paid(db, vp.phieu_muon.doc_gia if vp.phieu_muon else None)
    db.add(AuditLog(
        hanh_dong="xac_nhan_thanh_toan_phat",
        doi_tuong="vi_pham_phat",
        ma_doi_tuong=vp.ma_phat,
        nguoi_thuc_hien=actor,
        chi_tiet=detail,
    ))
    return True


@router.get("/", response_model=List[ViPhamOut])
def danh_sach(
    trang_thai: Optional[str] = None,
    ma_doc_gia: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ViPhamPhat).join(ViPhamPhat.phieu_muon).options(
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.doc_gia),
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
    )
    if trang_thai:
        q = q.filter(ViPhamPhat.trang_thai_thanh_toan == trang_thai)
    if ma_doc_gia:
        q = q.filter(PhieuMuon.ma_doc_gia == ma_doc_gia)

    results = q.order_by(ViPhamPhat.ngay_phat.desc()).all()
    for vp in results:
        fix_empty_book_codes(vp)
    return results


@router.post("/", response_model=ViPhamOut, status_code=201)
def tao_vi_pham(req: ViPhamCreate, db: Session = Depends(get_db)):
    pm = db.query(PhieuMuon).options(
        joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu)
    ).filter(PhieuMuon.ma_phieu_muon == req.ma_phieu_muon).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu mượn")

    reason_norm = normalize_text(req.ly_do_phat)
    is_book_loss_or_damage = "mat" in reason_norm or "hong" in reason_norm or "rach" in reason_norm

    if "mat" in reason_norm:
        so_tien = fine_by_borrowed_book_price(pm, LOST_BOOK_COEFFICIENT)
    elif "hong" in reason_norm or "rach" in reason_norm:
        so_tien = fine_by_borrowed_book_price(pm, BROKEN_BOOK_COEFFICIENT)
    else:
        so_tien = req.so_tien

    if is_book_loss_or_damage and so_tien <= 0:
        raise HTTPException(status_code=400, detail="Chưa có giá sách để tính phạt mất/hỏng")

    ma = "VP-" + uuid.uuid4().hex[:8].upper()
    vp = ViPhamPhat(
        ma_phat=ma,
        ly_do_phat=req.ly_do_phat,
        so_tien=so_tien,
        ma_phieu_muon=req.ma_phieu_muon,
        trang_thai_thanh_toan=TrangThaiPhat.CHUA_THANH_TOAN,
    )

    db.add(vp)
    db.commit()
    db.refresh(vp)

    for ct in pm.chi_tiet:
        if ct.ma_tai_lieu is None:
            ct.ma_tai_lieu = ""

    return vp


@router.get("/{ma}/vietqr", response_model=VietQRThanhToanOut)
def lay_vietqr(ma: str, db: Session = Depends(get_db)):
    vp = db.query(ViPhamPhat).filter(ViPhamPhat.ma_phat == ma).first()
    if not vp:
        raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")
    if vp.trang_thai_thanh_toan == TrangThaiPhat.DA_THANH_TOAN:
        raise HTTPException(status_code=400, detail="Vi phạm này đã thanh toán")

    bank = get_setting(db, "vietqr_ngan_hang", "VIETQR_BANK", DEFAULT_VIETQR_BANK)
    account_no = get_setting(db, "vietqr_so_tai_khoan", "VIETQR_ACCOUNT_NO", DEFAULT_VIETQR_ACCOUNT_NO)
    account_name = get_setting(db, "vietqr_ten_tai_khoan", "VIETQR_ACCOUNT_NAME", DEFAULT_VIETQR_ACCOUNT_NAME)
    template = get_setting(db, "vietqr_mau_qr", "VIETQR_TEMPLATE", DEFAULT_VIETQR_TEMPLATE)
    if not bank or not account_no:
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình ngân hàng hoặc số tài khoản VietQR trong Hệ thống",
        )

    amount = int(float(vp.so_tien or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phạt không hợp lệ")

    info = f"THANH TOAN PHAT {vp.ma_phat}"
    payos_data = create_payos_payment_link(db, vp, amount, info)
    if payos_data:
        qr_code = str(payos_data.get("qrCode") or "")
        return VietQRThanhToanOut(
            ma_phat=vp.ma_phat,
            so_tien=amount,
            noi_dung=payos_data.get("description") or info,
            qr_url=payos_qr_image_url(qr_code) if qr_code else build_vietqr_url(bank, account_no, template, amount, info, account_name),
            ngan_hang=str(payos_data.get("bin") or bank),
            so_tai_khoan=str(payos_data.get("accountNumber") or account_no),
            ten_tai_khoan=str(payos_data.get("accountName") or account_name),
            provider="payos",
            checkout_url=payos_data.get("checkoutUrl"),
            order_code=payos_data.get("orderCode"),
        )

    return VietQRThanhToanOut(
        ma_phat=vp.ma_phat,
        so_tien=amount,
        noi_dung=info,
        qr_url=build_vietqr_url(bank, account_no, template, amount, info, account_name),
        ngan_hang=bank,
        so_tai_khoan=account_no,
        ten_tai_khoan=account_name,
        provider="vietqr",
    )


@router.get("/{ma}/thanh-toan/status", response_model=ThanhToanPhatStatusOut)
def trang_thai_thanh_toan(ma: str, db: Session = Depends(get_db)):
    vp = db.query(ViPhamPhat).filter(ViPhamPhat.ma_phat == ma).first()
    if not vp:
        raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")
    return ThanhToanPhatStatusOut(
        ma_phat=vp.ma_phat,
        trang_thai_thanh_toan=vp.trang_thai_thanh_toan,
        ngay_thanh_toan=vp.ngay_thanh_toan,
    )


@router.post("/thanh-toan/webhook", response_model=GiaoDichThanhToanOut)
def webhook_thanh_toan(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    x_webhook_token: Optional[str] = Header(default=None),
):
    expected_token = get_setting(db, "vietqr_webhook_token", "VIETQR_WEBHOOK_TOKEN", "")
    payos_signature_ok = verify_payos_webhook_signature(db, payload)
    if expected_token and x_webhook_token != expected_token and not payos_signature_ok:
        raise HTTPException(status_code=401, detail="Webhook token không hợp lệ")

    if payload.get("success") is False or payload.get("code") not in (None, "00"):
        return GiaoDichThanhToanOut(
            matched=False,
            confirmed=False,
            message=payload.get("desc") or "Giao dịch không thành công",
        )

    flat = flatten_payload(payload)
    content = extract_payment_content(flat)
    ma_phat = extract_fine_code(content)
    vp = None
    if ma_phat:
        vp = db.query(ViPhamPhat).options(
            joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.doc_gia),
            joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.chi_tiet),
        ).filter(ViPhamPhat.ma_phat == ma_phat).first()
    if not vp:
        vp = find_fine_by_order_code(db, flat.get("orderCode"))
        if vp:
            ma_phat = vp.ma_phat

    if not ma_phat:
        return GiaoDichThanhToanOut(
            matched=False,
            confirmed=False,
            message="Không tìm thấy mã phạt hoặc orderCode trong giao dịch",
        )

    if not vp:
        return GiaoDichThanhToanOut(
            matched=False,
            confirmed=False,
            ma_phat=ma_phat,
            message="Mã phạt không tồn tại",
        )

    if vp.trang_thai_thanh_toan == TrangThaiPhat.DA_THANH_TOAN:
        return GiaoDichThanhToanOut(
            matched=True,
            confirmed=True,
            ma_phat=vp.ma_phat,
            message="Vi phạm đã được xác nhận thanh toán trước đó",
        )

    if not is_incoming_payment(flat):
        return GiaoDichThanhToanOut(
            matched=True,
            confirmed=False,
            ma_phat=vp.ma_phat,
            message="Giao dịch không phải tiền vào",
        )

    amount = extract_payment_amount(flat)
    required_amount = Decimal(vp.so_tien or 0)
    if amount is None or amount < required_amount:
        return GiaoDichThanhToanOut(
            matched=True,
            confirmed=False,
            ma_phat=vp.ma_phat,
            message="Số tiền giao dịch chưa đủ để thanh toán phạt",
        )

    mark_fine_paid(
        db,
        vp,
        "webhook",
        f"amount={amount}; required={required_amount}; content={content[:180]}",
    )
    db.commit()
    return GiaoDichThanhToanOut(
        matched=True,
        confirmed=True,
        ma_phat=vp.ma_phat,
        message="Đã tự động xác nhận thanh toán phạt",
    )


@router.put("/{ma}/thanh-toan", response_model=ViPhamOut)
def thanh_toan(ma: str, db: Session = Depends(get_db)):
    vp = db.query(ViPhamPhat).options(
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.doc_gia),
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.chi_tiet),
    ).filter(ViPhamPhat.ma_phat == ma).first()
    if not vp:
        raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")

    mark_fine_paid(db, vp, "staff", "manual confirmation")
    db.commit()
    db.refresh(vp)
    fix_empty_book_codes(vp)

    return vp
