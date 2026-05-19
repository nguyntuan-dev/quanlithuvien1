from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from models import TrangThaiTaiLieu, TrangThaiThe, TrangThaiPhieu, TrangThaiPhat, GioiTinh

# ── Thể loại ──────────────────────────────────────────────────────────────────
class TheLoaiBase(BaseModel):
    ma_the_loai: str
    ten_the_loai: str

class TheLoaiOut(TheLoaiBase):
    class Config: from_attributes = True

# ── Tác giả ───────────────────────────────────────────────────────────────────
class TacGiaBase(BaseModel):
    ma_tac_gia: str
    ten_tac_gia: str
    ghi_chu: Optional[str] = None

class TacGiaOut(TacGiaBase):
    class Config: from_attributes = True

# ── Nhà xuất bản ──────────────────────────────────────────────────────────────
class NXBBase(BaseModel):
    ma_nxb: str
    ten_nxb: str
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None

class NXBOut(NXBBase):
    class Config: from_attributes = True

# ── Tài liệu ──────────────────────────────────────────────────────────────────
class TaiLieuCreate(BaseModel):
    ma_tai_lieu: Optional[str] = None
    ten_tai_lieu: str
    nam_xuat_ban: Optional[int] = None
    so_luong: int = 1
    gia: Optional[float] = 0
    anh_bia: Optional[str] = None
    vi_tri: Optional[str] = None
    mo_ta: Optional[str] = None
    ma_tac_gia: Optional[str] = None
    ten_tac_gia: Optional[str] = None
    ma_the_loai: Optional[str] = None
    ma_nxb: Optional[str] = None
    ten_nxb: Optional[str] = None

class TaiLieuUpdate(BaseModel):
    ten_tai_lieu: Optional[str] = None
    nam_xuat_ban: Optional[int] = None
    so_luong: Optional[int] = None
    gia: Optional[float] = None
    anh_bia: Optional[str] = None
    vi_tri: Optional[str] = None
    tinh_trang: Optional[TrangThaiTaiLieu] = None
    mo_ta: Optional[str] = None
    ma_tac_gia: Optional[str] = None
    ten_tac_gia: Optional[str] = None
    ma_the_loai: Optional[str] = None
    ma_nxb: Optional[str] = None
    ten_nxb: Optional[str] = None

class TaiLieuOut(BaseModel):
    ma_tai_lieu: str
    ten_tai_lieu: str
    nam_xuat_ban: Optional[int]
    so_luong: int
    gia: Optional[float] = 0
    anh_bia: Optional[str] = None
    vi_tri: Optional[str]
    tinh_trang: TrangThaiTaiLieu
    mo_ta: Optional[str]
    tac_gia: Optional[TacGiaOut]
    the_loai: Optional[TheLoaiOut]
    nha_xuat_ban: Optional[NXBOut]
    created_at: Optional[datetime]
    class Config: from_attributes = True

class BanSaoCreate(BaseModel):
    ma_tai_lieu: str
    ma_vach: Optional[str] = None
    tinh_trang: Optional[TrangThaiTaiLieu] = TrangThaiTaiLieu.CO_SAN
    ghi_chu: Optional[str] = None

class BanSaoOut(BaseModel):
    ma_ban_sao: str
    ma_tai_lieu: str
    ma_vach: Optional[str]
    tinh_trang: TrangThaiTaiLieu
    ghi_chu: Optional[str]
    created_at: Optional[datetime]
    tai_lieu: Optional[TaiLieuOut] = None
    class Config: from_attributes = True

# ── Độc giả ───────────────────────────────────────────────────────────────────
class DocGiaCreate(BaseModel):
    ho_ten: str
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[GioiTinh] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    loai_the: Optional[str] = "Thẻ sinh viên (1 năm)"
    ngay_cap: Optional[date] = None
    ngay_het_han: Optional[date] = None
    mat_khau: Optional[str] = None
    otp: Optional[str] = None

class SendOtpRequest(BaseModel):
    email: str

class DocGiaUpdate(BaseModel):
    ho_ten: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[GioiTinh] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    trang_thai_the: Optional[TrangThaiThe] = None

class TheThuvienOut(BaseModel):
    ma_the: str
    ngay_cap: date
    ngay_het_han: date
    loai_the: Optional[str]
    trang_thai: TrangThaiThe
    class Config: from_attributes = True

class DocGiaOut(BaseModel):
    ma_doc_gia: str
    ho_ten: str
    ngay_sinh: Optional[date]
    gioi_tinh: Optional[GioiTinh]
    dia_chi: Optional[str]
    so_dien_thoai: Optional[str]
    email: Optional[str]
    trang_thai_the: TrangThaiThe
    the_thu_vien: Optional[TheThuvienOut]
    created_at: Optional[datetime]
    class Config: from_attributes = True

# ── Phiếu mượn ────────────────────────────────────────────────────────────────
class ChiTietMuonCreate(BaseModel):
    ma_tai_lieu: str
    so_luong: int = 1

class PhieuMuonCreate(BaseModel):
    ma_doc_gia: str
    han_tra: date
    ghi_chu: Optional[str] = None
    chi_tiet: List[ChiTietMuonCreate]

class ChiTietMuonOut(BaseModel):
    id: int
    ma_tai_lieu: str
    so_luong: int
    ngay_tra: Optional[date]
    tinh_trang_tra: Optional[str]
    tai_lieu: Optional[TaiLieuOut]
    class Config: from_attributes = True

class PhieuMuonOut(BaseModel):
    ma_phieu_muon: str
    ngay_muon: date
    han_tra: date
    trang_thai: TrangThaiPhieu
    ghi_chu: Optional[str]
    doc_gia: Optional[DocGiaOut]
    chi_tiet: List[ChiTietMuonOut]
    created_at: Optional[datetime]
    class Config: from_attributes = True

class TraSachRequest(BaseModel):
    ma_phieu_muon: str
    tinh_trang_tra: str = "Tốt"
    ghi_chu: Optional[str] = None

# ── Đặt trước ─────────────────────────────────────────────────────────────────
class DatTruocCreate(BaseModel):
    ma_doc_gia: str
    ma_tai_lieu: str

class DatTruocOut(BaseModel):
    ma_dat_truoc: str
    ngay_dat: datetime
    trang_thai: str
    doc_gia: Optional[DocGiaOut]
    tai_lieu: Optional[TaiLieuOut]
    class Config: from_attributes = True

# ── Vi phạm ───────────────────────────────────────────────────────────────────
class ViPhamCreate(BaseModel):
    ma_phieu_muon: str
    ly_do_phat: str
    so_tien: float

class ViPhamOut(BaseModel):
    ma_phat: str
    ly_do_phat: str
    so_tien: float
    trang_thai_thanh_toan: TrangThaiPhat
    ngay_phat: datetime
    ngay_thanh_toan: Optional[datetime]
    phieu_muon: Optional[PhieuMuonOut]
    class Config: from_attributes = True

class VietQRThanhToanOut(BaseModel):
    ma_phat: str
    so_tien: float
    noi_dung: str
    qr_url: str
    ngan_hang: str
    so_tai_khoan: str
    ten_tai_khoan: str
    provider: Optional[str] = "vietqr"
    checkout_url: Optional[str] = None
    order_code: Optional[int] = None
    warning: Optional[str] = None

class ThanhToanPhatStatusOut(BaseModel):
    ma_phat: str
    trang_thai_thanh_toan: TrangThaiPhat
    ngay_thanh_toan: Optional[datetime]

class GiaoDichThanhToanOut(BaseModel):
    matched: bool
    confirmed: bool
    ma_phat: Optional[str] = None
    message: str

# ── Nhân viên ─────────────────────────────────────────────────────────────────
class NhanVienCreate(BaseModel):
    ho_ten: str
    chuc_vu: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: str
    mat_khau: str
    la_admin: bool = False

class NhanVienOut(BaseModel):
    ma_nhan_vien: str
    ho_ten: str
    chuc_vu: Optional[str]
    so_dien_thoai: Optional[str]
    email: str
    la_admin: bool
    created_at: Optional[datetime]
    class Config: from_attributes = True

# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    mat_khau: str

class DoiMatKhauRequest(BaseModel):
    email: str
    mat_khau_moi: str

class DoiMatKhauCaNhanRequest(BaseModel):
    mat_khau_cu: str
    mat_khau_moi: str

class CaNhanDocGiaUpdate(BaseModel):
    ho_ten: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[GioiTinh] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None

class CaNhanNhanVienUpdate(BaseModel):
    ho_ten: Optional[str] = None
    so_dien_thoai: Optional[str] = None

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    nhan_vien: NhanVienOut

class DocGiaTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    doc_gia: DocGiaOut

class CauHinhOut(BaseModel):
    khoa: str
    gia_tri: str
    mo_ta: Optional[str] = None
    class Config: from_attributes = True

class CauHinhUpdate(BaseModel):
    gia_tri: str
    mo_ta: Optional[str] = None

class AuditLogOut(BaseModel):
    id: int
    hanh_dong: str
    doi_tuong: Optional[str]
    ma_doi_tuong: Optional[str]
    nguoi_thuc_hien: Optional[str]
    chi_tiet: Optional[str]
    created_at: Optional[datetime]
    class Config: from_attributes = True

# ── Thống kê ──────────────────────────────────────────────────────────────────
class ThongKeOut(BaseModel):
    tong_tai_lieu: int
    doc_gia_hoat_dong: int
    dang_duoc_muon: int
    vi_pham_chua_xu_ly: int
    tong_tien_phat_chua_thu: float
    dat_truoc_cho_duyet: int

# ── Yêu thích ─────────────────────────────────────────────────────────────────
class YeuThichCreate(BaseModel):
    ma_tai_lieu: str

class YeuThichOut(BaseModel):
    id: int
    ma_doc_gia: str
    ma_tai_lieu: str
    created_at: datetime
    tai_lieu: Optional[TaiLieuOut]
    class Config: from_attributes = True
