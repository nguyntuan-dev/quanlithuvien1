from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import DatTruoc, TaiLieu, DocGia
from routers.auth import get_current_nhan_vien, get_current_principal
from schemas import DatTruocCreate, DatTruocOut
import uuid

router = APIRouter()


@router.get("/", response_model=List[DatTruocOut])
def danh_sach(
    ma_doc_gia: str = None,
    db: Session = Depends(get_db),
    principal=Depends(get_current_principal),
):
    kind, account = principal
    if kind == "doc_gia":
        if ma_doc_gia and ma_doc_gia != account.ma_doc_gia:
            raise HTTPException(403, "Khong co quyen xem dat truoc cua doc gia khac")
        ma_doc_gia = account.ma_doc_gia

    query = db.query(DatTruoc).options(
        joinedload(DatTruoc.doc_gia),
        joinedload(DatTruoc.tai_lieu),
    )
    if ma_doc_gia:
        query = query.filter(DatTruoc.ma_doc_gia == ma_doc_gia)
    return query.order_by(DatTruoc.ngay_dat.desc()).all()


@router.post("/", response_model=DatTruocOut, status_code=201)
def dat_truoc(
    req: DatTruocCreate,
    db: Session = Depends(get_db),
    principal=Depends(get_current_principal),
):
    kind, account = principal
    ma_doc_gia = account.ma_doc_gia if kind == "doc_gia" else req.ma_doc_gia
    if kind == "doc_gia" and req.ma_doc_gia != account.ma_doc_gia:
        raise HTTPException(403, "Khong co quyen dat truoc cho doc gia khac")
    if not db.query(DocGia).filter(DocGia.ma_doc_gia == ma_doc_gia).first():
        raise HTTPException(404, "Khong tim thay doc gia")
    if not db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == req.ma_tai_lieu).first():
        raise HTTPException(404, "Khong tim thay tai lieu")

    ma = "DT-" + uuid.uuid4().hex[:8].upper()
    dt = DatTruoc(ma_dat_truoc=ma, ma_doc_gia=ma_doc_gia, ma_tai_lieu=req.ma_tai_lieu)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return db.query(DatTruoc).options(
        joinedload(DatTruoc.doc_gia), joinedload(DatTruoc.tai_lieu)
    ).filter(DatTruoc.ma_dat_truoc == ma).first()


@router.put("/{ma}/duyet", response_model=DatTruocOut)
def duyet_dat_truoc(
    ma: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_nhan_vien),
):
    dt = db.query(DatTruoc).filter(DatTruoc.ma_dat_truoc == ma).first()
    if not dt:
        raise HTTPException(404, "Khong tim thay dat truoc")
    dt.trang_thai = "da_duyet"
    db.commit()
    db.refresh(dt)
    return dt


@router.put("/{ma}/huy", response_model=DatTruocOut)
def huy_dat_truoc(
    ma: str,
    db: Session = Depends(get_db),
    principal=Depends(get_current_principal),
):
    kind, account = principal
    dt = db.query(DatTruoc).filter(DatTruoc.ma_dat_truoc == ma).first()
    if not dt:
        raise HTTPException(404, "Khong tim thay dat truoc")
    if kind == "doc_gia" and dt.ma_doc_gia != account.ma_doc_gia:
        raise HTTPException(403, "Khong co quyen huy dat truoc cua doc gia khac")
    dt.trang_thai = "da_huy"
    db.commit()
    db.refresh(dt)
    return dt
