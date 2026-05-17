from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import unicodedata

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models import (
    CauHinhHeThong,
    ChiTietPhieuMuon,
    DatTruoc,
    DocGia,
    PhieuMuon,
    TaiLieu,
    TrangThaiPhieu,
    TrangThaiThe,
)


@dataclass
class BorrowValidationResult:
    doc_gia: DocGia
    tai_lieu_by_id: dict[str, TaiLieu]
    requested_quantities: dict[str, int]
    max_books: int


@dataclass
class ReturnValidationResult:
    phieu_muon: PhieuMuon
    condition_type: str | None
    damage_fine: Decimal


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFD", value or "")
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return value.lower()


def return_condition_type(tinh_trang_tra: str) -> str | None:
    value = normalize_text(tinh_trang_tra)
    if "mat" in value or "m?t" in value:
        return "lost"
    if "hong" in value or "h?ng" in value or "rach" in value or "r?ch" in value:
        return "damaged"
    return None


def get_int_config(db: Session, key: str, default: int) -> int:
    row = db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == key).first()
    try:
        return int(row.gia_tri) if row else default
    except (TypeError, ValueError):
        return default


class DocGiaValidator:
    def __init__(self, db: Session):
        self.db = db

    def require_active(self, ma_doc_gia: str) -> DocGia:
        doc_gia = self.db.query(DocGia).filter(DocGia.ma_doc_gia == ma_doc_gia).first()
        if not doc_gia:
            raise HTTPException(400, "Khong tim thay doc gia")
        if doc_gia.trang_thai_the != TrangThaiThe.CON_HIEU_LUC:
            raise HTTPException(400, "The doc gia khong con hieu luc hoac dang bi khoa")
        if doc_gia.the_thu_vien:
            if doc_gia.the_thu_vien.trang_thai != TrangThaiThe.CON_HIEU_LUC:
                raise HTTPException(400, "The thu vien khong con hieu luc hoac dang bi khoa")
            if doc_gia.the_thu_vien.ngay_het_han < date.today():
                raise HTTPException(400, "The thu vien da het han")
        return doc_gia

    def current_borrowed_quantity(self, ma_doc_gia: str) -> int:
        total = self.db.query(func.coalesce(func.sum(ChiTietPhieuMuon.so_luong), 0)).join(
            PhieuMuon,
            ChiTietPhieuMuon.ma_phieu_muon == PhieuMuon.ma_phieu_muon,
        ).filter(
            PhieuMuon.ma_doc_gia == ma_doc_gia,
            PhieuMuon.trang_thai.in_([
                TrangThaiPhieu.DANG_MUON,
                TrangThaiPhieu.CHO_TRA,
                TrangThaiPhieu.QUA_HAN,
            ]),
        ).scalar()
        return int(total or 0)


class TaiLieuValidator:
    def __init__(self, db: Session):
        self.db = db

    def validate_requested_items(self, chi_tiet, ma_doc_gia: str) -> tuple[dict[str, TaiLieu], dict[str, int]]:
        if not chi_tiet:
            raise HTTPException(400, "Danh sach tai lieu muon khong duoc de trong")

        requested: dict[str, int] = {}
        for item in chi_tiet:
            ma_tai_lieu = (item.ma_tai_lieu or "").strip()
            so_luong = int(item.so_luong or 0)
            if not ma_tai_lieu:
                raise HTTPException(400, "Ma tai lieu la bat buoc")
            if so_luong <= 0:
                raise HTTPException(400, f"So luong muon cua tai lieu {ma_tai_lieu} phai lon hon 0")
            requested[ma_tai_lieu] = requested.get(ma_tai_lieu, 0) + so_luong

        titles = self.db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu.in_(requested.keys())).all()
        title_by_id = {title.ma_tai_lieu: title for title in titles}

        for ma_tai_lieu, so_luong in requested.items():
            title = title_by_id.get(ma_tai_lieu)
            if not title:
                raise HTTPException(400, f"Tai lieu {ma_tai_lieu} khong ton tai")
            if int(title.so_luong or 0) < so_luong:
                raise HTTPException(400, f"Tai lieu '{title.ten_tai_lieu}' khong du so luong (con {title.so_luong})")
            self._validate_reservation_hold(title, so_luong, ma_doc_gia)

        return title_by_id, requested

    def _validate_reservation_hold(self, title: TaiLieu, requested_qty: int, ma_doc_gia: str) -> None:
        other_holds = self.db.query(DatTruoc).filter(
            DatTruoc.ma_tai_lieu == title.ma_tai_lieu,
            DatTruoc.trang_thai == "da_duyet",
            DatTruoc.ma_doc_gia != ma_doc_gia,
        ).count()
        free_stock = max(int(title.so_luong or 0) - int(other_holds or 0), 0)
        if free_stock < requested_qty:
            raise HTTPException(
                400,
                f"Tai lieu '{title.ten_tai_lieu}' dang duoc giu cho doc gia dat truoc khac",
            )


class PhieuMuonValidator:
    def __init__(self, db: Session):
        self.db = db

    def validate_due_date(self, han_tra: date) -> None:
        if han_tra < date.today():
            raise HTTPException(400, "Han tra khong duoc nho hon ngay hien tai")

    def require_returnable(self, ma_phieu_muon: str) -> PhieuMuon:
        phieu_muon = self.db.query(PhieuMuon).options(
            joinedload(PhieuMuon.chi_tiet).joinedload(ChiTietPhieuMuon.tai_lieu),
            joinedload(PhieuMuon.doc_gia),
        ).filter(PhieuMuon.ma_phieu_muon == ma_phieu_muon).first()
        if not phieu_muon:
            raise HTTPException(404, "Khong tim thay phieu muon")
        if phieu_muon.trang_thai == TrangThaiPhieu.DA_TRA:
            raise HTTPException(400, "Phieu nay da duoc tra roi")
        if phieu_muon.trang_thai not in (
            TrangThaiPhieu.DANG_MUON,
            TrangThaiPhieu.CHO_TRA,
            TrangThaiPhieu.QUA_HAN,
        ):
            raise HTTPException(400, "Trang thai phieu muon khong hop le de tra sach")
        if phieu_muon.han_tra < date.today() and phieu_muon.trang_thai == TrangThaiPhieu.DANG_MUON:
            phieu_muon.trang_thai = TrangThaiPhieu.QUA_HAN
        return phieu_muon

    def require_extendable(self, phieu_muon: PhieuMuon) -> None:
        if phieu_muon.trang_thai not in (TrangThaiPhieu.DANG_MUON, TrangThaiPhieu.QUA_HAN):
            raise HTTPException(400, "Chi gia han phieu dang muon hoac qua han")
        for item in phieu_muon.chi_tiet:
            exists = self.db.query(DatTruoc).filter(
                DatTruoc.ma_tai_lieu == item.ma_tai_lieu,
                DatTruoc.trang_thai.in_(["cho_xu_ly", "da_duyet"]),
            ).first()
            if exists:
                raise HTTPException(400, f"Tai lieu {item.ma_tai_lieu} dang co dat truoc, khong the gia han")


class MuonTraValidator:
    def __init__(self, db: Session):
        self.db = db
        self.doc_gia = DocGiaValidator(db)
        self.tai_lieu = TaiLieuValidator(db)
        self.phieu_muon = PhieuMuonValidator(db)

    def validate_borrow(self, req) -> BorrowValidationResult:
        self.phieu_muon.validate_due_date(req.han_tra)
        doc_gia = self.doc_gia.require_active(req.ma_doc_gia)
        title_by_id, requested = self.tai_lieu.validate_requested_items(req.chi_tiet, req.ma_doc_gia)

        max_books = get_int_config(self.db, "so_sach_toi_da", 5)
        current_qty = self.doc_gia.current_borrowed_quantity(req.ma_doc_gia)
        requested_qty = sum(requested.values())
        if current_qty + requested_qty > max_books:
            raise HTTPException(
                400,
                f"Doc gia chi duoc muon toi da {max_books} cuon; hien dang muon {current_qty}, yeu cau them {requested_qty}",
            )

        return BorrowValidationResult(
            doc_gia=doc_gia,
            tai_lieu_by_id=title_by_id,
            requested_quantities=requested,
            max_books=max_books,
        )

    def validate_return(self, req) -> ReturnValidationResult:
        phieu_muon = self.phieu_muon.require_returnable(req.ma_phieu_muon)
        condition_type = return_condition_type(req.tinh_trang_tra)
        damage_fine = Decimal(0)

        if condition_type:
            for item in phieu_muon.chi_tiet:
                title = item.tai_lieu
                if not title:
                    raise HTTPException(400, f"Tai lieu {item.ma_tai_lieu} khong ton tai")
                damage_fine += Decimal(title.gia or 0) * Decimal(item.so_luong or 1)
            if damage_fine <= 0:
                raise HTTPException(400, "Chua co gia sach de tinh phat mat/hong")

        return ReturnValidationResult(
            phieu_muon=phieu_muon,
            condition_type=condition_type,
            damage_fine=damage_fine,
        )

    def validate_extension(self, phieu_muon: PhieuMuon) -> int:
        self.phieu_muon.require_extendable(phieu_muon)
        return get_int_config(self.db, "so_ngay_gia_han", 7)
