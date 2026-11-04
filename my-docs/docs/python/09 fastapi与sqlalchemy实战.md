# Python FastAPI + SQLAlchemy + MySQL 实战 - 深度教程

> 这一章把前面所有内容串起来：用 **FastAPI** 写接口，用 **SQLAlchemy 2.0（异步）** 操作 **MySQL**，
> 用 **Alembic** 管理表结构变更，用 **pytest** 测试。示例是"汽车售后管理系统"里最核心的三张表：
> 客户（customer）、车辆（vehicle）、工单（work_order）。
>
> 你 `my-push/two/project` 里的代码已经是同样的分层思路（controller / service / entity / dto），
> 本章的代码风格与它保持一致，方便对照阅读。

## 目录

1. 项目结构与依赖
2. 最小的 FastAPI 应用
3. 路径参数、查询参数、请求体
4. 依赖注入 Depends
5. 数据库连接：engine 与 session
6. 定义模型：表、外键、索引、关系
7. Pydantic 模型：入参与出参
8. Service 层：增删改查、分页、联表、聚合
9. 路由层：把 service 暴露成接口
10. 应用入口：CORS、异常处理、lifespan
11. 事务、N+1 问题与加载策略
12. Alembic：数据库迁移
13. 造 10 万条数据并用 EXPLAIN 优化
14. 用 pytest 测试接口
15. 和 NestJS / TypeORM 对照
16. 练习题
17. 学习检查清单

---

## 项目结构与依赖

```bash
uv init aftersales-api && cd aftersales-api
uv add fastapi "uvicorn[standard]" "sqlalchemy[asyncio]>=2.0" asyncmy alembic pydantic-settings
uv add --dev pytest pytest-asyncio httpx aiosqlite
```

- `sqlalchemy[asyncio]`：**一定要带 `[asyncio]`**。新版 SQLAlchemy 不再默认附带 `greenlet`，
  不带的话 `import sqlalchemy.ext.asyncio` 会直接报
  `The SQLAlchemy asyncio module requires that the Python 'greenlet' library is installed`。
- `asyncmy`：MySQL 的异步驱动（`two/project` 里也在用；`aiomysql` 是另一个选择）。
- `aiosqlite`：只用于测试时在内存里跑 SQLite，不用起 MySQL。

```
aftersales-api/
├── pyproject.toml
├── .env
├── alembic.ini
├── alembic/
├── app/
│   ├── __init__.py
│   ├── database.py       # 引擎、会话、Base
│   ├── models.py         # ORM 模型（≈ Entity）
│   ├── schemas.py        # Pydantic 模型（≈ DTO）
│   ├── services.py       # 业务逻辑（≈ Service）
│   ├── routers.py        # 路由（≈ Controller）
│   └── main.py           # FastAPI 入口
└── tests/
    └── test_api.py
```

> 示例为了便于阅读，把每一层放在一个文件里。业务模块多了以后，按 07 章推荐的结构，
> 拆成 `modules/customer/`、`modules/work_order/` 各自一套。

---

## 最小的 FastAPI 应用

```python
# hello.py
from fastapi import FastAPI

app = FastAPI(title="Demo")

@app.get("/ping")
async def ping():
    return {"message": "pong"}
```

```bash
uv run uvicorn hello:app --reload      # --reload：改代码自动重启，开发时使用
```

启动后访问：

- `http://127.0.0.1:8000/ping`：接口本身
- `http://127.0.0.1:8000/docs`：**自动生成的 Swagger 文档**，可以直接在页面里调试
- `http://127.0.0.1:8000/openapi.json`：OpenAPI 描述，可用于生成前端的请求代码

接口文档来自你写的类型注解和 Pydantic 模型，不需要另外维护。

---

## 路径参数、查询参数、请求体

FastAPI 根据**参数在函数签名里的写法**自动判断它来自哪里：

```python
from fastapi import FastAPI, Query
from pydantic import BaseModel

app = FastAPI()

class ItemIn(BaseModel):
    name: str
    price: float

@app.get("/items/{item_id}")                    # 路径里有 {item_id}  → 路径参数
async def get_item(
    item_id: int,                               # 自动校验并转换成 int，传 abc 会返回 422
    q: str | None = None,                       # 有默认值的简单类型 → 查询参数  ?q=xxx
    page: int = Query(1, ge=1),                 # 用 Query 追加校验规则
    size: int = Query(20, ge=1, le=100),
):
    return {"item_id": item_id, "q": q, "page": page, "size": size}

@app.post("/items", status_code=201)            # 参数类型是 BaseModel → 请求体（JSON）
async def create_item(item: ItemIn):
    return item
```

对应 NestJS 的 `@Param()`、`@Query()`、`@Body()`，只是不需要装饰器，靠类型自动识别。

校验失败时 FastAPI 自动返回 **422**，并带上详细的错误位置和原因，不用你写 `if` 判断。

---

## 依赖注入 Depends

`Depends` 是 FastAPI 的依赖注入机制：把"每次请求都需要的东西"（数据库会话、当前用户、分页参数）
抽成函数，路由里声明即可拿到。

```python
from fastapi import Depends, FastAPI, Header, HTTPException

app = FastAPI()

# 例 1：公共的分页参数
class Pagination:
    def __init__(self, page: int = 1, size: int = 20):
        self.page, self.size = page, size
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

@app.get("/a")
async def a(p: Pagination = Depends()):
    return {"offset": p.offset, "limit": p.size}

# 例 2：简易鉴权
async def current_user(authorization: str | None = Header(None)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="未登录")
    return {"id": 1, "name": "Alice"}

@app.get("/me")
async def me(user: dict = Depends(current_user)):
    return user
```

### 带 yield 的依赖：自动清理资源

```python
async def get_db():
    async with AsyncSessionFactory() as session:   # 请求开始：创建会话
        yield session                               # 路由函数拿到 session 使用
    # 请求结束：离开 async with，自动关闭会话
```

这就是 08 章学的"异步生成器 + async with"，也是 FastAPI 管理数据库会话的标准写法。

---

## 数据库连接：engine 与 session

```python
# 文件: app/database.py
import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+asyncmy://root:123456@localhost:3306/aftersales?charset=utf8mb4",
)

engine = create_async_engine(
    DATABASE_URL,
    pool_size=5,            # 连接池常驻连接数
    max_overflow=10,        # 高峰时最多再临时开多少个
    pool_recycle=300,       # 连接超过 300 秒就回收，避免 MySQL 主动断开空闲连接后报 "gone away"
    pool_pre_ping=True,     # 每次取连接前先探活，失效的自动重连
    echo=False,             # 调试时改 True，会把执行的 SQL 打印出来
)

AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionFactory() as session:
        yield session
```

要点：

- **连接串格式**：`mysql+asyncmy://用户:密码@主机:端口/库名?charset=utf8mb4`。
  **`charset=utf8mb4` 一定要带**，否则存不了 emoji 和部分生僻汉字。
- 密码里有 `@`、`#` 等特殊字符时，要做 URL 编码（`urllib.parse.quote_plus`）。
- `expire_on_commit=False`：提交后对象属性不会过期，异步环境下避免触发隐式的懒加载查询报错。
- **一个请求对应一个 session**，用完关闭，不要把 session 放成全局变量复用。
- 生产环境连接串从环境变量或 `pydantic-settings` 读取，不要写死在代码里。

先在本地起一个 MySQL：

```bash
docker run -d --name mysql8 -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=aftersales \
  mysql:8 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

---

## 定义模型：表、外键、索引、关系

SQLAlchemy 2.0 推荐的写法：`Mapped[类型]` + `mapped_column()`，类型注解同时决定列类型和是否可为空。

```python
# 文件: app/models.py
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customer"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20), unique=True)      # 唯一约束，会自动建唯一索引
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 一对多：一个客户有多辆车
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="customer")


class Vehicle(Base):
    __tablename__ = "vehicle"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vin: Mapped[str] = mapped_column(String(17), unique=True)         # 车架号 17 位
    plate: Mapped[str | None] = mapped_column(String(20))              # 可以为空
    customer_id: Mapped[int] = mapped_column(ForeignKey("customer.id"), index=True)

    customer: Mapped["Customer"] = relationship(back_populates="vehicles")
    orders: Mapped[list["WorkOrder"]] = relationship(back_populates="vehicle")


class WorkOrder(Base):
    __tablename__ = "work_order"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicle.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="open")    # open / in_progress / closed
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0) # 金额用 Decimal，不要用 float
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    vehicle: Mapped["Vehicle"] = relationship(back_populates="orders")

    # 联合索引：常见查询是"按状态筛选，再按创建时间排序"
    __table_args__ = (
        Index("idx_wo_status_created", "status", "created_at"),
    )
```

设计要点（可以对照 MySQL 学习阶段的内容）：

- **外键列加索引**（`index=True`）：JOIN 和按外键过滤都会用到，不加会全表扫描。
- **联合索引的列顺序**：`(status, created_at)`，等值条件的列放前面，范围/排序列放后面（最左前缀原则）。
- **金额用 `Numeric`/`Decimal`**，不要用浮点数，否则 0.1 + 0.2 之类的精度问题会出现在账上。
- `server_default=func.now()` 由数据库填默认值；`default=...` 由 Python 在插入时填。

### 关系的两种读法

```python
customer.vehicles      # 这个客户的所有车辆（list）
vehicle.customer       # 这辆车的车主（单个对象）
```

`relationship` 只是 ORM 层的便捷访问，真正在数据库里存在的只有外键列。

---

## Pydantic 模型：入参与出参

```python
# 文件: app/schemas.py
from datetime import datetime
from decimal import Decimal
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=6, max_length=20)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)      # 允许直接从 ORM 对象读取属性
    id: int
    name: str
    phone: str


class VehicleCreate(BaseModel):
    vin: str = Field(min_length=17, max_length=17)
    plate: str | None = None
    customer_id: int = Field(gt=0)


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vin: str
    plate: str | None
    customer_id: int


class WorkOrderCreate(BaseModel):
    vehicle_id: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)


class WorkOrderStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "closed"]


class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int
    status: str
    description: str
    amount: Decimal
    created_at: datetime


class Page(BaseModel, Generic[T]):
    """通用分页响应"""
    total: int
    page: int
    size: int
    items: list[T]


class CustomerSummary(BaseModel):
    """联表聚合统计：每个客户的工单数量与总金额"""
    customer_id: int
    name: str
    order_count: int
    total_amount: Decimal
```

**为什么要把 ORM 模型（models）和 Pydantic 模型（schemas）分开？**

- ORM 模型对应**表结构**，包含密码哈希、内部字段等不能返回给前端的东西。
- Pydantic 模型对应**接口契约**，只暴露需要的字段，入参和出参可以不同
  （创建时没有 `id`，返回时才有）。
- 修改表结构不会直接影响接口，反之亦然。

---

## Service 层：增删改查、分页、联表、聚合

SQLAlchemy 2.0 统一使用 `select()` / `insert()` / `update()` / `delete()` 构造语句，
再交给 `session.execute()` 或 `session.scalars()`。

```python
# 文件: app/services.py
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, schemas


class NotFoundError(Exception):
    def __init__(self, what: str, id: int):
        super().__init__(f"{what} {id} 不存在")


class ConflictError(Exception):
    pass


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, dto: schemas.CustomerCreate) -> models.Customer:
        customer = models.Customer(name=dto.name, phone=dto.phone)
        self.db.add(customer)
        try:
            await self.db.commit()                  # 提交事务；唯一约束冲突会在这里抛出
        except IntegrityError:
            await self.db.rollback()
            raise ConflictError(f"手机号 {dto.phone} 已存在")
        await self.db.refresh(customer)             # 刷新，拿到数据库生成的 id 等字段
        return customer

    async def get(self, id: int) -> models.Customer:
        customer = await self.db.get(models.Customer, id)       # 按主键查，最快
        if customer is None:
            raise NotFoundError("客户", id)
        return customer

    async def search(self, keyword: str | None, page: int, size: int) -> schemas.Page:
        stmt = select(models.Customer)
        if keyword:
            stmt = stmt.where(models.Customer.name.like(f"%{keyword}%"))
        return await paginate(self.db, stmt, models.Customer.id.desc(), page, size)

    async def summary(self) -> list[schemas.CustomerSummary]:
        """联表 + 聚合：相当于
        SELECT c.id, c.name, COUNT(w.id), COALESCE(SUM(w.amount), 0)
        FROM customer c
        LEFT JOIN vehicle v   ON v.customer_id = c.id
        LEFT JOIN work_order w ON w.vehicle_id = v.id
        GROUP BY c.id, c.name
        ORDER BY SUM(w.amount) DESC
        """
        total = func.coalesce(func.sum(models.WorkOrder.amount), 0)
        stmt = (
            select(
                models.Customer.id,
                models.Customer.name,
                func.count(models.WorkOrder.id),
                total,
            )
            .select_from(models.Customer)
            .outerjoin(models.Vehicle, models.Vehicle.customer_id == models.Customer.id)
            .outerjoin(models.WorkOrder, models.WorkOrder.vehicle_id == models.Vehicle.id)
            .group_by(models.Customer.id, models.Customer.name)
            .order_by(total.desc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            schemas.CustomerSummary(
                customer_id=r[0], name=r[1], order_count=r[2], total_amount=Decimal(r[3])
            )
            for r in rows
        ]


class VehicleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, dto: schemas.VehicleCreate) -> models.Vehicle:
        if await self.db.get(models.Customer, dto.customer_id) is None:
            raise NotFoundError("客户", dto.customer_id)
        vehicle = models.Vehicle(**dto.model_dump())      # 字典解包成关键字参数
        self.db.add(vehicle)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictError(f"车架号 {dto.vin} 已存在")
        await self.db.refresh(vehicle)
        return vehicle


class WorkOrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, dto: schemas.WorkOrderCreate) -> models.WorkOrder:
        if await self.db.get(models.Vehicle, dto.vehicle_id) is None:
            raise NotFoundError("车辆", dto.vehicle_id)
        order = models.WorkOrder(**dto.model_dump(), status="open")
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def get(self, id: int) -> models.WorkOrder:
        order = await self.db.get(models.WorkOrder, id)
        if order is None:
            raise NotFoundError("工单", id)
        return order

    async def list(self, status: str | None, page: int, size: int) -> schemas.Page:
        stmt = select(models.WorkOrder)
        if status:
            stmt = stmt.where(models.WorkOrder.status == status)
        return await paginate(self.db, stmt, models.WorkOrder.id.desc(), page, size)

    async def update_status(self, id: int, status: str) -> models.WorkOrder:
        order = await self.get(id)
        order.status = status                         # 直接改属性，提交时自动生成 UPDATE
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def delete(self, id: int) -> None:
        order = await self.get(id)
        await self.db.delete(order)
        await self.db.commit()

    async def vehicle_with_orders(self, vehicle_id: int) -> models.Vehicle:
        """一次性把车辆和它的所有工单查出来（避免 N+1，见后文）"""
        stmt = (
            select(models.Vehicle)
            .where(models.Vehicle.id == vehicle_id)
            .options(selectinload(models.Vehicle.orders))
        )
        vehicle = (await self.db.scalars(stmt)).one_or_none()
        if vehicle is None:
            raise NotFoundError("车辆", vehicle_id)
        return vehicle


async def paginate(db: AsyncSession, stmt, order_by, page: int, size: int) -> schemas.Page:
    """通用分页：先 COUNT，再 LIMIT/OFFSET"""
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await db.scalars(stmt.order_by(order_by).offset((page - 1) * size).limit(size))
    ).all()
    return schemas.Page(total=total, page=page, size=size, items=list(rows))
```

### 常用查询写法速查

```python
from sqlalchemy import select, update, delete, and_, or_, func

# 查全部 / 单个
rows = (await db.scalars(select(User))).all()                       # list[User]
one  = (await db.scalars(select(User).where(User.id == 1))).one_or_none()
by_pk = await db.get(User, 1)                                       # 按主键

# 条件
select(Order).where(Order.status == "open", Order.amount > 100)     # 多个条件默认 AND
select(Order).where(or_(Order.status == "open", Order.status == "in_progress"))
select(Order).where(Order.status.in_(["open", "closed"]))
select(Customer).where(Customer.name.like("张%"))
select(Order).where(Order.created_at.between(start, end))
select(Order).where(Order.description.is_(None))

# 排序、分页
select(Order).order_by(Order.created_at.desc()).limit(20).offset(40)

# 只取部分列（返回元组而不是对象）
rows = (await db.execute(select(Customer.id, Customer.name))).all()

# 聚合
await db.scalar(select(func.count(Order.id)))
await db.scalar(select(func.sum(Order.amount)).where(Order.status == "closed"))

# 批量更新 / 删除（一条 SQL，不用先查出对象）
await db.execute(update(Order).where(Order.status == "open").values(status="closed"))
await db.execute(delete(Order).where(Order.created_at < cutoff))
await db.commit()
```

### 打印 SQL，学会看 ORM 生成了什么

```python
stmt = select(models.WorkOrder).where(models.WorkOrder.status == "open")
print(stmt)                                     # 打印 SQL 模板
# 或把 create_async_engine(..., echo=True)，运行时所有 SQL 都会输出
```

---

## 路由层：把 service 暴露成接口

```python
# 文件: app/routers.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.database import get_db
from app.services import CustomerService, VehicleService, WorkOrderService

customer_router = APIRouter(prefix="/customers", tags=["客户"])
vehicle_router = APIRouter(prefix="/vehicles", tags=["车辆"])
order_router = APIRouter(prefix="/orders", tags=["工单"])


# 依赖提供者：每个请求用同一个 session 创建 service（对应 NestJS 的依赖注入）
def customer_service(db: AsyncSession = Depends(get_db)) -> CustomerService:
    return CustomerService(db)

def vehicle_service(db: AsyncSession = Depends(get_db)) -> VehicleService:
    return VehicleService(db)

def order_service(db: AsyncSession = Depends(get_db)) -> WorkOrderService:
    return WorkOrderService(db)


# ---------- 客户 ----------
@customer_router.post("", response_model=schemas.CustomerOut, status_code=201)
async def create_customer(dto: schemas.CustomerCreate, svc: CustomerService = Depends(customer_service)):
    return await svc.create(dto)

@customer_router.get("/summary", response_model=list[schemas.CustomerSummary])
async def customer_summary(svc: CustomerService = Depends(customer_service)):
    return await svc.summary()

@customer_router.get("", response_model=schemas.Page[schemas.CustomerOut])
async def search_customers(
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    svc: CustomerService = Depends(customer_service),
):
    return await svc.search(keyword, page, size)

@customer_router.get("/{id}", response_model=schemas.CustomerOut)
async def get_customer(id: int, svc: CustomerService = Depends(customer_service)):
    return await svc.get(id)


# ---------- 车辆 ----------
@vehicle_router.post("", response_model=schemas.VehicleOut, status_code=201)
async def create_vehicle(dto: schemas.VehicleCreate, svc: VehicleService = Depends(vehicle_service)):
    return await svc.create(dto)


# ---------- 工单 ----------
@order_router.post("", response_model=schemas.WorkOrderOut, status_code=201)
async def create_order(dto: schemas.WorkOrderCreate, svc: WorkOrderService = Depends(order_service)):
    return await svc.create(dto)

@order_router.get("", response_model=schemas.Page[schemas.WorkOrderOut])
async def list_orders(
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    svc: WorkOrderService = Depends(order_service),
):
    return await svc.list(status, page, size)

@order_router.get("/{id}", response_model=schemas.WorkOrderOut)
async def get_order(id: int, svc: WorkOrderService = Depends(order_service)):
    return await svc.get(id)

@order_router.patch("/{id}/status", response_model=schemas.WorkOrderOut)
async def update_order_status(
    id: int, dto: schemas.WorkOrderStatusUpdate, svc: WorkOrderService = Depends(order_service)
):
    return await svc.update_status(id, dto.status)

@order_router.delete("/{id}", status_code=204)
async def delete_order(id: int, svc: WorkOrderService = Depends(order_service)):
    await svc.delete(id)
```

`response_model` 的作用：**按它过滤和转换返回值**。即使 service 返回了包含内部字段的 ORM 对象，
接口也只会输出 `WorkOrderOut` 里声明的字段，同时它也是 Swagger 文档里"响应示例"的来源。

---

## 应用入口：CORS、异常处理、lifespan

```python
# 文件: app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import engine
from app.routers import customer_router, order_router, vehicle_router
from app.services import ConflictError, NotFoundError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行（创建调度器、预热缓存等）
    yield
    # 关闭时执行：释放连接池
    await engine.dispose()


app = FastAPI(title="售后管理系统 API", lifespan=lifespan)

# 跨域：Vue 前端开发服务器（如 http://localhost:5173）调用接口时需要
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],      # 生产环境写明确的域名，不要用 "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理：把业务异常统一转成 HTTP 响应（≈ NestJS 的 ExceptionFilter）
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"code": 404, "message": str(exc)})

@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"code": 409, "message": str(exc)})


app.include_router(customer_router)
app.include_router(vehicle_router)
app.include_router(order_router)
```

运行与调试：

```bash
uv run uvicorn app.main:app --reload --port 8000
# 打开 http://127.0.0.1:8000/docs 在页面里试接口
```

---

## 事务、N+1 问题与加载策略

### 事务

`AsyncSession` 默认在第一次执行语句时开启事务，**`commit()` 才真正提交**，出错要 `rollback()`。

```python
async def transfer_parts(db: AsyncSession, part_id: int, qty: int, order_id: int):
    """扣库存 + 记录领用：两步要么都成功，要么都失败"""
    try:
        part = await db.get(Part, part_id, with_for_update=True)   # 行锁，防止并发超卖
        if part.stock < qty:
            raise ValueError("库存不足")
        part.stock -= qty
        db.add(PartUsage(order_id=order_id, part_id=part_id, qty=qty))
        await db.commit()
    except Exception:
        await db.rollback()
        raise
```

两种常见做法：

1. **Service 里显式 `commit()`**（本章的写法）：一目了然。
2. **在 `get_db` 依赖里统一提交/回滚**（`two/project` 的写法）：路由函数里不用写 commit，但要注意
   提交发生的时机，复杂场景下不如显式提交容易排查。

用 `async with db.begin():` 也可以：块内正常结束自动提交，抛异常自动回滚。

### N+1 问题

```python
# ❌ 查 100 个客户，再逐个访问 .vehicles，会额外执行 100 次查询（共 101 次）
customers = (await db.scalars(select(Customer).limit(100))).all()
for c in customers:
    print(c.vehicles)          # 异步环境下这里甚至会直接报错 MissingGreenlet（不允许隐式懒加载）

# ✅ 用 selectinload 预加载：总共 2 条 SQL
stmt = select(Customer).options(selectinload(Customer.vehicles)).limit(100)
customers = (await db.scalars(stmt)).all()
for c in customers:
    print(c.vehicles)          # 已经加载好了
```

| 加载策略 | 做法 | 适用 |
|---|---|---|
| `selectinload` | 额外一条 `WHERE id IN (...)` 查询 | **一对多**，首选 |
| `joinedload` | 用 JOIN 一次查出 | 多对一 / 一对一 |
| 懒加载（默认） | 访问时才查 | **异步环境基本不能用**，一律显式预加载 |

**异步 SQLAlchemy 里不能触发隐式懒加载**，访问没加载的关系属性会抛 `MissingGreenlet`，
这是新手最常遇到的报错，解决办法就是查询时加 `options(selectinload(...))`。

---

## Alembic：数据库迁移

不要靠 `Base.metadata.create_all()` 维护生产库：它只能建新表，**不能改已存在的表**。
Alembic 记录每一次表结构变更，可以升级、回滚，相当于数据库的 Git。

```bash
uv run alembic init -t async alembic        # 生成异步模板；两个项目已经有 alembic/ 目录的可跳过
```

修改 `alembic/env.py`，让它认识你的模型和连接串：

```python
# alembic/env.py（只列出需要改的部分）
from app.database import Base, DATABASE_URL
from app import models                       # noqa: F401  必须导入，否则 Base.metadata 是空的

config.set_main_option("sqlalchemy.url", DATABASE_URL)
target_metadata = Base.metadata
```

日常流程：

```bash
# 1. 修改 models.py 之后，自动生成迁移脚本
uv run alembic revision --autogenerate -m "add work_order table"

# 2. 打开 alembic/versions/xxxx_add_work_order_table.py 人工检查一遍！
#    autogenerate 不是万能的：改列名会被识别成"删旧列+建新列"，会丢数据

# 3. 执行迁移
uv run alembic upgrade head

# 其他常用命令
uv run alembic current            # 当前版本
uv run alembic history            # 迁移历史
uv run alembic downgrade -1       # 回滚一步
```

**团队约定：迁移脚本要提交到 Git；表结构只通过迁移改，不要手动在数据库里改。**

---

## 造 10 万条数据并用 EXPLAIN 优化

这是把 MySQL 学习和项目结合最有价值的一步，结果可以直接写进简历。

### 批量造数据

```python
# 文件: scripts/seed.py
import asyncio
import random

from sqlalchemy import insert

from app.database import AsyncSessionFactory
from app.models import Customer, Vehicle, WorkOrder

STATUSES = ["open", "in_progress", "closed"]


async def seed(customers=2_000, vehicles_per=2, orders_per=25):
    async with AsyncSessionFactory() as db:
        # 批量插入：一条 INSERT 带多行，比循环 add() 快几十倍
        await db.execute(
            insert(Customer),
            [{"name": f"客户{i}", "phone": f"1380000{i:05d}"} for i in range(customers)],
        )
        await db.commit()

        await db.execute(
            insert(Vehicle),
            [
                {"vin": f"VIN{c:05d}{v:09d}", "plate": f"沪A{c:04d}{v}", "customer_id": c + 1}
                for c in range(customers)
                for v in range(vehicles_per)
            ],
        )
        await db.commit()

        total_vehicles = customers * vehicles_per
        batch = []
        for vid in range(1, total_vehicles + 1):
            for _ in range(orders_per):
                batch.append(
                    {
                        "vehicle_id": vid,
                        "status": random.choice(STATUSES),
                        "description": "保养/维修项目",
                        "amount": round(random.uniform(50, 5000), 2),
                    }
                )
            if len(batch) >= 5_000:                      # 分批提交，避免一次占用太多内存
                await db.execute(insert(WorkOrder), batch)
                await db.commit()
                batch.clear()
        if batch:
            await db.execute(insert(WorkOrder), batch)
            await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())          # 2000 客户 × 2 车 × 25 工单 = 10 万条工单
```

```bash
uv run python -m scripts.seed
```

### 故意写慢查询，再用 EXPLAIN 分析

在 MySQL 客户端（DBeaver、命令行）里：

```sql
-- 1. 先看没有合适索引时的执行计划
EXPLAIN SELECT * FROM work_order
WHERE status = 'open' AND amount > 4000
ORDER BY created_at DESC LIMIT 20;
```

重点看这几列：

| 列 | 关注什么 |
|---|---|
| `type` | `ALL` 是全表扫描（差）；`ref`、`range`、`const` 好 |
| `key` | 实际用到的索引，`NULL` 表示没用索引 |
| `rows` | 预估要扫描的行数，越小越好 |
| `Extra` | 出现 `Using filesort`（额外排序）、`Using temporary`（临时表）要警惕；`Using index` 是覆盖索引，很好 |

```sql
-- 2. 建议的优化：按"等值条件在前，排序列在后"建联合索引
CREATE INDEX idx_wo_status_created ON work_order (status, created_at);

-- 3. 再次 EXPLAIN，对比 type / key / rows / Extra
EXPLAIN SELECT * FROM work_order
WHERE status = 'open'
ORDER BY created_at DESC LIMIT 20;
```

可以记录一张前后对比表放进你的项目文档：

| 场景 | 优化前 | 优化后 |
|---|---|---|
| 按状态筛选 + 按时间倒序取前 20 | type=ALL，rows≈10 万，filesort | type=ref，rows 大幅下降，无 filesort |
| 深分页 `OFFSET 90000 LIMIT 20` | 很慢（要先扫过前 9 万行） | 改用"游标分页"：`WHERE id < 上一页最后一个 id ORDER BY id DESC LIMIT 20` |

> 具体数字以你本机实际测出来的为准，面试时讲的是**你怎么发现问题、怎么验证优化**，而不是背数字。

### 在 Python 里测耗时

```python
import time

async def timed_query(db, stmt):
    start = time.perf_counter()
    rows = (await db.scalars(stmt)).all()
    return len(rows), (time.perf_counter() - start) * 1000    # 返回条数和毫秒数
```

---

## 用 pytest 测试接口

测试用 SQLite 内存库，不依赖 MySQL，跑得快。

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"           # 异步测试函数自动识别，不用每个都加 @pytest.mark.asyncio
asyncio_default_fixture_loop_scope = "function"
testpaths = ["tests"]
```

```python
# 文件: tests/test_api.py
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def client():
    # 每个测试一个全新的内存数据库，测试之间互不影响
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,                       # 内存库必须复用同一个连接
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db       # 用测试库替换真实库
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def create_customer_and_vehicle(client):
    r = await client.post("/customers", json={"name": "张三", "phone": "13800000001"})
    cid = r.json()["id"]
    r = await client.post(
        "/vehicles", json={"vin": "LSVAA00000000001A", "plate": "沪A12345", "customer_id": cid}
    )
    return cid, r.json()["id"]


async def test_create_customer(client):
    r = await client.post("/customers", json={"name": "张三", "phone": "13800000001"})
    assert r.status_code == 201
    assert r.json()["name"] == "张三"


async def test_duplicate_phone_returns_409(client):
    body = {"name": "张三", "phone": "13800000001"}
    await client.post("/customers", json=body)
    r = await client.post("/customers", json=body)
    assert r.status_code == 409


async def test_validation_error_returns_422(client):
    r = await client.post("/customers", json={"name": "", "phone": "1"})
    assert r.status_code == 422


async def test_order_lifecycle(client):
    _, vid = await create_customer_and_vehicle(client)

    r = await client.post("/orders", json={"vehicle_id": vid, "description": "更换机油", "amount": "199.50"})
    assert r.status_code == 201
    oid = r.json()["id"]
    assert r.json()["status"] == "open"

    r = await client.patch(f"/orders/{oid}/status", json={"status": "closed"})
    assert r.json()["status"] == "closed"

    r = await client.get("/orders", params={"status": "closed"})
    assert r.json()["total"] == 1

    r = await client.delete(f"/orders/{oid}")
    assert r.status_code == 204

    r = await client.get(f"/orders/{oid}")
    assert r.status_code == 404


async def test_customer_summary(client):
    _, vid = await create_customer_and_vehicle(client)
    for amount in ("100", "250.5"):
        await client.post("/orders", json={"vehicle_id": vid, "description": "x", "amount": amount})
    r = await client.get("/customers/summary")
    row = r.json()[0]
    assert row["order_count"] == 2
    assert float(row["total_amount"]) == 350.5
```

```bash
uv run pytest -v
```

---

## 和 NestJS / TypeORM 对照

| 概念 | NestJS + TypeORM | FastAPI + SQLAlchemy |
|---|---|---|
| 控制器 | `@Controller()` | `APIRouter` |
| 路由装饰器 | `@Get(':id')` | `@router.get("/{id}")` |
| 参数提取 | `@Param() @Query() @Body()` | 函数参数类型自动识别 |
| DTO 校验 | class-validator | **Pydantic** |
| 依赖注入 | 构造函数 + `@Injectable()` | `Depends()` |
| 实体 | `@Entity()` | 继承 `Base` 的类 + `Mapped[...]` |
| 仓库/查询 | `repository.find()` | `select()` + `session.execute()` |
| 关系 | `@OneToMany` | `relationship()` |
| 预加载 | `relations: [...]` | `selectinload()` / `joinedload()` |
| 异常过滤器 | `ExceptionFilter` | `@app.exception_handler` |
| 中间件 | `NestMiddleware` | `app.add_middleware` |
| 迁移 | TypeORM migration | **Alembic** |
| 接口文档 | `@nestjs/swagger` 手写装饰器 | **自动生成** |
| 配置 | `@nestjs/config` | `pydantic-settings` |
| 启动 | `nest start --watch` | `uvicorn ... --reload` |

---

## 练习题

### 练习 1：补全客户接口

给 `CustomerService` 增加 `update`（修改姓名）和 `delete`。删除客户时，如果名下还有车辆，应该返回 409
而不是直接删除（提示：先查 `Vehicle` 数量）。再补上对应的路由和测试。

### 练习 2：配件表与多对多

新增 `Part`（配件：编号、名称、库存、单价）和 `PartUsage`（工单用了哪些配件、数量），
用 `PartUsage` 作为中间表建立工单与配件的多对多关系。写一个"领用配件"接口：
扣减库存与写入领用记录放在同一个事务里，库存不足时返回 400。

### 练习 3：统计接口

写 `GET /stats/orders-by-status`，返回每种状态的工单数量与总金额（`GROUP BY status`），
并分析：在 10 万条数据下，加不加 `(status)` 相关索引，EXPLAIN 有什么区别。

### 练习 4：游标分页

实现 `GET /orders/cursor?after_id=...&size=20`，用 `WHERE id < :after_id ORDER BY id DESC LIMIT :size`
替代 OFFSET，并在 10 万条数据上对比 `offset=90000` 的耗时。

### 练习 5：读懂 two/project

打开 `two/project/modules/user/` 下的 entity、dto、service、controller 四个文件，
对照本章，写下你找到的 5 处相同点和 2 处不同点。

<details>
<summary>练习 1 参考思路</summary>

```python
# services.py
async def delete(self, id: int) -> None:
    customer = await self.get(id)
    count = await self.db.scalar(
        select(func.count()).select_from(models.Vehicle).where(models.Vehicle.customer_id == id)
    )
    if count:
        raise ConflictError(f"客户 {id} 名下还有 {count} 辆车，不能删除")
    await self.db.delete(customer)
    await self.db.commit()
```

</details>

---

## 学习检查清单

- [ ] 能启动 FastAPI 并在 `/docs` 里调试接口
- [ ] 理解路径参数、查询参数、请求体的识别规则
- [ ] 会用 `Depends` 注入数据库会话和 service
- [ ] 会写 SQLAlchemy 2.0 的模型（`Mapped`、`mapped_column`、`relationship`、索引）
- [ ] 会写增删改查、分页、联表、聚合查询
- [ ] 知道异步环境下为什么要用 `selectinload`，能解释 N+1
- [ ] 会用 Alembic 生成并执行迁移
- [ ] 能造 10 万条数据，并用 EXPLAIN 对比加索引前后的差异
- [ ] 能用 pytest + httpx 写接口测试
- [ ] 完成所有练习题

---

## 全部章节回顾

| 章 | 主题 | 对应后端能力 |
|---|---|---|
| 01-04 | 环境、语法、数据类型、控制流程 | 读写基础代码 |
| 03b | 字典与集合 | 处理 JSON、分组统计 |
| 05 | 函数、装饰器、生成器 | 理解 FastAPI 路由、流式输出 |
| 06 | 类、类型注解、Pydantic | 数据校验、接口契约 |
| 07 | 模块、包、uv | 项目工程化 |
| 08 | asyncio | 异步接口、调用模型 API |
| 09 | FastAPI + SQLAlchemy + MySQL | 完整后端 + 数据库优化 |

学完这一套，下一步就是把 Agent 能力接进来：LangGraph / 工具调用 / RAG，
这些在你 `two/project` 里已经有了雏形，可以回头逐个模块拆开读懂。