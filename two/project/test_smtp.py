import smtplib
import os
import sys

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

print(f"Connecting to {SMTP_SERVER}:{SMTP_PORT}...")
try:
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
        server.set_debuglevel(1)
        print("Starting TLS...")
        server.starttls()
        print("TLS started. Logging in...")
        # don't actually log in to avoid exposing password in logs if it gets that far, just want to see if network works
        print("Connection successful.")
except Exception as e:
    print(f"Error: {e}")
