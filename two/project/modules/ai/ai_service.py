from modules.core.llm import default_model
from modules.config.settings import get_settings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

class AiService:
    """
    Service 层：只负责核心业务逻辑。
    """
    def generate_reply(self, prompt: str) -> dict:
        # 获取全局配置
        settings = get_settings()
        app_name = settings.app_name

        # 调用全局默认的 LLM 实例
        # 注意：LangChain 的 invoke 返回的是一个 AIMessage 对象，内容在 .content 属性里
        # 1. 使用 {变量名} 的语法在字符串中进行“变量插值”
        # 注意：不要把它命名为 prompt，否则会覆盖掉接收到的客户端参数 prompt
        prompt_template = PromptTemplate.from_template("请你作为一个专业的 AI 助手，详细回答以下问题：\n\n{user_question}")
        
        # 2. 使用 LangChain 的 LCEL 语法（管道符 |）将 模板、大模型、输出解析器 串联起来
        chain = prompt_template | default_model | StrOutputParser()

        # 3. 运行这条链，并在字典里把真实的值赋给插值变量
        reply_text = chain.invoke({"user_question": prompt})

        return {
            "status": "success",
            "app_name": app_name,
            "prompt": prompt,
            "reply": reply_text
        }

    def generate_reply_stream(self, prompt: str):
        """
        流式输出业务逻辑：使用 chain.stream() 获取生成器
        """
        prompt_template = PromptTemplate.from_template("请你作为一个专业的 AI 助手，详细回答以下问题：\n\n{user_question}")
        chain = prompt_template | default_model | StrOutputParser()
        
        # .stream() 返回的是一个生成器(Generator)，会一段一段地吐出文本
        return chain.stream({"user_question": prompt})
