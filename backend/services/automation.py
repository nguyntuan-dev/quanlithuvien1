from datetime import date, datetime, timedelta
from decimal import Decimal
import os

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from database import SessionLocal
from models import (
    AuditLog,
    CauHinhHeThong,
    ChiTietPhieuMuon,
    DatTruoc,
    DocGia,
    PhieuMuon,
    TaiLieu,
    TrangThaiPhat,
    TrangThaiPhieu,
    TrangThaiThe,
    ViPhamPhat,
)
from utils.email import LIBRARY_NAME, send_email

load_dotenv()

FINE_PER_DAY_OVERDUE = 10000
LOST_BOOK_COEFFICIENT = 2.0
BROKEN_BOOK_COEFFICIENT = 0.5


def get_int_config(db: Session, key: str, default: int) -> int:
    row = db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == key).first()
    try:
        return int(row.gia_tri) if row else default
    except (TypeError, ValueError):
        return default


def get_text_config(db: Session, key: str, default: str = "") -> str:
    row = db.query(CauHinhHeThong).filter(CauHinhHeThong.khoa == key).first()
    return row.gia_tri.strip() if row and row.gia_tri else default


def write_system_audit(
    db: Session,
    action: str,
    target: str,
    target_id: str = "",
    detail: str = "",
) -> None:
    db.add(AuditLog(
        hanh_dong=action,
        doi_tuong=target,
        ma_doi_tuong=target_id,
        nguoi_thuc_hien="system",
        chi_tiet=detail,
    ))


def send_safe_email(to_email: str | None, subject: str, body: str) -> bool:
    if not to_email:
        return False
    try:
        return bool(send_email(to_email, subject, body))
    except Exception as exc:
        print(f"[ERROR] Email failed for {to_email}: {exc}")
        return False


def process_reservation_queue(db: Session, ma_tai_lieu: str) -> int:
    """Approve oldest pending reservations while visible stock is available."""
    title = db.query(TaiLieu).filter(TaiLieu.ma_tai_lieu == ma_tai_lieu).first()
    if not title:
        return 0

    approved_holds = db.query(DatTruoc).filter(
        DatTruoc.ma_tai_lieu == ma_tai_lieu,
        DatTruoc.trang_thai == "da_duyet",
    ).count()
    available_slots = max(int(title.so_luong or 0) - approved_holds, 0)
    if available_slots <= 0:
        return 0

    reservations = db.query(DatTruoc).options(
        joinedload(DatTruoc.doc_gia),
        joinedload(DatTruoc.tai_lieu),
    ).filter(
        DatTruoc.ma_tai_lieu == ma_tai_lieu,
        DatTruoc.trang_thai == "cho_xu_ly",
    ).order_by(DatTruoc.ngay_dat.asc()).limit(available_slots).all()

    hold_days = get_int_config(db, "so_ngay_giu_dat_truoc", 3)
    approved = 0
    for reservation in reservations:
        reservation.trang_thai = "da_duyet"
        approved += 1
        write_system_audit(
            db,
            "tu_dong_duyet_dat_truoc",
            "dat_truoc",
            reservation.ma_dat_truoc,
            f"Tai lieu {ma_tai_lieu} co sach, giu {hold_days} ngay",
        )
        if reservation.doc_gia and reservation.doc_gia.email:
            title_name = reservation.tai_lieu.ten_tai_lieu if reservation.tai_lieu else ma_tai_lieu
            send_safe_email(
                reservation.doc_gia.email,
                "Dat truoc da co sach",
                f"""
                <h2>Dat truoc da co sach</h2>
                <p>Chao {reservation.doc_gia.ho_ten},</p>
                <p>Tai lieu <strong>{title_name}</strong> da san sang.</p>
                <p>Vui long den thu vien trong {hold_days} ngay de nhan sach.</p>
                <p>Tran trong,<br/><strong>{LIBRARY_NAME}</strong></p>
                """,
            )
    return approved


def generate_operations_report(db: Session, report_date: date | None = None) -> dict:
    report_date = report_date or date.today()
    returned_today = db.query(ChiTietPhieuMuon.ma_phieu_muon).filter(
        ChiTietPhieuMuon.ngay_tra == report_date
    ).distinct().count()
    unpaid_fines = db.query(func.coalesce(func.sum(ViPhamPhat.so_tien), 0)).filter(
        ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN
    ).scalar() or 0
    overdue_items = db.query(PhieuMuon).options(joinedload(PhieuMuon.doc_gia)).filter(
        PhieuMuon.trang_thai == TrangThaiPhieu.QUA_HAN
    ).order_by(PhieuMuon.han_tra.asc()).limit(10).all()
    low_stock = db.query(TaiLieu).filter(TaiLieu.so_luong <= 1).order_by(
        TaiLieu.so_luong.asc(),
        TaiLieu.ten_tai_lieu.asc(),
    ).limit(10).all()

    return {
        "ngay": report_date.isoformat(),
        "muon_moi": db.query(PhieuMuon).filter(PhieuMuon.ngay_muon == report_date).count(),
        "tra_hom_nay": returned_today,
        "cho_duyet_tra": db.query(PhieuMuon).filter(PhieuMuon.trang_thai == TrangThaiPhieu.CHO_TRA).count(),
        "qua_han": db.query(PhieuMuon).filter(PhieuMuon.trang_thai == TrangThaiPhieu.QUA_HAN).count(),
        "dat_truoc_cho_xu_ly": db.query(DatTruoc).filter(DatTruoc.trang_thai == "cho_xu_ly").count(),
        "dat_truoc_da_duyet": db.query(DatTruoc).filter(DatTruoc.trang_thai == "da_duyet").count(),
        "vi_pham_chua_thanh_toan": db.query(ViPhamPhat).filter(
            ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN
        ).count(),
        "tong_tien_phat_chua_thu": float(unpaid_fines),
        "phieu_qua_han_can_xu_ly": [
            {
                "ma_phieu_muon": item.ma_phieu_muon,
                "doc_gia": item.doc_gia.ho_ten if item.doc_gia else item.ma_doc_gia,
                "han_tra": item.han_tra.isoformat(),
                "so_ngay_qua_han": (report_date - item.han_tra).days,
            }
            for item in overdue_items
        ],
        "sach_sap_het": [
            {
                "ma_tai_lieu": item.ma_tai_lieu,
                "ten_tai_lieu": item.ten_tai_lieu,
                "so_luong": int(item.so_luong or 0),
            }
            for item in low_stock
        ],
    }


def _fine_code(pm: PhieuMuon, today: date) -> str:
    raw = f"VP-{pm.ma_phieu_muon}-{today.strftime('%Y%m%d')}"
    return raw[:30]


def job_update_overdue():
    db = SessionLocal()
    try:
        today = date.today()
        items = db.query(PhieuMuon).filter(
            PhieuMuon.trang_thai == TrangThaiPhieu.DANG_MUON,
            PhieuMuon.han_tra < today,
        ).all()
        for item in items:
            item.trang_thai = TrangThaiPhieu.QUA_HAN
            write_system_audit(db, "tu_dong_cap_nhat_qua_han", "phieu_muon", item.ma_phieu_muon)
        db.commit()
        print(f"[OK] Updated {len(items)} overdue loans")
    except Exception as exc:
        print(f"[ERROR] update_overdue: {exc}")
        db.rollback()
    finally:
        db.close()


def job_calculate_daily_fine():
    db = SessionLocal()
    try:
        today = date.today()
        items = db.query(PhieuMuon).options(joinedload(PhieuMuon.doc_gia)).filter(
            PhieuMuon.trang_thai == TrangThaiPhieu.QUA_HAN,
        ).all()
        per_day = get_int_config(db, "tien_phat_qua_han_moi_ngay", FINE_PER_DAY_OVERDUE)
        for item in items:
            days = max((today - item.han_tra).days, 0)
            amount = Decimal(days * per_day)
            reason = f"Qua han tra sach ({days} ngay)"
            fine = db.query(ViPhamPhat).filter(
                ViPhamPhat.ma_phieu_muon == item.ma_phieu_muon,
                or_(
                    ViPhamPhat.ly_do_phat.like("Qua han tra sach%"),
                    ViPhamPhat.ly_do_phat.like("Quá hạn trả sách%"),
                    ViPhamPhat.ly_do_phat.like("QuĂ¡ háº¡n tráº£ sĂ¡ch%"),
                ),
            ).first()
            if fine:
                fine.so_tien = amount
                fine.ly_do_phat = reason
            else:
                db.add(ViPhamPhat(
                    ma_phat=_fine_code(item, today),
                    ly_do_phat=reason,
                    so_tien=amount,
                    ma_phieu_muon=item.ma_phieu_muon,
                ))
                write_system_audit(db, "tu_dong_tao_phat_qua_han", "phieu_muon", item.ma_phieu_muon, str(amount))

            should_notify = days in (1, 3, 7, 14) or (days > 0 and days % 7 == 0)
            if should_notify and item.doc_gia and item.doc_gia.email:
                send_safe_email(
                    item.doc_gia.email,
                    "Thong bao phat qua han sach",
                    f"""
                    <h2>Thong bao vi pham qua han</h2>
                    <p>Chao {item.doc_gia.ho_ten},</p>
                    <p>Ban da qua han tra sach <strong>{days} ngay</strong>.</p>
                    <p>So tien phat hien tai: <strong>{amount:,.0f} VND</strong></p>
                    <p>Vui long tra sach va thanh toan som.</p>
                    <p>Tran trong,<br/><strong>{LIBRARY_NAME}</strong></p>
                    """,
                )
        db.commit()
        print("[OK] Calculated overdue fines")
    except Exception as exc:
        print(f"[ERROR] calculate_daily_fine: {exc}")
        db.rollback()
    finally:
        db.close()


def job_send_overdue_notifications():
    db = SessionLocal()
    try:
        remind_date = date.today() + timedelta(days=2)
        items = db.query(PhieuMuon).options(joinedload(PhieuMuon.doc_gia)).filter(
            PhieuMuon.trang_thai == TrangThaiPhieu.DANG_MUON,
            PhieuMuon.han_tra == remind_date,
        ).all()
        for item in items:
            if item.doc_gia and item.doc_gia.email:
                send_safe_email(
                    item.doc_gia.email,
                    "Thong bao han tra sach",
                    f"""
                    <h2>Thong bao han tra sach</h2>
                    <p>Chao {item.doc_gia.ho_ten},</p>
                    <p>Sach ban muon sap den han tra vao ngay <strong>{item.han_tra}</strong>.</p>
                    <p>Vui long tra sach dung han de tranh bi phat.</p>
                    <p>Tran trong,<br/><strong>{LIBRARY_NAME}</strong></p>
                    """,
                )
        print(f"[OK] Sent {len(items)} due-date reminders")
    except Exception as exc:
        print(f"[ERROR] send_overdue_notifications: {exc}")
    finally:
        db.close()


def job_lock_card_on_violation():
    db = SessionLocal()
    try:
        today = date.today()
        max_overdue_days = get_int_config(db, "nguong_khoa_the_qua_han", 30)
        max_unpaid = get_int_config(db, "nguong_khoa_the_tien_phat", 100000)
        items = db.query(DocGia).join(PhieuMuon).join(ViPhamPhat).filter(
            ViPhamPhat.trang_thai_thanh_toan == TrangThaiPhat.CHUA_THANH_TOAN,
            or_(
                PhieuMuon.han_tra <= today - timedelta(days=max_overdue_days),
                ViPhamPhat.so_tien >= max_unpaid,
            ),
        ).distinct().all()
        for reader in items:
            if reader.trang_thai_the != TrangThaiThe.BI_KHOA:
                reader.trang_thai_the = TrangThaiThe.BI_KHOA
                write_system_audit(db, "tu_dong_khoa_the", "doc_gia", reader.ma_doc_gia)
                send_safe_email(
                    reader.email,
                    "The thu vien bi khoa",
                    f"<h2>The thu vien bi khoa</h2><p>Chao {reader.ho_ten}, the cua ban da bi khoa do vi pham chua thanh toan.</p>",
                )
        db.commit()
        print(f"[OK] Locked {len(items)} reader cards if needed")
    except Exception as exc:
        print(f"[ERROR] lock_card: {exc}")
        db.rollback()
    finally:
        db.close()


def job_cancel_old_reservations():
    db = SessionLocal()
    try:
        hold_days = get_int_config(db, "so_ngay_giu_dat_truoc", 3)
        cancel_before = datetime.now() - timedelta(days=hold_days)
        items = db.query(DatTruoc).filter(
            DatTruoc.trang_thai.in_(["cho_xu_ly", "da_duyet"]),
            DatTruoc.ngay_dat < cancel_before,
        ).all()
        affected_titles = set()
        for item in items:
            item.trang_thai = "da_huy"
            affected_titles.add(item.ma_tai_lieu)
            write_system_audit(db, "tu_dong_huy_dat_truoc_cu", "dat_truoc", item.ma_dat_truoc)
        for ma_tai_lieu in affected_titles:
            process_reservation_queue(db, ma_tai_lieu)
        db.commit()
        print(f"[OK] Cancelled {len(items)} stale reservations")
    except Exception as exc:
        print(f"[ERROR] cancel_reservations: {exc}")
        db.rollback()
    finally:
        db.close()


def job_process_reservation_queues():
    db = SessionLocal()
    try:
        titles = db.query(TaiLieu.ma_tai_lieu).filter(TaiLieu.so_luong > 0).all()
        total = 0
        for (ma_tai_lieu,) in titles:
            total += process_reservation_queue(db, ma_tai_lieu)
        db.commit()
        print(f"[OK] Approved {total} reservations")
    except Exception as exc:
        print(f"[ERROR] process_reservation_queues: {exc}")
        db.rollback()
    finally:
        db.close()


def job_send_daily_operations_report():
    db = SessionLocal()
    try:
        recipients = [
            email.strip()
            for email in get_text_config(db, "email_bao_cao_thu_thu", os.getenv("LIBRARIAN_REPORT_EMAIL", "")).split(",")
            if email.strip()
        ]
        if not recipients:
            print("[OK] Daily report skipped; no recipients configured")
            return

        report = generate_operations_report(db)
        html = f"""
        <h2>Bao cao van hanh ngay {report['ngay']}</h2>
        <ul>
          <li>Muon moi: <strong>{report['muon_moi']}</strong></li>
          <li>Tra hom nay: <strong>{report['tra_hom_nay']}</strong></li>
          <li>Cho duyet tra: <strong>{report['cho_duyet_tra']}</strong></li>
          <li>Qua han: <strong>{report['qua_han']}</strong></li>
          <li>Dat truoc cho xu ly: <strong>{report['dat_truoc_cho_xu_ly']}</strong></li>
          <li>Tien phat chua thu: <strong>{report['tong_tien_phat_chua_thu']:,.0f} VND</strong></li>
        </ul>
        """
        for recipient in recipients:
            send_safe_email(recipient, f"Bao cao van hanh {report['ngay']}", html)
        write_system_audit(db, "tu_dong_gui_bao_cao_ngay", "bao_cao", report["ngay"], ",".join(recipients))
        db.commit()
    except Exception as exc:
        print(f"[ERROR] daily_operations_report: {exc}")
        db.rollback()
    finally:
        db.close()


def run_automation_once() -> dict:
    job_update_overdue()
    job_calculate_daily_fine()
    job_process_reservation_queues()
    job_cancel_old_reservations()
    job_lock_card_on_violation()
    return {"message": "Automation jobs completed"}


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(job_update_overdue, "cron", hour=0, minute=0, id="update_overdue")
    scheduler.add_job(job_calculate_daily_fine, "cron", hour=0, minute=5, id="calculate_fine")
    scheduler.add_job(job_send_overdue_notifications, "cron", hour=8, minute=0, id="send_notifications")
    scheduler.add_job(job_lock_card_on_violation, "cron", hour="*/6", minute=0, id="lock_card")
    scheduler.add_job(job_cancel_old_reservations, "cron", day_of_week="mon", hour=0, minute=0, id="cancel_res")
    scheduler.add_job(job_process_reservation_queues, "cron", hour="*/2", minute=10, id="process_reservations")
    scheduler.add_job(job_send_daily_operations_report, "cron", hour=17, minute=30, id="daily_operations_report")
    scheduler.start()
    print("[OK] Scheduler started with 7 automation jobs")
    return scheduler
