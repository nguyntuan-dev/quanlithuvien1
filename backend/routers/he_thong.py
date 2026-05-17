from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import get_db
from models import (
    CauHinhHeThong, AuditLog, NhanVien, TaiLieu, DocGia, PhieuMuon,
    ChiTietPhieuMuon, DatTruoc, ViPhamPhat
)
from routers.auth import require_admin
from schemas import CauHinhOut, CauHinhUpdate, AuditLogOut

router = APIRouter()

DEFAULT_SETTINGS = {
    "so_sach_toi_da": ("5", "Số sách tối đa một độc giả được mượn"),
    "so_ngay_gia_han": ("7", "Số ngày cộng thêm khi gia hạn"),
    "tien_phat_qua_han_moi_ngay": ("10000", "Tiền phạt quá hạn mỗi ngày"),
    "chinh_sach_mat_hong": ("Theo giá sách", "Cách tính phạt sách mất/hỏng"),
    "vietqr_ngan_hang": ("MB", "Mã ngân hàng VietQR, ví dụ: VCB, MB, ACB hoặc BIDV"),
    "vietqr_so_tai_khoan": ("0355692135", "Số tài khoản nhận tiền phạt"),
    "vietqr_ten_tai_khoan": ("THU VIEN", "Tên chủ tài khoản nhận tiền phạt"),
    "vietqr_mau_qr": ("compact2", "Mẫu ảnh VietQR: compact, compact2, qr_only hoặc print"),
}

def ensure_defaults(db: Session):
    for key, (value, desc) in DEFAULT_SETTINGS.items():
        if not db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == key).first():
            db.add(CauHinhHeThong(khoa=key, gia_tri=value, mo_ta=desc))
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
    db.commit(); db.refresh(row)
    return row

@router.get("/audit-log", response_model=List[AuditLogOut])
def ds_audit(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current: NhanVien = Depends(require_admin)):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

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
        raise HTTPException(400, "Dữ liệu phục hồi không hợp lệ")
    write_audit(db, "restore", "database", "json", current, "Đã nhận dữ liệu restore")
    db.commit()
    return {"message": "Đã ghi nhận yêu cầu phục hồi. Hãy kiểm tra backup trước khi ghi đè dữ liệu thật.", "tables": list(payload.keys())}
