from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from database import get_db
from models import TaiLieu, TacGia, TheLoai, NhaXuatBan, BanSaoTaiLieu, TrangThaiTaiLieu
from routers.auth import get_current_nhan_vien
from schemas import TaiLieuCreate, TaiLieuUpdate, TaiLieuOut, TacGiaOut, TheLoaiOut, NXBOut, BanSaoCreate, BanSaoOut
import uuid

router = APIRouter()

def gen_ma():
    return "TL" + uuid.uuid4().hex[:6].upper()

def load_one(db, ma):
    return db.query(TaiLieu).options(
        joinedload(TaiLieu.tac_gia),
        joinedload(TaiLieu.the_loai),
        joinedload(TaiLieu.nha_xuat_ban),
        joinedload(TaiLieu.ban_sao),
    ).filter(TaiLieu.ma_tai_lieu == ma).first()

# ── Meta lookups (must be before /{ma}) ──────────────────────────────────────
@router.get("/meta/tac-gia", response_model=List[TacGiaOut])
def ds_tac_gia(db: Session = Depends(get_db)):
    return db.query(TacGia).all()

@router.post("/meta/tac-gia", response_model=TacGiaOut, status_code=201)
def them_tac_gia(ten: str, ghi_chu: Optional[str] = None, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    ma = "TG" + uuid.uuid4().hex[:6].upper()
    tg = TacGia(ma_tac_gia=ma, ten_tac_gia=ten, ghi_chu=ghi_chu)
    db.add(tg); db.commit(); db.refresh(tg)
    return tg

@router.get("/meta/the-loai", response_model=List[TheLoaiOut])
def ds_the_loai(db: Session = Depends(get_db)):
    return db.query(TheLoai).all()

@router.post("/meta/the-loai", response_model=TheLoaiOut, status_code=201)
def them_the_loai(ma: str, ten: str, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    tl = TheLoai(ma_the_loai=ma, ten_the_loai=ten)
    db.add(tl); db.commit(); db.refresh(tl)
    return tl

@router.get("/meta/nha-xuat-ban", response_model=List[NXBOut])
def ds_nxb(db: Session = Depends(get_db)):
    return db.query(NhaXuatBan).all()

@router.post("/meta/nha-xuat-ban", response_model=NXBOut, status_code=201)
def them_nxb(ma: str, ten: str, dia_chi: Optional[str] = None, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    nxb = NhaXuatBan(ma_nxb=ma, ten_nxb=ten, dia_chi=dia_chi)
    db.add(nxb); db.commit(); db.refresh(nxb)
    return nxb

# ── CRUD ─────────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[TaiLieuOut])
def danh_sach(
    q: Optional[str] = None,
    the_loai: Optional[str] = None,
    tinh_trang: Optional[TrangThaiTaiLieu] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(TaiLieu).options(
        joinedload(TaiLieu.tac_gia),
        joinedload(TaiLieu.the_loai),
        joinedload(TaiLieu.nha_xuat_ban),
    ).outerjoin(TaiLieu.tac_gia).outerjoin(TaiLieu.the_loai)
    if q:
        query = query.filter(or_(
            TaiLieu.ten_tai_lieu.ilike(f"%{q}%"),
            TaiLieu.ma_tai_lieu.ilike(f"%{q}%"),
            TacGia.ten_tac_gia.ilike(f"%{q}%"),
            TheLoai.ten_the_loai.ilike(f"%{q}%"),
        ))
    if the_loai:
        query = query.filter(TaiLieu.ma_the_loai == the_loai)
    if tinh_trang:
        query = query.filter(TaiLieu.tinh_trang == tinh_trang)
    return query.offset(skip).limit(limit).all()

@router.get("/ban-sao/", response_model=List[BanSaoOut])
def ds_ban_sao(ma_tai_lieu: Optional[str] = None, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    q = db.query(BanSaoTaiLieu).options(joinedload(BanSaoTaiLieu.tai_lieu))
    if ma_tai_lieu:
        q = q.filter(BanSaoTaiLieu.ma_tai_lieu == ma_tai_lieu)
    return q.order_by(BanSaoTaiLieu.created_at.desc()).all()

@router.post("/ban-sao/", response_model=BanSaoOut, status_code=201)
def them_ban_sao(req: BanSaoCreate, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    tl = db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == req.ma_tai_lieu).first()
    if not tl:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    ma = "BS" + uuid.uuid4().hex[:8].upper()
    bs = BanSaoTaiLieu(
        ma_ban_sao=ma,
        ma_tai_lieu=req.ma_tai_lieu,
        ma_vach=req.ma_vach or ma,
        tinh_trang=req.tinh_trang,
        ghi_chu=req.ghi_chu,
    )
    tl.so_luong = (tl.so_luong or 0) + 1
    db.add(bs); db.commit(); db.refresh(bs)
    return bs

@router.delete("/ban-sao/{ma}", status_code=204)
def xoa_ban_sao(ma: str, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    bs = db.query(BanSaoTaiLieu).filter(BanSaoTaiLieu.ma_ban_sao == ma).first()
    if not bs:
        raise HTTPException(404, "Không tìm thấy bản sao")
    tl = db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == bs.ma_tai_lieu).first()
    if tl and tl.so_luong > 0:
        tl.so_luong -= 1
    db.delete(bs); db.commit()

def handle_relations(data: dict, db: Session):
    # Xử lý Tác giả
    ten_tg = data.pop("ten_tac_gia", None)
    if ten_tg and ten_tg.strip():
        ten_tg = ten_tg.strip()
        tg = db.query(TacGia).filter(TacGia.ten_tac_gia == ten_tg).first()
        if not tg:
            ma_tg = "TG" + uuid.uuid4().hex[:6].upper()
            tg = TacGia(ma_tac_gia=ma_tg, ten_tac_gia=ten_tg)
            db.add(tg); db.flush()
        data["ma_tac_gia"] = tg.ma_tac_gia
    elif ten_tg == "": # Nếu truyền tên rỗng thì xóa tác giả
        data["ma_tac_gia"] = None

    # Xử lý Nhà xuất bản
    ten_nxb = data.pop("ten_nxb", None)
    if ten_nxb and ten_nxb.strip():
        ten_nxb = ten_nxb.strip()
        nxb = db.query(NhaXuatBan).filter(NhaXuatBan.ten_nxb == ten_nxb).first()
        if not nxb:
            ma_nxb = "NXB" + uuid.uuid4().hex[:6].upper()
            nxb = NhaXuatBan(ma_nxb=ma_nxb, ten_nxb=ten_nxb)
            db.add(nxb); db.flush()
        data["ma_nxb"] = nxb.ma_nxb
    elif ten_nxb == "": # Nếu truyền tên rỗng thì xóa NXB
        data["ma_nxb"] = None
        
    # Đảm bảo các ID không phải là chuỗi rỗng
    for k in ["ma_tac_gia", "ma_nxb", "ma_the_loai"]:
        if k in data and data[k] == "":
            data[k] = None
            
    return data

@router.post("/", response_model=TaiLieuOut, status_code=201)
def them_moi(req: TaiLieuCreate, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    ma = req.ma_tai_lieu or gen_ma()
    if db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == ma).first():
        raise HTTPException(400, "Mã tài liệu đã tồn tại")
    
    data = req.model_dump(exclude={"ma_tai_lieu"})
    data = handle_relations(data, db)
    
    tl = TaiLieu(ma_tai_lieu=ma, **data)
    db.add(tl); db.commit()
    return load_one(db, ma)

@router.get("/{ma}", response_model=TaiLieuOut)
def chi_tiet(ma: str, db: Session = Depends(get_db)):
    tl = load_one(db, ma)
    if not tl:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    return tl

@router.put("/{ma}", response_model=TaiLieuOut)
def cap_nhat(ma: str, req: TaiLieuUpdate, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    tl = db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == ma).first()
    if not tl:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    
    data = req.model_dump(exclude_none=True)
    data = handle_relations(data, db)
    
    for k, v in data.items():
        setattr(tl, k, v)
    db.commit()
    return load_one(db, ma)

@router.delete("/{ma}", status_code=204)
def xoa(ma: str, db: Session = Depends(get_db), current=Depends(get_current_nhan_vien)):
    tl = db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == ma).first()
    if not tl:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    db.delete(tl); db.commit()
