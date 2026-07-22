import httpx
from typing import Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from modules.config.settings import get_settings

class WebSearchInput(BaseModel):
    query: str = Field(description="搜索的关键词或问题描述。请确保该词精确且适合搜索引擎检索。")
    count: Optional[int] = Field(10, description="返回的搜索结果数量，默认 10 条")

_http_client = httpx.AsyncClient(timeout=10.0)

@tool('web_search', args_schema=WebSearchInput)
async def web_search(query: str, count: int = 10) -> str:
    """使用博查搜索引擎搜索网络上的最新信息和网页内容。"""
    settings = get_settings()
    api_key = settings.web_search_key
    
    if not api_key:
        return "错误：未在环境变量或 .env 中配置博查搜索 API Key (WEB_SEARCH_KEY)"
        
    url = "https://api.bochaai.com/v1/web-search"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "query": query,
        "count": count,
        "freshness": "noLimit",
        "summary": True
    }
    
    try:
        response = await _http_client.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            web_pages = data.get("data", {}).get("webPages", {}).get("value", [])
            if not web_pages:
                return f"未找到关于「{query}」的搜索结果。"
                
            results = []
            for idx, item in enumerate(web_pages, 1):
                name = item.get("name", "无标题")
                link = item.get("url", "")
                summary = item.get("summary", "无摘要")
                site_name = item.get("siteName", "未知网站")
                site_icon = item.get("siteIcon", "")
                date_crawled = item.get("dateLastCrawled", "未知时间")
                
                formatted = (
                    f"引用: {idx}\n"
                    f"标题: {name}\n"
                    f"URL: {link}\n"
                    f"摘要: {summary}\n"
                    f"网站名称: {site_name}\n"
                    f"网站图标: {site_icon}\n"
                    f"发布时间: {date_crawled}"
                )
                results.append(formatted)
                
            return "\n\n".join(results)
        else:
            return f"博查搜索请求失败，状态码: {response.status_code}，详情: {response.text}"
    except httpx.RequestError as e:
        return f"调用博查搜索接口发生网络异常: {str(e)}"
    except Exception as e:
        return f"调用博查搜索接口发生未知错误: {str(e)}"
