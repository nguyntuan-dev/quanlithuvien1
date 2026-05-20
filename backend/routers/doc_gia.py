from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import date
from database import get_db
from models import DocGia, TheThuvien, TrangThaiThe
from routers.auth import get_current_nhan_vien
from schemas import DocGiaCreate, DocGiaUpdate, DocGiaOut
import uuid
import hashlib

router = APIRouter()

def gen_ma_dg():
    return "DG" + uuid.uuid4().hex[:6].upper()

def gen_ma_the():
    return "THE" + uuid.uuid4().hex[:6].upper()

@router.get("/", response_model=List[DocGiaOut])
def danh_sach(
    q: Optional[str] = None,
    trang_thai: Optional[TrangThaiThe] = None,
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    current=Depends(get_current_nhan_vien),
):
    query = db.query(DocGia).options(joinedload(DocGia.the_thu_vien))
    if q:
        query = query.filter(or_(
            DocGia.ho_ten.ilike(f"%{q}%"),
            DocGia.ma_doc_gia.ilike(f"%{q}%"),
            DocGia.email.ilike(f"%{q}%"),
            DocGia.so_dien_thoai.ilike(f"%{q}%"),
        ))
    if trang_thai:
        query = query.filter(DocGia.trang_thai_the == trang_thai)
    return query.offset(skip).limit(limit).all()

@router.get("/{ma}", response_model=DocGiaOut)
def chi_tiet(ma: str, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    dg = db.query(DocGia).options(joinedload(DocGia.the_thu_vien)).filter(DocGia.ma_doc_gia == ma).first()
    if not dg:
        raise HTTPException(status_code=404, detail="Không tìm thấy độc giả")
    return dg

@router.post("/", response_model=DocGiaOut, status_code=201)
def them_moi(req: DocGiaCreate, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    ma = gen_ma_dg()
    dg = DocGia(
        ma_doc_gia=ma,
        ho_ten=req.ho_ten,
        ngay_sinh=req.ngay_sinh,
        gioi_tinh=req.gioi_tinh,
        dia_chi=req.dia_chi,
        so_dien_thoai=req.so_dien_thoai,
        email=req.email,
        mat_khau_hash=hashlib.sha256(req.mat_khau.encode()).hexdigest() if req.mat_khau else None,
    )
    db.add(dg)
    # Tạo thẻ thư viện ngay
    ngay_cap = req.ngay_cap or date.today()
    if req.ngay_het_han is None:
        from datetime import timedelta
        ngay_het_han = date(ngay_cap.year + 1, ngay_cap.month, ngay_cap.day)
    else:
        ngay_het_han = req.ngay_het_han
    the = TheThuvien(
        ma_the=gen_ma_the(),
        ngay_cap=ngay_cap,
        ngay_het_han=ngay_het_han,
        loai_the=req.loai_the,
        ma_doc_gia=ma,
    )
    db.add(the)
    db.commit(); db.refresh(dg)
    return db.query(DocGia).options(joinedload(DocGia.the_thu_vien)).filter(DocGia.ma_doc_gia == ma).first()

@router.put("/{ma}", response_model=DocGiaOut)
def cap_nhat(ma: str, req: DocGiaUpdate, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    dg = db.query(DocGia).options(joinedload(DocGia.the_thu_vien)).filter(DocGia.ma_doc_gia == ma).first()
    if not dg:
        raise HTTPException(status_code=404, detail="Không tìm thấy độc giả")
    updates = req.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(dg, k, v)
    if "trang_thai_the" in updates and dg.the_thu_vien:
        dg.the_thu_vien.trang_thai = updates["trang_thai_the"]
    db.commit(); db.refresh(dg)
    return db.query(DocGia).options(joinedload(DocGia.the_thu_vien)).filter(DocGia.ma_doc_gia == ma).first()

@router.delete("/{ma}", status_code=204)
def xoa(ma: str, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    dg = db.query(DocGia).filter(DocGia.ma_doc_gia == ma).first()
    if not dg:
        raise HTTPException(status_code=404, detail="Không tìm thấy độc giả")
    db.delete(dg); db.commit()
