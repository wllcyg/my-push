from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from modules.config.settings import get_settings

# 拿到所有配置项
_settings = get_settings() 

default_model = ChatOpenAI(
    api_key=_settings.aliyun_api_key,
    base_url=_settings.open_ai_baseuel,
    model=_settings.open_ai_model_name,
)

# 单独创建模型
def create_model(**options) -> ChatOpenAI:
    config = {
      "model": _settings.open_ai_model_name,
      "api_key": _settings.aliyun_api_key,
      "base_url": _settings.open_ai_baseuel,
    }

    config.update(options)
    return ChatOpenAI(**config)

def create_embeddings(**options) -> OpenAIEmbeddings:
    config = {
        "model": _settings.open_ai_embedding_name or 'text-embedding-v3',
        "api_key": _settings.aliyun_api_key,
        "base_url": _settings.open_ai_baseuel,
        "check_embedding_ctx_length": False, # 阻止底层自动使用 tiktoken 进行 Token 转换，强制发送纯文本
    }
    config.update(options)
    return OpenAIEmbeddings(**config)
