# TypeScript vs Python 类型系统速查表 (Type Hints)

这份文档专门为拥有 TypeScript (前端/Node.js) 背景的开发者准备，帮助你快速平滑地过渡到 Python 的类型系统（Type Hints）。

> [!NOTE]
> Python 本质上是一门动态类型语言，类型提示（Type Hints）在运行时不会强制报错，它的主要作用是**配合 IDE (如 VSCode 的 Pylance) 提供完美的自动补全和静态检查**，这点和 TypeScript 的定位如出一辙。

## 1. 基础类型映射

| TypeScript | Python | 说明 |
| :--- | :--- | :--- |
| `string` | `str` | 字符串 |
| `number` | `int` 或 `float` | Python 区分整数和浮点数 |
| `boolean` | `bool` | 布尔值 (注意 Python 里字面量首字母大写：`True`, `False`) |
| `any` | `Any` | 任意类型，放弃类型检查 (需 `from typing import Any`) |
| `void` / `null` | `None` | 无返回值或空值 |

## 2. 复合类型与容器

| TypeScript | Python (经典写法) | Python (3.9+ 现代写法) |
| :--- | :--- | :--- |
| `T[]` 或 `Array<T>` | `List[T]` | `list[T]` |
| `Record<K, V>` | `Dict[K, V]` | `dict[K, V]` |
| `[string, number]` | `Tuple[str, int]` | `tuple[str, int]` |
| `Set<T>` | `Set[T]` | `set[T]` |

## 3. 高级与特殊类型

### 3.1 可选与联合类型 (Union & Optional)

在 TS 中，我们经常用 `|` 符号表示联合类型。

**TypeScript:**
```typescript
let myVar: string | number;
let myObj: string | null;
```

**Python:**
```python
from typing import Union, Optional

# Python 经典写法 (3.9及以下)
my_var: Union[str, int]
my_obj: Optional[str]  # 相当于 Union[str, None]

# Python 现代写法 (3.10+) 👑 推荐
my_var: str | int
my_obj: str | None
```

### 3.2 接口与对象结构 (Interface / Type)

在 TS 中，最常用的就是定义数据结构的形状。在 Python 中，最佳平替是 `TypedDict` 或 `Pydantic`。

**TypeScript:**
```typescript
interface User {
  id: number;
  name: string;
  age?: number; // 可选属性
}
```

**Python (使用 TypedDict):**
```python
from typing import TypedDict, NotRequired

class User(TypedDict):
    id: int
    name: str
    age: NotRequired[int] # 可选属性
    
# 如果想要全部属性默认都是可选的（相当于 TS 的 Partial<User>）
class PartialUser(TypedDict, total=False):
    id: int
    name: str
```

> [!TIP]
> 如果你的数据类不仅仅需要开发时的类型提示，还需要在代码运行时进行**强校验与类型转换**，那么应该使用 **Pydantic** 的 `BaseModel`（相当于带有运行时校验的 Zod + TS Class）。我们项目中大量使用了这个。

### 3.3 函数签名

**TypeScript:**
```typescript
function greet(name: string, age?: number): string {
  return "Hello";
}
```

**Python:**
```python
def greet(name: str, age: int | None = None) -> str:
    return "Hello"
```

## 4. 总结与最佳实践

1. **拥抱新语法**：如果你使用的是 Python 3.9 及以上版本，强烈建议抛弃 `typing.List`, `typing.Dict`，直接使用内置的 `list`, `dict`，并使用 `|` 替代 `Union`。你的 Python 代码看起来会非常接近 TS。
2. **Pydantic 代替 Zod**：在 Python 现代服务端开发（尤其是 FastAPI 和 LangGraph）中，Pydantic 是不可或缺的神器。
