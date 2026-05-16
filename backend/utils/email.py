import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "your-email@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "your-password")
LIBRARY_NAME = "Thư Viện Pro"

def send_email(to_email: str, subject: str, body: str, is_html: bool = True):
    """Hàm gửi email dùng chung cho toàn hệ thống"""
    # Đảm bảo load lại .env
    load_dotenv()
    
    sender = os.getenv("SENDER_EMAIL")
    password = os.getenv("SENDER_PASSWORD")
    server_host = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    server_port = int(os.getenv("SMTP_PORT", 587))

    if not sender or not password:
        print(f"[ERROR] SENDER_EMAIL or SENDER_PASSWORD not set in .env")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = f"{LIBRARY_NAME} <{sender}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        content_type = 'html' if is_html else 'plain'
        msg.attach(MIMEText(body, content_type, 'utf-8'))
        
        print(f"[DEBUG] Attempting to send email from {sender} via {server_host}...")
        
        server = smtplib.SMTP(server_host, server_port, timeout=10)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        print(f"[OK] Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[ERROR] Error sending email from {sender}: {e}")
        return False

def send_otp_email(to_email: str, otp_code: str):
    """Gửi OTP xác thực"""
    subject = f"Mã xác thực đăng ký - {LIBRARY_NAME}"
    body = f"""
    <h3>Xác nhận đăng ký tài khoản</h3>
    <p>Chào bạn,</p>
    <p>Mã xác thực (OTP) của bạn là: <strong style='font-size: 1.2rem; color: #d4a017;'>{otp_code}</strong></p>
    <p>Mã này có hiệu lực trong vòng 5 phút.</p>
    <p>Trân trọng,<br/><strong>{LIBRARY_NAME}</strong></p>
    """
    return send_email(to_email, subject, body, is_html=True)
