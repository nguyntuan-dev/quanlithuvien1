from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import TaiLieu, DocGia, PhieuMuon, ViPhamPhat, TrangThaiPhieu, TrangThaiThe, TrangThaiPhat, DatTruoc
from routers.auth import get_current_nhan_vien
from schemas import ThongKeOut

router = APIRouter()

@router.get("/tong-quan", response_model=ThongKeOut)
def tong_quan(db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    tong_tl  = db.query(TaiLieu).count()
    dg_hl    = db.query(DocGia).filter(DocGia.trang_thai_the == TrangThaiThe.CON_HIEU_LUC).count()
    dang_muon = db.query(PhieuMuon).filter(PhieuMuon.trang_thai == TrangThaiPhieu.DANG_MUON).count()
    vp_chua  = db.query(ViPhamPhat).filter(ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN).count()
    tien_chua = db.query(func.sum(ViPhamPhat.so_tien)).filter(
        ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN
    ).scalar() or 0
    dt_cho = db.query(DatTruoc).filter(DatTruoc.trang_thai == "cho_xu_ly").count()
    return ThongKeOut(
        tong_tai_lieu=tong_tl,
        doc_gia_hoat_dong=dg_hl,
        dang_duoc_muon=dang_muon,
        vi_pham_chua_xu_ly=vp_chua,
        tong_tien_phat_chua_thu=float(tien_chua),
        dat_truoc_cho_duyet=dt_cho
    )

@router.get("/muon-theo-thang")
def muon_theo_thang(db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    # Group và Order theo date_trunc để đảm bảo thứ tự thời gian chính xác
    rows = db.query(
        func.date_trunc('month', PhieuMuon.created_at).label("thang_raw"),
        func.count().label("so_luong")
    ).group_by("thang_raw").order_by("thang_raw").all()
    
    return [
        {"thang": r.thang_raw.strftime('%m/%Y'), "so_luong": r.so_luong} 
        for r in rows if r.thang_raw
    ]

@router.get("/top-tai-lieu")
def top_tai_lieu(db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    from models import ChiTietPhieuMuon
    rows = db.query(
        TaiLieu.ten_tai_lieu,
        func.count(ChiTietPhieuMuon.id).label("luot_muon")
    ).join(ChiTietPhieuMuon, TaiLieu.ma_tai_lieu == ChiTietPhieuMuon.ma_tai_lieu)\
     .group_by(TaiLieu.ten_tai_lieu)\
     .order_by(func.count(ChiTietPhieuMuon.id).desc())\
     .limit(10).all()
    return [{"ten": r.ten_tai_lieu, "luot_muon": r.luot_muon} for r in rows]
