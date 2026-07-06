from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn

# 引入我们刚写好的 ai_controller 路由
from modules.ai.ai_controller import router as ai_router

# 实例化应用主体
app = FastAPI(title="Project API with FastAPI")

# 注册模块路由（相当于 NestJS 根模块里的 imports: [AiModule]）
app.include_router(ai_router)

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
