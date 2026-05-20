"""
Security-focused checks (run with API up: http://127.0.0.1:8000).

- AuthZ: admin-only routes (403 non-admin, 401 missing/invalid token, 401 wrong role).
- AuthN: wrong password, invalid bearer.
- Documents high-risk behavior: many CRUD routes have no Depends(auth); public password reset.

  py -3 test_security.py
"""
import json
import urllib.error
import urllib.request

from database import SessionLocal
from models import ChiTietPhieuMuon, DatTruoc, DocGia, PhieuMuon, TheThuvien, ViPhamPhat, YeuThich

BASE = "http://127.0.0.1:8000"
SEC_EMAIL = "sec_test_reader@example.com"
SEC_PASS = "SecOrig1!"
SEC_PASS_RESET = "SecReset2!"


def cleanup_sec_reader():
    db = SessionLocal()
    try:
        ids = [
            x[0]
            for x in db.query(DocGia.ma_doc_gia).filter(DocGia.email == SEC_EMAIL).all()
        ]
        if not ids:
            return
        pm_ids = [
            x[0]
            for x in db.query(PhieuMuon.ma_phieu_muon)
            .filter(PhieuMuon.ma_doc_gia.in_(ids))
            .all()
        ]
        if pm_ids:
            db.query(ViPhamPhat).filter(ViPhamPhat.ma_phieu_muon.in_(pm_ids)).delete(
                synchronize_session=False
            )
            db.query(ChiTietPhieuMuon).filter(
                ChiTietPhieuMuon.ma_phieu_muon.in_(pm_ids)
            ).delete(synchronize_session=False)
            db.query(PhieuMuon).filter(PhieuMuon.ma_phieu_muon.in_(pm_ids)).delete(
                synchronize_session=False
            )
        db.query(YeuThich).filter(YeuThich.ma_doc_gia.in_(ids)).delete(synchronize_session=False)
        db.query(DatTruoc).filter(DatTruoc.ma_doc_gia.in_(ids)).delete(synchronize_session=False)
        db.query(TheThuvien).filter(TheThuvien.ma_doc_gia.in_(ids)).delete(synchronize_session=False)
        db.query(DocGia).filter(DocGia.ma_doc_gia.in_(ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def call(method, path, *, body=None, headers=None):
    h = dict(headers or {})
    if body is not None and "Content-Type" not in h:
        h["Content-Type"] = "application/json"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read()
        return (json.loads(raw) if raw else {}), resp.getcode()
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {}
        return parsed, e.code


def login_json(path, email, password):
    data = json.dumps({"email": email, "mat_khau": password}).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    r = json.loads(urllib.request.urlopen(req).read())
    tok = r["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def expect(name, code, want, detail=""):
    ok = code == want
    tail = f" {detail}" if detail else ""
    print(f"[{'OK' if ok else 'FAIL'}] {name}: HTTP {code} (expect {want}){tail}")
    return ok


cleanup_sec_reader()

print("=== SECURITY TEST ===")

failures = 0

# Wrong password
_, c = call(
    "POST",
    "/api/auth/dang-nhap",
    body={"email": "admin@thuvien.vn", "mat_khau": "wrong_password_xyz"},
)
if not expect("Staff login wrong password", c, 401):
    failures += 1

# No auth admin route
_, c = call("GET", "/api/he-thong/cau-hinh")
if not expect("He-thong without Authorization", c, 401):
    failures += 1

# Garbage token
_, c = call(
    "GET",
    "/api/he-thong/cau-hinh",
    headers={"Authorization": "Bearer not_a_real_token_value_0123456789abcdef"},
)
if not expect("He-thong invalid Bearer", c, 401):
    failures += 1

admin_h = login_json("/api/auth/dang-nhap", "admin@thuvien.vn", "18112006")
staff_h = login_json("/api/auth/dang-nhap", "lan@thuvien.vn", "18112006")

# Non-admin must not manage staff
_, c = call("GET", "/api/nhan-vien/", headers=staff_h)
if not expect("GET nhan-vien as staff (non-admin)", c, 403):
    failures += 1

_, c = call("GET", "/api/he-thong/cau-hinh", headers=staff_h)
if not expect("GET he-thong as staff (non-admin)", c, 403):
    failures += 1

_, c = call(
    "POST",
    "/api/auth/tao-tai-khoan",
    body={
        "ho_ten": "X",
        "email": "should_not_be_created@test.local",
        "mat_khau": "abcdef1",
        "la_admin": False,
    },
    headers=staff_h,
)
if not expect("POST tao-tai-khoan as staff (non-admin)", c, 403):
    failures += 1

# Admin OK
_, c = call("GET", "/api/he-thong/cau-hinh", headers=admin_h)
if not expect("GET he-thong as admin", c, 200):
    failures += 1

# Reader isolation
r, c = call(
    "POST",
    "/api/doc-gia/",
    body={
        "ho_ten": "Sec Reader",
        "email": SEC_EMAIL,
        "mat_khau": SEC_PASS,
        "gioi_tinh": "NAM",
        "so_dien_thoai": "0900000001",
    },
)
if not expect("Create doc-gia for reader tests", c, 201):
    failures += 1

reader_h = login_json("/api/auth/doc-gia/dang-nhap", SEC_EMAIL, SEC_PASS)

_, c = call("GET", "/api/he-thong/cau-hinh", headers=reader_h)
if not expect("GET he-thong with reader token (wrong role)", c, 401):
    failures += 1

_, c = call("GET", "/api/yeu-thich/")
if not expect("GET yeu-thich without token", c, 401):
    failures += 1

_, c = call("GET", "/api/yeu-thich/", headers=reader_h)
if not expect("GET yeu-thich with reader token", c, 200):
    failures += 1

# Open API surface (no auth on router) — informational
_, c = call("GET", "/api/tai-lieu/?limit=1")
open_tl = c == 200
print(
    f"[{'WARN' if open_tl else 'OK'}] GET tai-lieu without auth: HTTP {c} "
    "(public catalog read is expected)"
)

_, c = call("GET", "/api/vi-pham/vi-pham/?limit=1")
if not expect("GET vi-pham without auth", c, 401):
    failures += 1

_, c = call("POST", "/api/muon-tra/", body={})
if not expect("POST muon-tra empty JSON without auth", c, 401):
    failures += 1

# Public password reset must stay disabled.
_, c = call(
    "POST",
    "/api/auth/doi-mat-khau",
    body={"email": SEC_EMAIL, "mat_khau_moi": SEC_PASS_RESET},
)
if not expect("POST doi-mat-khau without old password", c, 410):
    failures += 1

_, c = call(
    "POST",
    "/api/auth/doc-gia/dang-nhap",
    body={"email": SEC_EMAIL, "mat_khau": SEC_PASS},
)
if not expect("Reader original password still works after blocked public reset", c, 200):
    failures += 1

print("")
print("OK: POST /api/auth/doi-mat-khau is disabled for unauthenticated reset.")
print("")

cleanup_sec_reader()

print(f"=== SECURITY DONE ({failures} hard failures) ===")
if failures:
    raise SystemExit(1)
