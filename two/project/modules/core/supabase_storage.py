import os
from pathlib import Path
from typing import Optional, Dict, Any
from modules.config.settings import get_settings

class SupabaseStorageService:
    """Supabase 存储与报告持久化公用服务模块"""
    
    def __init__(self):
        settings = get_settings()
        self.url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
        self.key = settings.supabase_key or os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.bucket_name = settings.supabase_storage_bucket or os.getenv("SUPABASE_STORAGE_BUCKET", "research-reports")
        
        self.client = None
        if self.url and self.key:
            try:
                from supabase import create_client
                self.client = create_client(self.url, self.key)
            except ImportError:
                print("[Warning] 未安装 `supabase` 依赖包，请运行: pip install supabase")
            except Exception as e:
                print(f"[Warning] Supabase 客户端初始化失败: {str(e)}")

    def upload_file(self, local_file_path: Path, remote_path: str) -> Optional[str]:
        """
        上传本地文件到 Supabase Storage 存储桶
        :param local_file_path: 本地文件 Path 路径
        :param remote_path: 存储桶中的相对路径 (例如: reports/session_123/report_langgraph.md)
        :return: 文件的公开访问 URL 或 None
        """
        if not self.client:
            print("[Warning] Supabase Client 未就绪（请检查 SUPABASE_URL 和 SUPABASE_KEY），跳过上传")
            return None
        
        local_path = Path(local_file_path)
        if not local_path.exists():
            print(f"[Error] 本地待上传文件不存在: {local_path}")
            return None

        try:
            # 自动检测/确保存储桶 Bucket 存在
            buckets = self.client.storage.list_buckets()
            existing_bucket_names = [b.name for b in buckets] if buckets else []
            if self.bucket_name not in existing_bucket_names:
                print(f"[INFO] 检测到存储桶 `{self.bucket_name}` 不存在，尝试自动创建...")
                self.client.storage.create_bucket(self.bucket_name, options={"public": True})

            with open(local_path, "rb") as f:
                file_content = f.read()

            # 上传并覆盖模式
            res = self.client.storage.from_(self.bucket_name).upload(
                path=remote_path,
                file=file_content,
                file_options={"upsert": "true", "content-type": "text/markdown; charset=utf-8"}
            )
            
            # 获取公共访问 URL
            public_url = self.client.storage.from_(self.bucket_name).get_public_url(remote_path)
            print(f" [SUCCESS] 文件成功上传至 Supabase Storage: {public_url}")
            return public_url

        except Exception as e:
            print(f" [FAILED] 上传文件至 Supabase Storage 失败: {str(e)}")
            return None

    def save_report_meta_to_db(self, title: str, report_url: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        将报告元数据保存到 Supabase PostgreSQL 表 `research_reports`
        """
        if not self.client:
            return False
        try:
            data = {
                "title": title,
                "report_url": report_url,
                "metadata": metadata or {}
            }
            self.client.table("research_reports").insert(data).execute()
            print(" [SUCCESS] 报告记录已保存至 Supabase 数据库")
            return True
        except Exception as e:
            print(f" [FAILED] 写入 Supabase 数据库失败: {str(e)}")
            return False
