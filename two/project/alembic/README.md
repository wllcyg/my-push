# 数据库迁移使用文档（Alembic）

Alembic 是 SQLAlchemy 的数据库迁移工具，相当于 TypeORM 的 Migration 功能。

---

## 📁 目录结构

```
alembic/
├── env.py           # Alembic 核心配置（连接数据库、指定 Entity）
├── versions/        # 存放所有迁移文件（自动生成，不要手动修改）
└── README.md        # 本文档
alembic.ini          # Alembic 基础配置文件
```

---

## 🚀 日常使用流程

### 场景一：新增 / 修改 Entity 字段后，同步到数据库

```bash
# 第一步：自动检测变化，生成迁移文件
# -m 后面的描述会成为文件名，写清楚改了什么
uv run alembic revision --autogenerate -m "add phone to users"

# 第二步：检查生成的迁移文件（在 alembic/versions/ 下），确认内容正确

# 第三步：执行迁移，更新数据库
uv run alembic upgrade head
```

### 场景二：查看当前数据库版本

```bash
uv run alembic current
```

### 场景三：查看所有迁移历史

```bash
uv run alembic history --verbose
```

### 场景四：回滚（撤销上一次迁移）

```bash
# 回滚一步
uv run alembic downgrade -1

# 回滚到指定版本（版本号在 alembic/versions/ 文件名中）
uv run alembic downgrade d64a0057a026
```

---

## ➕ 新增 Entity 时的注意事项

每次新建一个 Entity 文件（如 `modules/order/order_entity.py`），必须同步在
`alembic/env.py` 顶部添加 import，否则 autogenerate 不会检测到新表：

```python
# alembic/env.py
from modules.user.user_entity import User    # 已有
from modules.order.order_entity import Order  # 新增 ← 必须加这行
```

然后正常走场景一的流程即可。

---

## ⚠️ 注意事项

| 事项 | 说明 |
|------|------|
| **不要手动修改** `alembic/versions/` 下的文件 | 除非你非常清楚自己在做什么 |
| **执行前先检查**生成的迁移文件 | autogenerate 偶尔会误判，尤其是索引和约束 |
| **不要在生产环境**直接 `upgrade head` | 先在测试环境验证，再操作生产库 |
| `downgrade` 有风险 | 回滚可能导致数据丢失，操作前请备份 |

---

## 🔄 与 TypeORM Migration 对照

| TypeORM | Alembic | 说明 |
|---------|---------|------|
| `migration:generate` | `alembic revision --autogenerate -m "xxx"` | 自动生成迁移文件 |
| `migration:run` | `alembic upgrade head` | 执行所有待执行的迁移 |
| `migration:revert` | `alembic downgrade -1` | 回滚最近一次迁移 |
| `migration:show` | `alembic history` | 查看迁移历史 |
| `synchronize: true` | ❌ 不推荐在生产使用 | 仅开发阶段用 `init_db.py` 代替 |
