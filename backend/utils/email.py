import json
import os
import smtplib
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
LIBRARY_NAME = "Thu Vien Pro"
RESEND_API_URL = "https://api.resend.com/emails"


def get_sender_email() -> str | None:
    return (
        os.getenv("RESEND_FROM_EMAIL")
        or os.getenv("EMAIL_FROM")
        or os.getenv("SENDER_EMAIL")
        or os.getenv("EMAIL_USER")
    )


def sender_header(sender: str) -> str:
    return f"{LIBRARY_NAME} <{sender}>"


def send_email_with_resend(to_email: str, subject: str, body: str, is_html: bool = True):
    api_key = os.getenv("RESEND_API_KEY")
    sender = get_sender_email()
    resend_configured = bool(
        api_key
        or os.getenv("RESEND_FROM_EMAIL")
        or os.getenv("EMAIL_FROM")
    )
def send_email_with_resend(to_email: str, subject: str, body: str, is_html: bool = True):
    api_key = os.getenv("RESEND_API_KEY")

    print("DEBUG RESEND_API_KEY:", bool(api_key))
    print("DEBUG EMAIL_FROM:", os.getenv("EMAIL_FROM"))

    sender = get_sender_email()

    if not resend_configured:
        return None
    if not api_key:
        print("[ERROR] RESEND_API_KEY not set")
        return False
    if not sender:
        print("[ERROR] RESEND_FROM_EMAIL, EMAIL_FROM, SENDER_EMAIL, or EMAIL_USER not set")
        return False

    payload = {
        "from": sender_header(sender),
        "to": [to_email],
        "subject": subject,
        "html" if is_html else "text": body,
    }
    request = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "quanlithuvien/1.0",
        },
    )

    try:
        print(f"[DEBUG] Attempting to send email from {sender} via Resend...")
        with urllib.request.urlopen(request, timeout=15) as response:
            if 200 <= response.status < 300:
                print(f"[OK] Resend email sent to {to_email}")
                return True
            print(f"[ERROR] Resend returned HTTP {response.status}")
            return False
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        print(f"[ERROR] Resend HTTP {exc.code}: {response_body}")
        return False
    except Exception as exc:
        print(f"[ERROR] Error sending email with Resend from {sender}: {exc}")
        return False


def send_email_with_smtp(to_email: str, subject: str, body: str, is_html: bool = True):
    sender = os.getenv("SENDER_EMAIL") or os.getenv("EMAIL_USER")
    password = os.getenv("SENDER_PASSWORD") or os.getenv("EMAIL_PASSWORD")
    server_host = os.getenv("SMTP_SERVER", SMTP_SERVER)
    server_port = int(os.getenv("SMTP_PORT", SMTP_PORT))

    if not sender or not password:
        print("[ERROR] SMTP sender/password env vars not set")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = sender_header(sender)
        msg["To"] = to_email
        msg["Subject"] = subject

        content_type = "html" if is_html else "plain"
        msg.attach(MIMEText(body, content_type, "utf-8"))

        print(f"[DEBUG] Attempting to send email from {sender} via {server_host}...")

        server = smtplib.SMTP(server_host, server_port, timeout=10)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        print(f"[OK] SMTP email sent to {to_email}")
        return True
    except Exception as exc:
        print(f"[ERROR] Error sending email from {sender}: {exc}")
        return False


def send_email(to_email: str, subject: str, body: str, is_html: bool = True):
    load_dotenv()

    resend_result = send_email_with_resend(to_email, subject, body, is_html)
    if resend_result is not None:
        return resend_result

    return send_email_with_smtp(to_email, subject, body, is_html)


def send_otp_email(to_email: str, otp_code: str):
    subject = f"Ma xac thuc dang ky - {LIBRARY_NAME}"
    body = f"""
    <h3>Xac nhan dang ky tai khoan</h3>
    <p>Chao ban,</p>
    <p>Ma xac thuc (OTP) cua ban la:
      <strong style='font-size: 1.2rem; color: #d4a017;'>{otp_code}</strong>
    </p>
    <p>Ma nay co hieu luc trong vong 5 phut.</p>
    <p>Tran trong,<br/><strong>{LIBRARY_NAME}</strong></p>
    """
    return send_email(to_email, subject, body, is_html=True)
