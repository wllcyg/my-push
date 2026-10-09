# Python 基础语法 - 深度教程

## 目录
- [代码结构与缩进](#代码结构与缩进)
- [注释详解](#注释详解)
- [变量与命名规范](#变量与命名规范)
- [标识符与关键字](#标识符与关键字)
- [输入输出详解](#输入输出详解)
- [运算符完全指南](#运算符完全指南)
- [内存管理与引用](#内存管理与引用)
- [代码风格指南](#代码风格指南)

---

## 代码结构与缩进

### Python 的独特之处

Python 使用**缩进**来定义代码块，而不是大括号 `{}`。

**对比其他语言：**
```python
# Python
if x > 0:
    print("positive")
    print("still in if block")

# JavaScript/C++/Java
if (x > 0) {
    console.log("positive");
    console.log("still in if block");
}
```

### 缩进规则

#### 1. 标准缩进：4 个空格
```python
def function():
    if True:
        print("level 2")
        if True:
            print("level 3")
```

#### 2. 混用空格和 Tab 会报错
```python
# ❌ 错误：混用空格和 Tab
def bad_function():
    print("space")  # 4个空格
	print("tab")    # 1个Tab
# TabError: inconsistent use of tabs and spaces in indentation
```

#### 3. 同一代码块必须保持相同缩进
```python
# ✅ 正确
if True:
    print("line 1")
    print("line 2")
    print("line 3")

# ❌ 错误：缩进不一致
if True:
    print("line 1")
  print("line 2")    # IndentationError
      print("line 3")
```

### 代码块结构

```python
# 顶层代码（无缩进）
import sys

# 函数定义
def my_function():              # 0 级缩进
    if True:                    # 1 级缩进（4 空格）
        for i in range(10):     # 2 级缩进（8 空格）
            if i % 2 == 0:      # 3 级缩进（12 空格）
                print(i)        # 4 级缩进（16 空格）

# 类定义
class MyClass:                  # 0 级
    def method(self):           # 1 级
        try:                    # 2 级
            pass                # 3 级
        except Exception:       # 2 级
            pass                # 3 级
```

### 长语句换行

#### 1. 使用反斜杠 `\`
```python
total = 1 + 2 + 3 + \
        4 + 5 + 6

message = "This is a very long string that " \
          "spans multiple lines"
```

#### 2. 括号内自动换行（推荐）
```python
# 列表
numbers = [
    1, 2, 3,
    4, 5, 6,
    7, 8, 9
]

# 函数调用
result = some_function(
    argument1,
    argument2,
    argument3
)

# 条件语句
if (condition1 and 
    condition2 and 
    condition3):
    print("All conditions met")
```

#### 3. 字符串拼接
```python
# 隐式拼接
message = ("This is part one "
           "and this is part two")

# 使用括号
sql = (
    "SELECT id, name, email "
    "FROM users "
    "WHERE status = 'active'"
)
```

---

## 注释详解

### 单行注释

```python
# 这是单行注释

x = 5  # 行尾注释

# 多个单行注释
# 可以连续使用
# 来说明复杂的逻辑
```

### 多行注释

```python
"""
这是多行注释（文档字符串）
可以跨越多行
通常用于模块、类、函数的文档
"""

'''
单引号也可以
用作多行注释
'''
```

### 文档字符串（Docstring）

#### 1. 函数文档
```python
def calculate_area(radius):
    """
    计算圆的面积
    
    参数:
        radius (float): 圆的半径
    
    返回:
        float: 圆的面积
    
    示例:
        >>> calculate_area(5)
        78.5
    """
    return 3.14 * radius ** 2

# 访问文档
print(calculate_area.__doc__)
help(calculate_area)
```

#### 2. 类文档
```python
class Circle:
    """
    表示圆形的类
    
    属性:
        radius (float): 圆的半径
        color (str): 圆的颜色
    
    方法:
        area(): 计算圆的面积
        circumference(): 计算圆的周长
    """
    
    def __init__(self, radius, color='red'):
        """初始化圆对象"""
        self.radius = radius
        self.color = color
    
    def area(self):
        """计算并返回圆的面积"""
        return 3.14 * self.radius ** 2
```

#### 3. 模块文档
```python
"""
数学工具模块

这个模块提供了各种数学计算功能，包括：
- 几何计算
- 统计函数
- 数值分析

作者: Your Name
日期: 2024-01-01
版本: 1.0.0
"""

def add(a, b):
    """返回两个数的和"""
    return a + b
```

### 注释最佳实践

#### ✅ 好的注释
```python
# 计算用户的平均分数，忽略最高分和最低分
scores.sort()
average = sum(scores[1:-1]) / (len(scores) - 2)

def calculate_tax(income):
    """
    根据税率表计算应缴税额
    
    采用累进税率：
    - 0-50000: 5%
    - 50000-100000: 10%
    - 100000+: 15%
    """
    # 实现代码...
```

#### ❌ 不好的注释
```python
# 给 x 加 1
x = x + 1

# 这个函数返回结果
def get_result():
    return result

# 循环
for i in range(10):
    print(i)
```

### 特殊注释标记

```python
# TODO: 实现用户认证功能
# FIXME: 这里有个 bug，需要修复
# HACK: 临时解决方案，之后需要重构
# NOTE: 注意这里的性能问题
# XXX: 警告！这段代码需要重写

def process_data():
    # TODO: 添加数据验证
    pass
    
    # FIXME: 处理空值情况
    result = data / count
    
    # HACK: 绕过第三方库的限制
    time.sleep(0.1)
```

---

## 变量与命名规范

### 变量定义

Python 是**动态类型**语言，不需要声明变量类型：

```python
# 简单赋值
x = 5
name = "Alice"
is_active = True

# 多重赋值
a, b, c = 1, 2, 3
x = y = z = 0

# 序列解包
first, *rest = [1, 2, 3, 4, 5]
# first = 1, rest = [2, 3, 4, 5]

head, *middle, tail = [1, 2, 3, 4, 5]
# head = 1, middle = [2, 3, 4], tail = 5
```

### 变量命名规则

#### 1. 合法标识符
```python
# ✅ 合法
name = "Alice"
_private = 10
name2 = "Bob"
user_name = "Charlie"
userName = "David"  # 驼峰命名（不推荐）

# ❌ 非法
2name = "Invalid"     # 不能以数字开头
user-name = "Error"   # 不能包含连字符
class = "Invalid"     # 不能使用关键字
```

#### 2. 命名风格（PEP 8）

```python
# 变量和函数：小写 + 下划线
user_name = "Alice"
total_count = 100

def calculate_average():
    pass

# 常量：全大写 + 下划线
MAX_SIZE = 1000
DEFAULT_COLOR = "blue"
PI = 3.14159

# 类名：驼峰命名（首字母大写）
class UserAccount:
    pass

class HTTPResponse:
    pass

# 私有变量：单下划线开头
class MyClass:
    def __init__(self):
        self._private_var = 10

# 名称改写：双下划线开头
class MyClass:
    def __init__(self):
        self.__really_private = 10

# 魔术方法：双下划线包围
class MyClass:
    def __init__(self):
        pass
    
    def __str__(self):
        return "MyClass instance"
```

### 变量类型推断

```python
# Python 会自动推断类型
x = 5           # int
y = 3.14        # float
name = "Alice"  # str
is_valid = True # bool

# 查看变量类型
print(type(x))      # <class 'int'>
print(type(name))   # <class 'str'>

# 类型检查
isinstance(x, int)          # True
isinstance(name, str)       # True
isinstance(y, (int, float)) # True
```

### 类型注解（Type Hints）

```python
# 变量类型注解
age: int = 25
name: str = "Alice"
scores: list[int] = [90, 85, 88]

# 函数类型注解
def greet(name: str) -> str:
    return f"Hello, {name}!"

def add(a: int, b: int) -> int:
    return a + b

# 复杂类型
from typing import List, Dict, Optional, Union

def process_data(
    items: List[str],
    mapping: Dict[str, int],
    optional_param: Optional[str] = None
) -> Union[int, str]:
    pass
```

---

## 标识符与关键字

### Python 关键字

Python 3.12 的所有关键字：

```python
import keyword
print(keyword.kwlist)

# 输出：
# ['False', 'None', 'True', 'and', 'as', 'assert', 'async', 
#  'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 
#  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 
#  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 
#  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']

# 检查是否为关键字
keyword.iskeyword('if')      # True
keyword.iskeyword('hello')   # False
```

### 关键字分类

#### 1. 控制流
```python
if, elif, else       # 条件语句
for, while          # 循环
break, continue     # 循环控制
pass               # 空操作
```

#### 2. 函数和类
```python
def                # 定义函数
class              # 定义类
return             # 返回值
yield              # 生成器
lambda             # 匿名函数
```

#### 3. 异常处理
```python
try, except, finally  # 异常处理
raise                # 抛出异常
assert               # 断言
```

#### 4. 导入
```python
import              # 导入模块
from                # 从模块导入
as                  # 别名
```

#### 5. 逻辑运算
```python
and, or, not        # 逻辑运算符
is                  # 身份运算符
in                  # 成员运算符
```

#### 6. 作用域
```python
global              # 全局变量
nonlocal            # 非局部变量
```

#### 7. 异步编程
```python
async               # 异步函数
await               # 等待异步操作
```

#### 8. 上下文管理
```python
with                # 上下文管理器
```

#### 9. 特殊值
```python
True, False         # 布尔值
None               # 空值
```

---

## 输入输出详解

### 输出：print() 函数

#### 1. 基本用法
```python
print("Hello, World!")

# 多个参数
print("Python", 3.12)  # Python 3.12

# 指定分隔符
print("A", "B", "C", sep="-")  # A-B-C

# 指定结尾
print("Hello", end="")
print("World")  # HelloWorld

# 输出到文件
with open("output.txt", "w") as f:
    print("Hello", file=f)
```

#### 2. 格式化输出

**方法 1：f-string（推荐，Python 3.6+）**
```python
name = "Alice"
age = 25
score = 95.5

# 基本格式化
print(f"Name: {name}, Age: {age}")

# 表达式
print(f"Next year: {age + 1}")

# 格式控制
print(f"Score: {score:.1f}")  # 95.5
print(f"Score: {score:.0f}")  # 96

# 宽度和对齐
print(f"{name:>10}")   # 右对齐，宽度10
print(f"{name:<10}")   # 左对齐
print(f"{name:^10}")   # 居中

# 数字格式
number = 1234567
print(f"{number:,}")    # 1,234,567
print(f"{number:_}")    # 1_234_567

# 百分比
ratio = 0.75
print(f"{ratio:.1%}")   # 75.0%

# 进制转换
num = 255
print(f"{num:b}")       # 11111111（二进制）
print(f"{num:o}")       # 377（八进制）
print(f"{num:x}")       # ff（十六进制）
print(f"{num:X}")       # FF（十六进制大写）
```

**方法 2：str.format()**
```python
name = "Alice"
age = 25

# 位置参数
print("{} is {} years old".format(name, age))

# 索引
print("{0} is {1} years old. {0} likes Python.".format(name, age))

# 关键字参数
print("{name} is {age} years old".format(name=name, age=age))

# 格式控制
print("{:.2f}".format(3.14159))  # 3.14
print("{:>10}".format("test"))   # 右对齐
```

**方法 3：% 格式化（旧式）**
```python
name = "Alice"
age = 25

print("%s is %d years old" % (name, age))
print("Pi: %.2f" % 3.14159)
```

#### 3. 彩色输出（ANSI 转义序列）
```python
# 颜色代码
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

print(f"{RED}Error: Something went wrong{RESET}")
print(f"{GREEN}Success: Operation completed{RESET}")

# 使用 colorama 库（跨平台）
from colorama import Fore, Back, Style
print(Fore.RED + "Error" + Style.RESET_ALL)
print(Fore.GREEN + "Success" + Style.RESET_ALL)
```

### 输入：input() 函数

#### 1. 基本用法
```python
# 获取字符串输入
name = input("Enter your name: ")
print(f"Hello, {name}")

# 输入总是字符串类型
age = input("Enter your age: ")
print(type(age))  # <class 'str'>
```

#### 2. 类型转换
```python
# 转换为整数
age = int(input("Enter your age: "))

# 转换为浮点数
price = float(input("Enter price: "))

# 转换为布尔值
answer = input("Yes or No? ").lower() == "yes"

# 转换为列表
numbers = input("Enter numbers separated by space: ").split()
numbers = [int(x) for x in numbers]
```

#### 3. 输入验证
```python
# 验证整数输入
while True:
    try:
        age = int(input("Enter your age: "))
        if age > 0:
            break
        else:
            print("Age must be positive")
    except ValueError:
        print("Please enter a valid number")

# 验证范围
def get_number_in_range(prompt, min_val, max_val):
    while True:
        try:
            num = int(input(prompt))
            if min_val <= num <= max_val:
                return num
            else:
                print(f"Number must be between {min_val} and {max_val}")
        except ValueError:
            print("Invalid input")

score = get_number_in_range("Enter score (0-100): ", 0, 100)
```

#### 4. 多行输入
```python
# 方法 1：循环读取
print("Enter lines (empty line to stop):")
lines = []
while True:
    line = input()
    if not line:
        break
    lines.append(line)

# 方法 2：固定行数
n = int(input("How many lines? "))
lines = [input() for _ in range(n)]

# 方法 3：从文件读取
import sys
lines = sys.stdin.readlines()
```

---

## 运算符完全指南

### 1. 算术运算符

```python
a = 10
b = 3

print(a + b)   # 13  加法
print(a - b)   # 7   减法
print(a * b)   # 30  乘法
print(a / b)   # 3.333... 除法（浮点）
print(a // b)  # 3   整除（向下取整）
print(a % b)   # 1   取模（余数）
print(a ** b)  # 1000 幂运算

# 特殊情况
print(7 / 2)   # 3.5
print(7 // 2)  # 3
print(-7 // 2) # -4（向下取整）
print(7 % 2)   # 1
print(-7 % 2)  # 1

# 字符串和列表的运算
print("Hello" + " World")    # HelloWorld
print("Hi" * 3)              # HiHiHi
print([1, 2] + [3, 4])       # [1, 2, 3, 4]
print([1, 2] * 2)            # [1, 2, 1, 2]
```

### 2. 比较运算符

```python
a = 10
b = 5

print(a == b)  # False  等于
print(a != b)  # True   不等于
print(a > b)   # True   大于
print(a < b)   # False  小于
print(a >= b)  # True   大于等于
print(a <= b)  # False  小于等于

# 链式比较
x = 5
print(1 < x < 10)      # True
print(1 < x < 3)       # False
print(1 <= x <= 10)    # True

# 字符串比较（字典序）
print("apple" < "banana")  # True
print("abc" > "ABC")       # True（小写 > 大写）
```

### 3. 赋值运算符

```python
x = 10

# 复合赋值
x += 5    # x = x + 5
x -= 3    # x = x - 3
x *= 2    # x = x * 2
x /= 4    # x = x / 4
x //= 2   # x = x // 2
x %= 3    # x = x % 3
x **= 2   # x = x ** 2

# 多重赋值
a = b = c = 0
x, y, z = 1, 2, 3

# 交换变量
a, b = b, a

# 海象运算符（:=）Python 3.8+
if (n := len([1, 2, 3, 4])) > 3:
    print(f"List is long ({n} elements)")
```

### 4. 逻辑运算符

```python
# and, or, not
x = True
y = False

print(x and y)  # False
print(x or y)   # True
print(not x)    # False

# 短路求值
def func():
    print("Function called")
    return True

False and func()  # func() 不会被调用
True or func()    # func() 不会被调用

# 返回值不是布尔值
print(5 and 10)     # 10
print(0 or 10)      # 10
print("" or "default")  # default
```

### 5. 位运算符

```python
a = 60   # 0011 1100
b = 13   # 0000 1101

print(a & b)   # 12  (0000 1100) AND
print(a | b)   # 61  (0011 1101) OR
print(a ^ b)   # 49  (0011 0001) XOR
print(~a)      # -61 (1100 0011) NOT
print(a << 2)  # 240 (1111 0000) 左移
print(a >> 2)  # 15  (0000 1111) 右移

# 实际应用：权限管理
READ = 1    # 0001
WRITE = 2   # 0010
EXECUTE = 4 # 0100

# 设置权限
permissions = READ | WRITE  # 0011

# 检查权限
has_read = permissions & READ     # True (非零)
has_execute = permissions & EXECUTE  # False (零)

# 添加权限
permissions |= EXECUTE

# 移除权限
permissions &= ~WRITE
```

### 6. 成员运算符

```python
# in, not in
numbers = [1, 2, 3, 4, 5]
print(3 in numbers)        # True
print(10 not in numbers)   # True

# 字符串
print("py" in "python")    # True
print("x" not in "python") # True

# 字典（检查键）
user = {"name": "Alice", "age": 25}
print("name" in user)      # True
print("email" in user)     # False

# 集合
colors = {"red", "green", "blue"}
print("red" in colors)     # True
```

### 7. 身份运算符

```python
# is, is not
a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(a == b)   # True（值相等）
print(a is b)   # False（不是同一个对象）
print(a is c)   # True（是同一个对象）

# 查看对象 ID
print(id(a))    # 140234567890
print(id(b))    # 140234567920
print(id(c))    # 140234567890（与 a 相同）

# 小整数和字符串的特殊情况（驻留机制）
x = 256
y = 256
print(x is y)   # True（-5 到 256 被缓存）

x = 257
y = 257
print(x is y)   # False（超出缓存范围）

s1 = "hello"
s2 = "hello"
print(s1 is s2) # True（字符串驻留）

# None 的比较应使用 is
value = None
print(value is None)     # ✅ 推荐
print(value == None)     # ❌ 不推荐
```

### 8. 运算符优先级

```python
# 从高到低：
# 1. ()
# 2. **
# 3. +x, -x, ~x (一元运算符)
# 4. *, /, //, %
# 5. +, -
# 6. <<, >>
# 7. &
# 8. ^
# 9. |
# 10. ==, !=, <, >, <=, >=, is, is not, in, not in
# 11. not
# 12. and
# 13. or

# 示例
print(2 + 3 * 4)      # 14 (不是 20)
print((2 + 3) * 4)    # 20

print(True or False and False)  # True
print((True or False) and False)  # False

# 最佳实践：使用括号明确优先级
result = ((a + b) * c) / (d - e)
```

---

## 内存管理与引用

### 变量是引用

```python
# Python 中变量是对象的引用
a = [1, 2, 3]
b = a  # b 指向同一个列表

b.append(4)
print(a)  # [1, 2, 3, 4]（a 也改变了）

# 查看引用计数
import sys
print(sys.getrefcount(a))  # 3（a, b, 和传递给函数的临时引用）
```

### 可变对象 vs 不可变对象

#### 不可变对象（Immutable）
```python
# int, float, str, tuple, frozenset

# 整数
x = 10
y = x
y += 1
print(x)  # 10（x 不变）
print(y)  # 11

# 字符串
s1 = "hello"
s2 = s1
s2 += " world"
print(s1)  # "hello"（不变）
print(s2)  # "hello world"
```

#### 可变对象（Mutable）
```python
# list, dict, set

# 列表
list1 = [1, 2, 3]
list2 = list1
list2.append(4)
print(list1)  # [1, 2, 3, 4]（改变了）

# 如何避免：使用复制
list3 = list1.copy()  # 浅拷贝
list3.append(5)
print(list1)  # [1, 2, 3, 4]（不变）
```

### 深拷贝 vs 浅拷贝

```python
import copy

# 浅拷贝
original = [[1, 2], [3, 4]]
shallow = original.copy()

shallow[0][0] = 99
print(original)  # [[99, 2], [3, 4]]（内层列表被修改）

# 深拷贝
original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)

deep[0][0] = 99
print(original)  # [[1, 2], [3, 4]]（不变）
```

### 垃圾回收

```python
import gc

# 查看垃圾回收信息
print(gc.get_count())

# 手动触发垃圾回收
gc.collect()

# 查看对象
import sys
a = [1, 2, 3]
print(sys.getrefcount(a))  # 引用计数

# del 语句
b = [1, 2, 3]
del b  # 删除引用，对象可能被回收
```

---

## 代码风格指南（PEP 8）

### 1. 缩进和空格
```python
# ✅ 使用 4 个空格缩进
def function():
    if True:
        print("indented")

# ✅ 运算符周围加空格
x = 5 + 3
result = (a + b) * (c - d)

# ❌ 不要在括号内加空格
spam(ham[1], {eggs: 2})     # ✅
spam( ham[ 1 ], { eggs: 2 } )  # ❌

# ✅ 逗号后加空格
items = [1, 2, 3, 4]

# ✅ 函数参数默认值不加空格
def function(arg1, arg2=None):
    pass
```

### 2. 行长度
```python
# 每行最多 79 个字符（PEP 8）
# 文档字符串和注释最多 72 个字符

# ✅ 长表达式换行
result = (some_long_variable + another_variable
          + yet_another_variable)

# ✅ 函数调用换行
my_function(
    argument1,
    argument2,
    argument3
)
```

### 3. 空行
```python
# 顶层函数和类之间空 2 行
class MyClass:
    pass


def my_function():
    pass


# 类中的方法之间空 1 行
class MyClass:
    def method1(self):
        pass
    
    def method2(self):
        pass
```

### 4. 导入
```python
# ✅ 导入应在文件开头
# ✅ 标准库、第三方库、本地模块分组

import os
import sys

import numpy as np
import pandas as pd

from myproject import mymodule

# ❌ 不要使用通配符导入
from module import *  # 不推荐

# ✅ 明确导入
from module import function1, function2
```

### 5. 字符串引号
```python
# 单引号和双引号都可以，保持一致
name = "Alice"
message = 'Hello'

# 包含引号时选择另一种
text = "It's a beautiful day"
quote = 'He said "Hello"'

# 三引号用于多行字符串
doc = """
This is a
multi-line string
"""
```

### 使用代码检查工具

```bash
# 安装工具
pip install pylint flake8 black mypy

# Pylint：全面的代码检查
pylint script.py

# Flake8：轻量级检查
flake8 script.py

# Black：自动格式化
black script.py

# MyPy：类型检查
mypy script.py
```

---

## 实践练习

### 练习 1：变量交换
```python
# 不使用临时变量交换两个变量的值
a = 10
b = 20

# 你的代码
a, b = b, a

print(a, b)  # 20 10
```

### 练习 2：输入验证
```python
# 编写函数验证用户输入的邮箱格式
def validate_email(email):
    """验证邮箱格式"""
    if '@' not in email:
        return False
    parts = email.split('@')
    if len(parts) != 2:
        return False
    if '.' not in parts[1]:
        return False
    return True

# 测试
print(validate_email("user@example.com"))  # True
print(validate_email("invalid.email"))      # False
```

### 练习 3：格式化输出
```python
# 创建一个漂亮的表格
def print_table(data):
    """
    打印格式化的表格
    data: [{"name": "Alice", "age": 25, "score": 95.5}, ...]
    """
    # 你的实现
    pass
```

---

## 学习检查清单

完成本章后，你应该能够：

- [ ] 理解并正确使用 Python 的缩进规则
- [ ] 编写清晰的注释和文档字符串
- [ ] 遵循命名规范创建变量和函数
- [ ] 使用各种格式化方式输出信息
- [ ] 处理用户输入并进行验证
- [ ] 熟练使用所有运算符
- [ ] 理解引用和内存管理
- [ ] 遵循 PEP 8 代码风格指南

继续学习：**03_数据类型详解.md**
