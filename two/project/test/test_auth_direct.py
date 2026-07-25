import os
import sys

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 强制 UTF-8 控制台输出
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from modules.config.settings import get_settings
from modules.auth.auth_service import AuthService, decode_token
from modules.auth.auth_dto import RegisterDto, LoginDto
from modules.core.response import APIException

async def main():
    print("=" * 60)
    print("[1/5] 连接 Supabase 数据库...")
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    timestamp = int(time.time())
    test_email = f"direct_test_{timestamp}@example.com"
    test_password = "MySecurePassword123!"
    test_name = f"Direct Test User {timestamp}"

    async with async_session() as session:
        auth_service = AuthService(session)

        # 1. 测试注册服务
        print(f"\n[2/5] 测试用户注册: {test_email} ...")
        reg_dto = RegisterDto(email=test_email, password=test_password, name=test_name)
        res_token = await auth_service.register(reg_dto)
        await session.commit()

        print(f"      [OK] 注册成功！分配用户 ID: {res_token.user.id}")
        print(f"      AccessToken: {res_token.access_token[:25]}...")

        # 2. 测试重复注册拦截
        print("\n[3/5] 测试重复注册防范...")
        try:
            await auth_service.register(reg_dto)
            assert False, "未能拦截重复注册"
        except APIException as e:
            print(f"      [OK] 成功拦截重复注册，异常拦截信息: code={e.code}, msg='{e.message}'")

        # 3. 测试错误密码登录
        print("\n[4/5] 测试错误密码登录防范...")
        wrong_login = LoginDto(email=test_email, password="WrongPassword")
        try:
            await auth_service.login(wrong_login)
            assert False, "未能拦截错误密码"
        except APIException as e:
            print(f"      [OK] 成功拦截错误密码，异常拦截信息: code={e.code}, msg='{e.message}'")

        # 4. 测试正确密码登录与 Token 解析
        print("\n[5/5] 测试正确密码登录与 Bearer Token 验证...")
        login_dto = LoginDto(email=test_email, password=test_password)
        login_res = await auth_service.login(login_dto)
        assert login_res.user.email == test_email
        print(f"      [OK] 登录校验成功！已签发有效 Token。")

        payload = decode_token(login_res.access_token)
        print(f"      [OK] Token 解码负载验证: sub={payload['sub']}, email={payload['email']}")

    await engine.dispose()
    print("\n" + "=" * 60)
    print(" [SUCCESS] Supabase 注册登录与 Auth 模块核心业务测试全部通过！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
