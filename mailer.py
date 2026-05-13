from smtplib import SMTP
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, BaseLoader
import smtplib
from dotenv import load_dotenv
import os

class Mailer:
    def __init__(self):
        load_dotenv()

    def send_mail(self, html, to_email):
        # Load HTML template
        self.rtemplate = Environment(loader=BaseLoader()).from_string(html)
        from_email = 'marketing@cape-ai.com'
        subject = 'Email Signature'
        message = MIMEMultipart()
        message['Subject'] = subject
        message['From'] = from_email 
        message['To'] = to_email
        message.attach(MIMEText(self.rtemplate.render(), "html"))

        # Attach to gmail server to send email
        smtp_obj = smtplib.SMTP("smtp.gmail.com", 587)
        smtp_obj.ehlo()
        smtp_obj.starttls()
        smtp_obj.login(from_email, 'poaptcvfomtfbgcv')
        smtp_obj.sendmail(from_email, to_email, message.as_string())
        smtp_obj.quit()

        print('Email successfully sent!')