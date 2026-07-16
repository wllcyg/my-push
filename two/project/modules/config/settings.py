from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    """
    应用的全局配置类。
    会自动从操作系统的环境变量以及 .env 文件中读取配置。
    类型提示 (Type Hints) 会自动帮你进行类型转换和校验。
    """
    app_name: str = "My Default App Name"
    debug: bool = False
    
    # --- AI 大模型配置 ---
    aliyun_api_key: str | None = None
    open_ai_baseuel: str | None = None
    open_ai_model_name: str | None = None
    open_ai_embedding_name: str | None = None

    # --- Zilliz 向量库配置 ---
    zilliz_endpoint: str | None = None
    zilliz_api_key: str | None = None

    # --- 数据库配置 ---
    db_host: str | None = None
    db_port: int | None = None
    db_username: str | None = None
    db_password: str | None = None
    db_database: str | None = None

    # --- 地图/第三方 Key ---
    gaode_mcp_key: str | None = None

    web_search_key: str | None = None

    # 指定读取 .env 文件并忽略多余的环境变量
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

# 使用 lru_cache 装饰器，确保在整个应用生命周期中，配置类只被实例化一次（单例模式）
@lru_cache()
def get_settings() -> Settings:
    return Settings()
