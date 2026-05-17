from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AuditLog,
    CauHinhHeThong,
    ChiTietPhieuMuon,
    DatTruoc,
    DocGia,
    NhanVien,
    PhieuMuon,
    TaiLieu,
    ViPhamPhat,
)
from routers.auth import require_admin
from schemas import AuditLogOut, CauHinhOut, CauHinhUpdate
from services.automation import generate_operations_report, run_automation_once

router = APIRouter()

DEFAULT_SETTINGS = {
    "so_sach_toi_da": ("5", "So sach toi da mot doc gia duoc muon"),
    "so_ngay_gia_han": ("7", "So ngay cong them khi gia han"),
    "tien_phat_qua_han_moi_ngay": ("10000", "Tien phat qua han moi ngay"),
    "chinh_sach_mat_hong": ("Theo gia sach", "Cach tinh phat sach mat/hong"),
    "vietqr_ngan_hang": ("MB", "Ma ngan hang VietQR"),
    "vietqr_so_tai_khoan": ("0355692135", "So tai khoan nhan tien phat"),
    "vietqr_ten_tai_khoan": ("THU VIEN", "Ten chu tai khoan nhan tien phat"),
    "vietqr_mau_qr": ("compact2", "Mau anh VietQR"),
    "so_ngay_giu_dat_truoc": ("3", "So ngay giu sach sau khi tu dong duyet dat truoc"),
    "nguong_khoa_the_qua_han": ("30", "So ngay qua han truoc khi tu dong khoa the"),
    "nguong_khoa_the_tien_phat": ("100000", "Tong tien phat chua thu de tu dong khoa the"),
    "email_bao_cao_thu_thu": ("", "Email nhan bao cao cuoi ngay, cach nhau bang dau phay"),
}


def ensure_defaults(db: Session):
    rows = [
        {"khoa": key, "gia_tri": value, "mo_ta": desc}
        for key, (value, desc) in DEFAULT_SETTINGS.items()
    ]
    if rows:
        stmt = insert(CauHinhHeThong).values(rows).on_conflict_do_nothing(
            index_elements=[CauHinhHeThong.khoa]
        )
        db.execute(stmt)
    db.commit()


def write_audit(db: Session, action: str, target: str, target_id: str, user: NhanVien, detail: str = ""):
    db.add(AuditLog(
        hanh_dong=action,
        doi_tuong=target,
        ma_doi_tuong=target_id,
        nguoi_thuc_hien=user.email,
        chi_tiet=detail,
    ))


@router.get("/cau-hinh", response_model=List[CauHinhOut])
def ds_cau_hinh(db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    ensure_defaults(db)
    return db.query(CauHinhHeThong).order_by(CauHinhHeThong.khoa).all()


@router.put("/cau-hinh/{khoa}", response_model=CauHinhOut)
def cap_nhat_cau_hinh(
    khoa: str,
    req: CauHinhUpdate,
    db: Session = Depends(get_db),
    current: NhanVien = Depends(require_admin),
):
    ensure_defaults(db)
    row = db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == khoa).first()
    if not row:
        row = CauHinhHeThong(khoa=khoa, gia_tri=req.gia_tri, mo_ta=req.mo_ta)
        db.add(row)
    else:
        row.gia_tri = req.gia_tri
        row.mo_ta = req.mo_ta if req.mo_ta is not None else row.mo_ta
    write_audit(db, "cap_nhat_cau_hinh", "cau_hinh_he_thong", khoa, current, req.gia_tri)
    db.commit()
    db.refresh(row)
    return row


@router.get("/audit-log", response_model=List[AuditLogOut])
def ds_audit(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: NhanVien = Depends(require_admin),
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/bao-cao-van-hanh")
def bao_cao_van_hanh(db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    ensure_defaults(db)
    return generate_operations_report(db)


@router.post("/tu-dong/chay-ngay")
def chay_tu_dong_ngay(db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    result = run_automation_once()
    write_audit(db, "chay_tu_dong_thu_cong", "automation", "all", current, result["message"])
    db.commit()
    return result


def dump_rows(rows) -> List[Dict[str, Any]]:
    data = []
    for row in rows:
        item = {}
        for col in row.__table__.columns:
            value = getattr(row, col.name)
            item[col.name] = str(value) if value is not None else None
        data.append(item)
    return data


@router.get("/backup")
def backup(db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    write_audit(db, "backup", "database", "all", current)
    db.commit()
    return {
        "tai_lieu": dump_rows(db.query(TaiLieu).all()),
        "doc_gia": dump_rows(db.query(DocGia).all()),
        "phieu_muon": dump_rows(db.query(PhieuMuon).all()),
        "ct_phieu_muon": dump_rows(db.query(ChiTietPhieuMuon).all()),
        "dat_truoc": dump_rows(db.query(DatTruoc).all()),
        "vi_pham_phat": dump_rows(db.query(ViPhamPhat).all()),
        "cau_hinh_he_thong": dump_rows(db.query(CauHinhHeThong).all()),
    }


@router.post("/restore")
def restore(payload: Dict[str, Any], db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    if not isinstance(payload, dict):
        raise HTTPException(400, "Du lieu phuc hoi khong hop le")
    write_audit(db, "restore", "database", "json", current, "Da nhan du lieu restore")
    db.commit()
    return {
        "message": "Da ghi nhan yeu cau phuc hoi. Hay kiem tra backup truoc khi ghi de du lieu that.",
        "tables": list(payload.keys()),
    }
