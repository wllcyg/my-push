from langchain_openai import ChatOpenAI
from modules.config.settings import get_settings

# 拿到所以得配置项
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
