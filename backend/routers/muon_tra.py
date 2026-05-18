from datetime import date, timedelta
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    ChiTietPhieuMuon,
    DatTruoc,
    DocGia,
    NhanVien,
    PhieuMuon,
    TaiLieu,
    TrangThaiPhieu,
    TrangThaiTaiLieu,
    ViPhamPhat,
)
from schemas import PhieuMuonCreate, PhieuMuonOut, TraSachRequest
from services.automation import process_reservation_queue
from services.muon_tra_validators import MuonTraValidator

router = APIRouter()


def gen_ma():
    return "PM-" + date.today().strftime("%Y%m%d") + "-" + uuid.uuid4().hex[:4].upper()


def load_phieu(db: Session, ma: str):
    phieu = db.query(PhieuMuon).options(
        joinedload(PhieuMuon.doc_gia).joinedload(DocGia.the_thu_vien),
        joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
    ).filter(PhieuMuon.ma_phieu_muon == ma).first()
    if phieu:
        for item in phieu.chi_tiet:
            if not item.ma_tai_lieu:
                item.ma_tai_lieu = ""
    return phieu


@router.get("/qua-han", response_model=List[PhieuMuonOut])
def phieu_qua_han(db: Session = Depends(get_db)):
    today = date.today()
    items = db.query(PhieuMuon).options(
        joinedload(PhieuMuon.doc_gia).joinedload(DocGia.the_thu_vien),
        joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
    ).filter(
        PhieuMuon.trang_thai == TrangThaiPhieu.DANG_MUON,
        PhieuMuon.han_tra < today,
    ).all()
    for phieu in items:
        phieu.trang_thai = TrangThaiPhieu.QUA_HAN
    if items:
        db.commit()
    return items


@router.get("/", response_model=List[PhieuMuonOut])
def danh_sach(
    trang_thai: Optional[TrangThaiPhieu] = None,
    ma_doc_gia: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(PhieuMuon).options(
        joinedload(PhieuMuon.doc_gia).joinedload(DocGia.the_thu_vien),
        joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
    )
    if trang_thai:
        query = query.filter(PhieuMuon.trang_thai == trang_thai)
    if ma_doc_gia:
        query = query.filter(PhieuMuon.ma_doc_gia == ma_doc_gia)
    rows = query.order_by(PhieuMuon.created_at.desc()).offset(skip).limit(limit).all()
    for phieu in rows:
        for item in phieu.chi_tiet:
            if not item.ma_tai_lieu:
                item.ma_tai_lieu = ""
    return rows


@router.get("/lich-su/{ma_doc_gia}", response_model=List[PhieuMuonOut])
def lich_su_doc_gia(ma_doc_gia: str, db: Session = Depends(get_db)):
    rows = db.query(PhieuMuon).options(
        joinedload(PhieuMuon.doc_gia).joinedload(DocGia.the_thu_vien),
        joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
    ).filter(PhieuMuon.ma_doc_gia == ma_doc_gia).order_by(PhieuMuon.created_at.desc()).all()
    for phieu in rows:
        for item in phieu.chi_tiet:
            if not item.ma_tai_lieu:
                item.ma_tai_lieu = ""
    return rows


@router.get("/dat-truoc/{ma}", response_model=dict)
def get_reservation_info(ma: str, db: Session = Depends(get_db)):
    reservation = db.query(DatTruoc).options(
        joinedload(DatTruoc.doc_gia),
        joinedload(DatTruoc.tai_lieu),
    ).filter(DatTruoc.ma_dat_truoc == ma).first()
    if not reservation:
        raise HTTPException(404, "Không tìm thấy mã đặt trước")
    if reservation.trang_thai == "da_nhan_sach":
        raise HTTPException(400, "Mã đặt trước này đã được nhận sách rồi")
    return {
        "ma_doc_gia": reservation.ma_doc_gia,
        "ho_ten": reservation.doc_gia.ho_ten if reservation.doc_gia else "N/A",
        "ma_tai_lieu": reservation.ma_tai_lieu,
        "ten_tai_lieu": reservation.tai_lieu.ten_tai_lieu if reservation.tai_lieu else "N/A",
        "so_luong": 1,
        "ma_dat_truoc": reservation.ma_dat_truoc,
    }


@router.get("/{ma}", response_model=PhieuMuonOut)
def chi_tiet(ma: str, db: Session = Depends(get_db)):
    phieu = load_phieu(db, ma)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu mượn")
    return phieu


@router.put("/{ma}/gia-han", response_model=PhieuMuonOut)
def gia_han(ma: str, db: Session = Depends(get_db)):
    phieu = load_phieu(db, ma)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu mượn")
    days = MuonTraValidator(db).validate_extension(phieu)
    phieu.han_tra = phieu.han_tra + timedelta(days=days)
    if phieu.han_tra >= date.today():
        phieu.trang_thai = TrangThaiPhieu.DANG_MUON
    db.commit()
    return load_phieu(db, ma)


@router.post("/", response_model=PhieuMuonOut, status_code=201)
def lap_phieu_muon(req: PhieuMuonCreate, db: Session = Depends(get_db)):
    validation = MuonTraValidator(db).validate_borrow(req)
    staff = db.query(NhanVien).first()
    ma = gen_ma()

    phieu = PhieuMuon(
        ma_phieu_muon=ma,
        ngay_muon=date.today(),
        han_tra=req.han_tra,
        ghi_chu=req.ghi_chu,
        ma_doc_gia=req.ma_doc_gia,
        ma_nhan_vien=staff.ma_nhan_vien if staff else None,
    )
    db.add(phieu)

    for ma_tai_lieu, so_luong in validation.requested_quantities.items():
        title = validation.tai_lieu_by_id[ma_tai_lieu]
        title.so_luong -= so_luong
        if title.so_luong == 0:
            title.tinh_trang = TrangThaiTaiLieu.DANG_MUON

        db.add(ChiTietPhieuMuon(
            ma_phieu_muon=ma,
            ma_tai_lieu=ma_tai_lieu,
            so_luong=so_luong,
        ))
        db.query(DatTruoc).filter(
            DatTruoc.ma_doc_gia == req.ma_doc_gia,
            DatTruoc.ma_tai_lieu == ma_tai_lieu,
            DatTruoc.trang_thai.in_(["cho_xu_ly", "da_duyet"]),
        ).update({"trang_thai": "da_nhan_sach"}, synchronize_session="fetch")

    db.commit()
    return load_phieu(db, ma)


@router.put("/{ma}/yeu-cau-tra", response_model=PhieuMuonOut)
def yeu_cau_tra(ma: str, db: Session = Depends(get_db)):
    phieu = load_phieu(db, ma)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu mượn")
    if phieu.trang_thai not in (TrangThaiPhieu.DANG_MUON, TrangThaiPhieu.QUA_HAN):
        raise HTTPException(400, "Chi co the yeu cau tra phieu dang muon")
    if phieu.han_tra < date.today():
        phieu.trang_thai = TrangThaiPhieu.QUA_HAN
    else:
        phieu.trang_thai = TrangThaiPhieu.CHO_TRA
    db.commit()
    return load_phieu(db, ma)


@router.post("/tra-sach", response_model=PhieuMuonOut)
def tra_sach(req: TraSachRequest, db: Session = Depends(get_db)):
    validation = MuonTraValidator(db).validate_return(req)
    phieu = validation.phieu_muon
    phieu.trang_thai = TrangThaiPhieu.DA_TRA

    for item in phieu.chi_tiet:
        title = item.tai_lieu or db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == item.ma_tai_lieu).first()
        if title:
            if validation.condition_type:
                if title.so_luong == 0:
                    title.tinh_trang = (
                        TrangThaiTaiLieu.BAO_TRI
                        if validation.condition_type == "damaged"
                        else TrangThaiTaiLieu.THANH_LY
                    )
            else:
                title.so_luong += item.so_luong
                title.tinh_trang = TrangThaiTaiLieu.CO_SAN
                process_reservation_queue(db, item.ma_tai_lieu)
        item.ngay_tra = date.today()
        item.tinh_trang_tra = req.tinh_trang_tra
        if not item.ma_tai_lieu:
            item.ma_tai_lieu = ""

    if validation.condition_type:
        label = "Mất sách" if validation.condition_type == "lost" else "Sách rách/hỏng"
        db.add(ViPhamPhat(
            ma_phat="VP-" + uuid.uuid4().hex[:8].upper(),
            ly_do_phat=f"{label} - tính theo giá sách",
            so_tien=validation.damage_fine,
            ma_phieu_muon=phieu.ma_phieu_muon,
        ))

    db.commit()
    return load_phieu(db, req.ma_phieu_muon)
