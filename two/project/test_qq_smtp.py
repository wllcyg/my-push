import smtplib
import os
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 465
SENDER_EMAIL = "904039807@qq.com"
SENDER_PASSWORD = "njcrfuswmekobgad"
TO = "904039807@qq.com"

print(f"Step 1: 检查环境变量中是否残留代理设置...")
proxy_vars = ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']
for var in proxy_vars:
    val = os.environ.get(var)
    if val:
        print(f"  ⚠️  {var} = {val}")
    else:
        print(f"  ✅ {var} 未设置（干净）")

print(f"\nStep 2: 连接到 {SMTP_SERVER}:{SMTP_PORT}...")
try:
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
        server.set_debuglevel(1)
        print(f"\nStep 3: 登录...")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        print(f"\nStep 4: 发送邮件...")
        msg = MIMEMultipart("alternative")
        msg['Subject'] = "测试邮件"
        msg['From'] = SENDER_EMAIL
        msg['To'] = TO
        msg.attach(MIMEText("测试成功了！", 'plain', 'utf-8'))
        server.send_message(msg)
        print(f"\n✅ 邮件发送成功！")
except Exception as e:
    print(f"\n❌ 失败: {type(e).__name__}: {e}")
