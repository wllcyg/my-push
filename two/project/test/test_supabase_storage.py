import sys
from pathlib import Path

# 将项目根目录添加到 python 路径
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from modules.core.supabase_storage import SupabaseStorageService

def main():
    print("[1/5] 开始测试 Supabase Storage 文件上传服务...\n")
    
    # 1. 实例化 SupabaseStorageService
    storage_service = SupabaseStorageService()
    
    print(f"Supabase URL: {storage_service.url}")
    print(f"Storage Bucket: {storage_service.bucket_name}")
    print(f"Key 状态: {'已配置' if storage_service.key else '未配置'}\n")
    
    if not storage_service.url or not storage_service.key:
        print("[ERROR] .env 文件中未配置 SUPABASE_URL 或 SUPABASE_KEY！")
        return

    # 2. 在本地生成一个测试文件
    test_file_path = current_dir / "test_report_sample.md"
    test_content = (
        "# Supabase Storage 测试报告\n\n"
        "这是一份自动生成的测试 Markdown 文件。\n\n"
        "- 测试时间: 2026-07-26\n"
        "- 状态: 存储桶上传功能测试\n"
    )
    
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write(test_content)
        
    print(f"[2/5] 已在本地生成临时测试文件: {test_file_path.name}")

    # 3. 调用上传服务
    remote_path = "test/test_report_sample.md"
    print(f"[3/5] 正在上传到 Supabase 存储桶路径: {remote_path} ...")
    
    public_url = storage_service.upload_file(test_file_path, remote_path)
    
    # 4. 清理本地测试文件
    if test_file_path.exists():
        test_file_path.unlink()
        print("[4/5] 本地临时测试文件已自动清理。")

    # 5. 输出结论
    if public_url:
        print("\n[SUCCESS] Supabase Storage 上传测试全部成功！")
        print(f"[URL] 报告公共访问地址: {public_url}")
    else:
        print("\n[FAILED] 上传测试失败，请检查报错日志。")

if __name__ == "__main__":
    main()
