# backend/routers/vi_pham.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db
from models import ViPhamPhat, PhieuMuon, DocGia, ChiTietPhieuMuon, TrangThaiPhat, CauHinhHeThong
from schemas import ViPhamCreate, ViPhamOut, VietQRThanhToanOut
import uuid
from datetime import datetime
import unicodedata
import os
from urllib.parse import urlencode
from services.automation import LOST_BOOK_COEFFICIENT, BROKEN_BOOK_COEFFICIENT

router = APIRouter(prefix="/vi-pham", tags=["ViPham"])

# -------------------
# Helpers
# -------------------

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
            # Tính tiền theo giá sách * hệ số * số lượng
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

# -------------------
# GET danh sách vi phạm
# -------------------

@router.get("/", response_model=List[ViPhamOut])
def danh_sach(
    trang_thai: Optional[str] = None,
    ma_doc_gia: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(ViPhamPhat).join(ViPhamPhat.phieu_muon).options(
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.doc_gia),
        joinedload(ViPhamPhat.phieu_muon).joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu)
    )
    if trang_thai:
        q = q.filter(ViPhamPhat.trang_thai_thanh_toan == trang_thai)
    if ma_doc_gia:
        q = q.filter(PhieuMuon.ma_doc_gia == ma_doc_gia)

    results = q.order_by(ViPhamPhat.ngay_phat.desc()).all()

    # Fix None -> empty string cho ma_tai_lieu để tránh ResponseValidationError
    for vp in results:
        for ct in vp.phieu_muon.chi_tiet:
            if ct.ma_tai_lieu is None:
                ct.ma_tai_lieu = ""
    return results

# -------------------
# POST tạo vi phạm mới
# -------------------

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
        trang_thai_thanh_toan=TrangThaiPhat.CHUA_THANH_TOAN
    )

    db.add(vp)
    db.commit()
    db.refresh(vp)

    # Fix None -> empty string cho ma_tai_lieu trước khi trả về
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

    bank = get_setting(db, "vietqr_ngan_hang", "VIETQR_BANK")
    account_no = get_setting(db, "vietqr_so_tai_khoan", "VIETQR_ACCOUNT_NO")
    account_name = get_setting(db, "vietqr_ten_tai_khoan", "VIETQR_ACCOUNT_NAME", "THU VIEN")
    template = get_setting(db, "vietqr_mau_qr", "VIETQR_TEMPLATE", "compact2")
    if not bank or not account_no:
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình ngân hàng hoặc số tài khoản VietQR trong Hệ thống",
        )

    amount = int(float(vp.so_tien or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phạt không hợp lệ")

    info = f"THANH TOAN PHAT {vp.ma_phat}"
    return VietQRThanhToanOut(
        ma_phat=vp.ma_phat,
        so_tien=amount,
        noi_dung=info,
        qr_url=build_vietqr_url(bank, account_no, template, amount, info, account_name),
        ngan_hang=bank,
        so_tai_khoan=account_no,
        ten_tai_khoan=account_name,
    )

# -------------------
# PUT thanh toán vi phạm
# -------------------

@router.put("/{ma}/thanh-toan", response_model=ViPhamOut)
def thanh_toan(ma: str, db: Session = Depends(get_db)):
    vp = db.query(ViPhamPhat).filter(ViPhamPhat.ma_phat == ma).first()
    if not vp:
        raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")

    vp.trang_thai_thanh_toan = TrangThaiPhat.DA_THANH_TOAN
    vp.ngay_thanh_toan = datetime.now()
    db.commit()
    db.refresh(vp)

    # Fix None -> empty string cho ma_tai_lieu trước khi trả về
    for ct in vp.phieu_muon.chi_tiet:
        if ct.ma_tai_lieu is None:
            ct.ma_tai_lieu = ""

    return vp
