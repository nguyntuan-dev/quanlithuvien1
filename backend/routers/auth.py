from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime, timedelta
import os, random, logging
from database import get_db
from utils.email import send_otp_email
from models import NhanVien, DocGia, TheThuvien
from schemas import (
    LoginRequest,
    TokenOut,
    NhanVienCreate,
    NhanVienOut,
    DocGiaCreate,
    DocGiaTokenOut,
    DocGiaOut,
    DoiMatKhauRequest,
    DoiMatKhauCaNhanRequest,
    CaNhanDocGiaUpdate,
    CaNhanNhanVienUpdate,
    SendOtpRequest,
)
import hashlib, secrets, uuid

router = APIRouter()
TOKENS = {}
OTP_CODES = {}
logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed

def create_token(nv_id: str) -> str:
    token = hashlib.sha256(f"{nv_id}{secrets.token_hex(8)}".encode()).hexdigest()
    TOKENS[token] = ("nhan_vien", nv_id)
    return token

def create_reader_token(doc_gia_id: str) -> str:
    token = hashlib.sha256(f"{doc_gia_id}{secrets.token_hex(8)}".encode()).hexdigest()
    TOKENS[token] = ("doc_gia", doc_gia_id)
    return token

def get_current_nhan_vien(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> NhanVien:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập")

    token = authorization.removeprefix("Bearer ").strip()
    info = TOKENS.get(token)
    if not info or info[0] != "nhan_vien":
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")

    nv = db.query(NhanVien).filter(NhanVien.ma_nhan_vien == info[1]).first()
    if not nv:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    return nv

def get_current_doc_gia(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> DocGia:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập")

    token = authorization.removeprefix("Bearer ").strip()
    info = TOKENS.get(token)
    if not info or info[0] != "doc_gia":
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")

    dg = db.query(DocGia).filter(DocGia.ma_doc_gia == info[1]).first()
    if not dg:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    return dg

def require_admin(current: NhanVien = Depends(get_current_nhan_vien)) -> NhanVien:
    if not current.la_admin:
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền thực hiện thao tác này")
    return current

@router.post("/dang-nhap", response_model=TokenOut)
def dang_nhap(req: LoginRequest, db: Session = Depends(get_db)):
    nv = db.query(NhanVien).filter(NhanVien.email == req.email).first()
    if not nv or not verify_password(req.mat_khau, nv.mat_khau_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    token = create_token(nv.ma_nhan_vien)
    return TokenOut(access_token=token, nhan_vien=nv)

@router.post("/doc-gia/dang-nhap", response_model=DocGiaTokenOut)
def dang_nhap_doc_gia(req: LoginRequest, db: Session = Depends(get_db)):
    dg = db.query(DocGia).filter(DocGia.email == req.email).first()
    if not dg or not dg.mat_khau_hash or not verify_password(req.mat_khau, dg.mat_khau_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    token = create_reader_token(dg.ma_doc_gia)
    return DocGiaTokenOut(access_token=token, doc_gia=dg)


@router.post("/doc-gia/send-otp")
def send_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    if not req.email:
        raise HTTPException(status_code=400, detail="Email là bắt buộc")
    if db.query(DocGia).filter(DocGia.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email đã được đăng ký")
    
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now() + timedelta(minutes=5)
    OTP_CODES[req.email] = {"code": otp, "expires_at": expires_at}
    
    if not send_otp_email(req.email, otp):
        OTP_CODES.pop(req.email, None)
        raise HTTPException(
            status_code=503,
            detail="Khong the gui ma OTP luc nay. Vui long thu lai sau.",
        )
    
    return {"message": "Đã gửi mã xác thực đến email của bạn."}

@router.post("/doc-gia/dang-ky", response_model=DocGiaTokenOut, status_code=201)
def dang_ky_doc_gia(req: DocGiaCreate, db: Session = Depends(get_db)):
    if not req.email or not req.mat_khau:
        raise HTTPException(status_code=400, detail="Email và mật khẩu là bắt buộc")
    if db.query(DocGia).filter(DocGia.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    if not req.otp:
        raise HTTPException(status_code=400, detail="Mã xác thực OTP là bắt buộc")
    
    stored_otp = OTP_CODES.get(req.email)
    if not stored_otp:
        raise HTTPException(status_code=400, detail="Vui lòng yêu cầu gửi mã OTP trước")
    if datetime.now() > stored_otp["expires_at"]:
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn, vui lòng gửi lại")
    if stored_otp["code"] != req.otp:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác")
        
    del OTP_CODES[req.email]

    ma = "DG" + uuid.uuid4().hex[:6].upper()
    dg = DocGia(
        ma_doc_gia=ma,
        ho_ten=req.ho_ten,
        ngay_sinh=req.ngay_sinh,
        gioi_tinh=req.gioi_tinh,
        dia_chi=req.dia_chi,
        so_dien_thoai=req.so_dien_thoai,
        email=req.email,
        mat_khau_hash=hash_password(req.mat_khau),
    )
    db.add(dg)
    ngay_cap = req.ngay_cap or date.today()
    db.add(TheThuvien(
        ma_the="THE" + uuid.uuid4().hex[:6].upper(),
        ngay_cap=ngay_cap,
        ngay_het_han=req.ngay_het_han or date(ngay_cap.year + 1, ngay_cap.month, ngay_cap.day),
        loai_the=req.loai_the,
        ma_doc_gia=ma,
    ))
    db.commit(); db.refresh(dg)
    token = create_reader_token(dg.ma_doc_gia)
    return DocGiaTokenOut(access_token=token, doc_gia=dg)

@router.post("/ca-nhan/doi-mat-khau")
def doi_mat_khau_ca_nhan(
    req: DoiMatKhauCaNhanRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if len(req.mat_khau_moi) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập")
    token = authorization.removeprefix("Bearer ").strip()
    info = TOKENS.get(token)
    if not info:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")
    kind, uid = info
    if kind == "doc_gia":
        account = db.query(DocGia).filter(DocGia.ma_doc_gia == uid).first()
    elif kind == "nhan_vien":
        account = db.query(NhanVien).filter(NhanVien.ma_nhan_vien == uid).first()
    else:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")
    if not account:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if not account.mat_khau_hash or not verify_password(req.mat_khau_cu, account.mat_khau_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    if verify_password(req.mat_khau_moi, account.mat_khau_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu mới không được trùng mật khẩu cũ")
    account.mat_khau_hash = hash_password(req.mat_khau_moi)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}


@router.put("/ca-nhan/doc-gia", response_model=DocGiaOut)
def cap_nhat_ca_nhan_doc_gia(
    req: CaNhanDocGiaUpdate,
    current: DocGia = Depends(get_current_doc_gia),
    db: Session = Depends(get_db),
):
    data = req.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    new_email = data.get("email")
    if new_email is not None and new_email != (current.email or ""):
        taken = (
            db.query(DocGia)
            .filter(DocGia.email == new_email, DocGia.ma_doc_gia != current.ma_doc_gia)
            .first()
        )
        if taken:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    for k, v in data.items():
        setattr(current, k, v)
    db.commit()
    dg = (
        db.query(DocGia)
        .options(joinedload(DocGia.the_thu_vien))
        .filter(DocGia.ma_doc_gia == current.ma_doc_gia)
        .first()
    )
    return dg


@router.put("/ca-nhan/nhan-vien", response_model=NhanVienOut)
def cap_nhat_ca_nhan_nhan_vien(
    req: CaNhanNhanVienUpdate,
    current: NhanVien = Depends(get_current_nhan_vien),
    db: Session = Depends(get_db),
):
    data = req.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    for k, v in data.items():
        setattr(current, k, v)
    db.commit()
    db.refresh(current)
    return current


@router.post("/doi-mat-khau")
def doi_mat_khau(req: DoiMatKhauRequest, db: Session = Depends(get_db)):
    if not req.email or not req.mat_khau_moi:
        raise HTTPException(status_code=400, detail="Email và mật khẩu mới là bắt buộc")
    if len(req.mat_khau_moi) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")

    account = db.query(DocGia).filter(DocGia.email == req.email).first()
    if not account:
        account = db.query(NhanVien).filter(NhanVien.email == req.email).first()
    if not account:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản với email này")

    account.mat_khau_hash = hash_password(req.mat_khau_moi)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}

@router.post("/tao-tai-khoan", response_model=NhanVienOut)
def tao_tai_khoan(
    req: NhanVienCreate,
    db: Session = Depends(get_db),
    current: NhanVien = Depends(require_admin),
):
    existing = db.query(NhanVien).filter(NhanVien.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    ma = "NV" + uuid.uuid4().hex[:6].upper()
    nv = NhanVien(
        ma_nhan_vien=ma,
        ho_ten=req.ho_ten,
        chuc_vu=req.chuc_vu,
        so_dien_thoai=req.so_dien_thoai,
        email=req.email,
        mat_khau_hash=hash_password(req.mat_khau),
        la_admin=req.la_admin,
    )
    db.add(nv); db.commit(); db.refresh(nv)
    return nv
