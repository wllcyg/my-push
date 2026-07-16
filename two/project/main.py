import sys
import asyncio
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn

from modules.core.response import APIException

# 确保在 Windows 控制台输出 UTF-8，防止 GBK 编码报错
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ✅ Windows 上 ProactorEventLoop 与异步 SSL 有兼容性问题，切换为 SelectorEventLoop
# 这对 uvicorn 使用 asyncmy 连接 TiDB Cloud（需要 SSL）是必须的
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 引入我们刚写好的 ai_controller 路由
from modules.ai.ai_controller import router as ai_router
# 引入用户模块路由
from modules.user.user_controller import router as user_router

# 实例化应用主体
app = FastAPI(title="Project API with FastAPI")

# 注册模块路由（相当于 NestJS 根模块里的 imports: [AiModule, UserModule]）
app.include_router(ai_router)
app.include_router(user_router)

# 注册全局异常拦截
@app.exception_handler(APIException)
async def api_exception_handler(request: Request, exc: APIException):
    return JSONResponse(
        status_code=200,
        content={"code": exc.code, "message": exc.message, "data": None}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"code": 99999, "message": "服务器内部错误", "data": None}
    )

# 挂载静态文件目录 (相当于 NestJS 的 ServeStaticModule)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {"message": "Hello from project! FastAPI is running."}

def print_routes(routes):
    for route in routes:
        # 如果是具体的 HTTP 路由
        if hasattr(route, "methods") and hasattr(route, "path"):
            methods = ", ".join(route.methods)
            print(f"[{methods}] {route.path}")
        # 如果是嵌套的路由组 (如新版 FastAPI 的 _IncludedRouter)
        elif hasattr(route, "routes"):
            print_routes(route.routes)

@app.on_event("startup")
def startup_event():
    print("\n====== 🚀 已注册的路由列表 ======")
    print_routes(app.routes)
    print("================================\n")

def main():
    # 使用 uvicorn 启动服务，支持热更新
    print("正在启动 FastAPI 服务...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
