import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()


class Mailer:
    def __init__(self):
        self.from_email = os.environ["SMTP_FROM_EMAIL"]
        self.password = os.environ["SMTP_PASSWORD"]

    def send_mail(self, html: str, to_email: str):
        msg = MIMEMultipart()
        msg["Subject"] = "Your Email Signature"
        msg["From"] = self.from_email
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(self.from_email, self.password)
            smtp.sendmail(self.from_email, to_email, msg.as_string())
