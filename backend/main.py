from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from routers import tai_lieu, doc_gia, muon_tra, vi_pham, nhan_vien, thong_ke, auth, dat_truoc, he_thong, yeu_thich
from database import engine, Base
from services.automation import start_scheduler
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(
    title="He thong Quan ly Thu vien API",
    description="API cho he thong quan ly thu vien so",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tai_lieu ADD COLUMN IF NOT EXISTS gia NUMERIC(12, 0) DEFAULT 0"))
            conn.execute(text("ALTER TABLE tai_lieu ADD COLUMN IF NOT EXISTS anh_bia TEXT"))
            conn.execute(text("ALTER TABLE doc_gia ADD COLUMN IF NOT EXISTS mat_khau_hash VARCHAR(255)"))
            conn.execute(text("""
                INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES
                  ('TRIETON', 'Triết học / Tôn giáo'),
                  ('TAMLY', 'Tâm lý học / Phát triển bản thân'),
                  ('THIEUNHI', 'Truyện thiếu nhi / Thiếu niên'),
                  ('AMTHUC', 'Sách nấu ăn / Ẩm thực'),
                  ('DULICH', 'Du lịch / Địa lý'),
                  ('HOCTHUAT', 'Sách tham khảo / Học thuật chuyên ngành'),
                  ('NGHETHUAT', 'Nghệ thuật & Thiết kế')
                ON CONFLICT (ma_the_loai) DO NOTHING
            """))
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Database initialization failed: {e}")

app.include_router(auth.router,       prefix="/api/auth",      tags=["Xac thuc"])
app.include_router(tai_lieu.router,   prefix="/api/tai-lieu",  tags=["Tai lieu"])
app.include_router(doc_gia.router,    prefix="/api/doc-gia",   tags=["Doc gia"])
app.include_router(muon_tra.router,   prefix="/api/muon-tra",  tags=["Muon / Tra"])
app.include_router(dat_truoc.router,  prefix="/api/dat-truoc", tags=["Dat truoc"])
app.include_router(vi_pham.router,    prefix="/api/vi-pham",   tags=["Vi pham & Phat"])
app.include_router(nhan_vien.router,  prefix="/api/nhan-vien", tags=["Nhan vien"])
app.include_router(thong_ke.router,   prefix="/api/thong-ke",  tags=["Thong ke"])
app.include_router(he_thong.router,   prefix="/api/he-thong",  tags=["He thong"])
app.include_router(yeu_thich.router,  prefix="/api/yeu-thich", tags=["Yeu thich"])

scheduler = start_scheduler()

@app.get("/")
def root():
    return {"message": "Thu Vien Pro API dang hoat dong", "version": "1.0.0", "automation": "active"}

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
