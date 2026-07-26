import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from modules.core.logger import logger
from modules.core.logger import AxiomLogSink

def test_axiom():
    print("[1/3] 初始化 Axiom 日志测试...")
    sink = AxiomLogSink()
    print(f"Axiom Dataset: {sink.dataset}")
    print(f"Axiom Token 配置状态: {'已配置并开启' if sink.enabled else '未配置 Token (请在 .env 中填入 AXIOM_TOKEN)'}\n")
    
    print("[2/3] 发送模拟后端运行日志...")
    logger.info("后端服务启动成功，系统就绪。")
    logger.warning("这是一条模拟的 Warning 警报日志")
    
    try:
        1 / 0
    except Exception as e:
        logger.exception("模拟后端的 Exception 崩溃日志已被 Loguru 捕获并推送到 Axiom")

    import time
    time.sleep(0.5)

    print("\n[直连测试] 正在向 Axiom 发送诊断日志包...")
    test_payload = [{
        "_time": "2026-07-26T14:26:00Z",
        "level": "INFO",
        "message": "Axiom 诊断直连测试消息",
        "environment": "development"
    }]
    sink._send_to_axiom(test_payload)

    print("\n[3/3] 本地日志测试执行完毕！")

if __name__ == "__main__":
    test_axiom()
