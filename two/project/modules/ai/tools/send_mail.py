from langchain_core.tools import tool
from pydantic import BaseModel, Field
from modules.config.settings import get_settings

# 内置库，无需 pip install 任何额外包！
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class SendMailArgs(BaseModel):
    to: str = Field(description="收件人邮箱地址")
    subject: str = Field(description="邮件主题")
    text: str = Field(description="纯文本邮件内容", default="")
    html: str = Field(description="HTML邮件内容", default="")

@tool('send_mail', args_schema=SendMailArgs)
def send_mail(to: str, subject: str, text: str = "", html: str = "") -> str:
    """
    发送电子邮件。需要提供收件人邮箱、主题，可选文本内容和 HTML 内容。
    """
    settings = get_settings()
    
    # ⚠️ 强烈建议将这些放到环境变量或配置管理中，绝对不能提交到代码仓库！
    SMTP_SERVER = settings.smtp_server
    SMTP_PORT = settings.smtp_port
    SENDER_EMAIL = settings.sender_email
    SENDER_PASSWORD = settings.sender_password
    
    # 1. 组装邮件对象
    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to
    
    # 2. 挂载邮件内容
    if text:
        msg.attach(MIMEText(text, 'plain', 'utf-8'))
    if html:
        msg.attach(MIMEText(html, 'html', 'utf-8'))
    
    # 如果两个都没传，给个默认兜底
    if not text and not html:
        msg.attach(MIMEText('（无文本内容）', 'plain', 'utf-8'))

    # 3. 连接服务器并发送
    try:
        print(f"----> [发送邮件] 给 {to} 发送主题: {subject}")
        print(f"----> SMTP: {SMTP_SERVER}:{SMTP_PORT}, 发件人: {SENDER_EMAIL}")
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        return f"邮件已成功发送到 {to}，主题为「{subject}」"
        
    except Exception as e:
        return f"邮件发送失败: {str(e)}"
