"""
Celery + 消息队列长任务一键可执行测试脚本
==========================================
本脚本演示：
  1. 向消息队列投递长耗时 AI 生成任务 (模拟 API 网关秒级返回)
  2. 轮询/检测任务状态机 (PENDING -> SUCCESS)
  3. 获取最终生成的结果内容

运行方式（在项目根目录）：
    uv run python test/test_celery_task.py
"""

import sys
import time
from pathlib import Path

# 将项目根目录加入 Python 搜索路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.job.celery_app import generate_ai_report_task, BROKER_URL, BACKEND_URL


def main():
    print("=" * 60)
    print("🚀 开始测试 Celery + 消息队列长任务解耦方案")
    print("=" * 60)
    print(f"📌 当前配置 Broker  : {BROKER_URL.split('@')[-1]}")  # 隐藏敏感凭证密码
    print(f"📌 当前配置 Backend : {BACKEND_URL}")
    print("-" * 60)

    # 1. 模拟 API 网关接收请求，投递任务给消息队列
    test_prompt = "请你帮我写一份 200 字的关于 Python 异步编程在 AI 架构中优势的短文。"
    test_user_id = 1

    print(f"\n[1/3] 模拟 Producer 投递异步任务:")
    print(f"      输入 Prompt: '{test_prompt}'")
    start_time = time.perf_counter()

    # .delay() 异步发送到消息队列，耗时极其微小（无需等待 AI 生成完毕）
    async_res = generate_ai_report_task.delay(test_prompt, user_id=test_user_id)

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    print(f"   ⚡ 任务投递成功！分配 Task ID: {async_res.id}")
    print(f"   ⚡ API 网关完成秒级响应，投递耗时: {elapsed_ms:.2f}ms")

    # 2. 模拟前端/客户端轮询检查任务状态
    print(f"\n[2/3] 模拟 Consumer/前端 轮询任务状态 (Task ID: {async_res.id}):")

    poll_count = 0
    while not async_res.ready():
        poll_count += 1
        print(f"   ⏳ [{poll_count}] 任务状态: {async_res.state}，排队/生成中...")
        time.sleep(1.5)
        if poll_count >= 20:  # 30秒超时退出防死循环
            print("   ⚠️ 轮询超时，后台 Worker 可能未启动（请确保运行了 celery worker 命令）")
            break

    # 3. 检查最终处理结果
    if async_res.successful():
        print(f"\n[3/3] 🎉 任务执行成功 (State: {async_res.state})！")
        result = async_res.get()
        print(f"      AI 最终生成结果:\n")
        print(f"--------------------------------------------------")
        print(result.get("reply", "无输出内容"))
        print(f"--------------------------------------------------")
    elif async_res.failed():
        print(f"\n[3/3] ❌ 任务执行失败 (State: {async_res.state})")
        print(f"      失败原因: {async_res.result}")
    else:
        print(f"\n[3/3] ℹ️ 任务未在测试时间内完成，可在 Worker 开启后再次查询 Task ID: {async_res.id}")

    print("\n" + "=" * 60)
    print("🎉 Celery 异步任务测试流程完毕！")
    print("=" * 60)


if __name__ == "__main__":
    main()
