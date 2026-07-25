import os
import sys

# 动态将项目根目录加入 python 模块搜索路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
import time
import httpx
from main import app

async def main():
    print("=" * 60)
    print("[1/5] 准备测试 Supabase 用户注册与登录 API...")
    
    timestamp = int(time.time())
    test_email = f"testuser_{timestamp}@example.com"
    test_password = "SecurePassword123!"
    test_name = f"Test User {timestamp}"

    # 使用 ASGITransport 直接在 Python 内存中进行应用级单元/集成测试
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=15.0) as client:
        # 1. 测试注册
        print(f"\n[2/5] 测试用户注册: {test_email} ...")
        reg_payload = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        reg_res = await client.post("/auth/register", json=reg_payload)
        assert reg_res.status_code == 200, f"注册请求 HTTP 失败: {reg_res.text}"
        reg_data = reg_res.json()
        print(f"      注册响应结果: {reg_data}")
        assert reg_data["code"] == 0, f"注册业务码非 0: {reg_data}"
        token = reg_data["data"]["access_token"]
        print("      ✅ 注册成功，并成功获取 Access Token！")

        # 2. 测试重复注册防护
        print("\n[3/5] 测试重复注册防护...")
        dup_res = await client.post("/auth/register", json=reg_payload)
        dup_data = dup_res.json()
        print(f"      重复注册拦截结果: {dup_data}")
        assert dup_data["code"] == 40002, "预期拦截重复注册"
        print("      ✅ 重复注册防范拦截正常！")

        # 3. 测试错误密码登录防护
        print("\n[4/5] 测试错误密码登录防范...")
        wrong_login_res = await client.post("/auth/login", json={"email": test_email, "password": "WrongPassword"})
        wrong_login_data = wrong_login_res.json()
        print(f"      错误密码响应: {wrong_login_data}")
        assert wrong_login_data["code"] == 40001, "预期提示邮箱或密码错误"
        print("      ✅ 错误密码拦截正常！")

        # 4. 测试正确密码登录
        print("\n[5/5] 测试用户正确密码登录...")
        login_res = await client.post("/auth/login", json={"email": test_email, "password": test_password})
        login_data = login_res.json()
        print(f"      登录成功响应: {login_data}")
        assert login_data["code"] == 0, f"登录失败: {login_data}"
        token = login_data["data"]["access_token"]
        print("      ✅ 用户登录成功！")

        # 5. 测试鉴权接口 /auth/me
        print("\n[6/6] 测试携带 Bearer Token 获取当前用户信息 (/auth/me)...")
        headers = {"Authorization": f"Bearer {token}"}
        me_res = await client.get("/auth/me", headers=headers)
        me_data = me_res.json()
        print(f"      /auth/me 响应: {me_data}")
        assert me_data["code"] == 0, f"获取用户信息失败: {me_data}"
        assert me_data["data"]["email"] == test_email
        print(f"      ✅ 鉴权成功！已获取当前用户: {me_data['data']['name']} ({me_data['data']['email']})")

    print("\n" + "=" * 60)
    print(" 🎉 [SUCCESS] 完整的 Supabase 用户注册、登录及鉴权测试全部通过！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
