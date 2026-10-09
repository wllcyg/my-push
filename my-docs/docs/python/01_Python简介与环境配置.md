# Python 简介与环境配置 - 深度教程

## 目录
- [Python 的历史与发展](#python-的历史与发展)
- [为什么选择 Python](#为什么选择-python)
- [Python 2 vs Python 3](#python-2-vs-python-3)
- [Python 的应用领域](#python-的应用领域)
- [开发环境配置](#开发环境配置)
- [包管理工具详解](#包管理工具详解)
- [虚拟环境](#虚拟环境)
- [IDE 和编辑器选择](#ide-和编辑器选择)
- [Python 解释器详解](#python-解释器详解)

---

## Python 的历史与发展

### 诞生背景
- **创始人**：Guido van Rossum（吉多·范罗苏姆）
- **诞生时间**：1989 年圣诞节期间开始设计，1991 年发布第一个公开版本
- **命名来源**：来自英国喜剧团体 Monty Python，而非蟒蛇
- **设计哲学**：代码可读性和简洁性

### 重要版本里程碑
```
1991 - Python 0.9.0 发布
1994 - Python 1.0 发布，加入 lambda、map、filter 等函数式编程工具
2000 - Python 2.0 发布，引入垃圾回收机制和 Unicode 支持
2008 - Python 3.0 发布，不完全向后兼容，修复语言设计缺陷
2020 - Python 2 官方停止支持
2023 - Python 3.12 发布，性能大幅提升
```

### Python 之禅（The Zen of Python）
在 Python 解释器中输入 `import this` 可以看到：

```python
import this
```

**核心理念：**
- Beautiful is better than ugly（优美胜于丑陋）
- Explicit is better than implicit（明确胜于隐晦）
- Simple is better than complex（简单胜于复杂）
- Readability counts（可读性很重要）

---

## 为什么选择 Python

### 1. 语法简洁优雅
**Python vs 其他语言对比：**

```python
# Python - 打印 Hello World
print("Hello, World!")

# Java 需要
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}

# C++ 需要
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

### 2. 强大的标准库
Python 自带"电池"（Batteries Included）：

```python
# 网络请求
import urllib.request
response = urllib.request.urlopen('http://example.com')

# JSON 处理
import json
data = json.loads('{"name": "Python"}')

# 日期时间
from datetime import datetime
now = datetime.now()

# 正则表达式
import re
matches = re.findall(r'\d+', 'Python 3.12')

# 文件压缩
import zipfile
with zipfile.ZipFile('archive.zip', 'w') as zf:
    zf.write('file.txt')
```

### 3. 丰富的第三方库生态
```bash
# 数据科学
pip install numpy pandas matplotlib scikit-learn

# Web 开发
pip install django flask fastapi

# 自动化
pip install selenium requests beautifulsoup4

# 机器学习
pip install tensorflow pytorch
```

### 4. 跨平台支持
Python 代码可以在 Windows、macOS、Linux 上无缝运行

### 5. 多范式编程
```python
# 面向过程
def calculate_area(radius):
    return 3.14 * radius ** 2

# 面向对象
class Circle:
    def __init__(self, radius):
        self.radius = radius
    
    def area(self):
        return 3.14 * self.radius ** 2

# 函数式
from functools import reduce
numbers = [1, 2, 3, 4, 5]
sum_all = reduce(lambda x, y: x + y, numbers)
```

---

## Python 2 vs Python 3

### 主要区别

| 特性 | Python 2 | Python 3 |
|------|----------|----------|
| print 语句 | `print "hello"` | `print("hello")` |
| 除法 | `3/2 = 1` | `3/2 = 1.5` |
| Unicode | 需要 u"string" | 默认 Unicode |
| range | 返回列表 | 返回迭代器 |
| 输入 | `raw_input()` | `input()` |
| 异常语法 | `except Exception, e:` | `except Exception as e:` |

### 代码示例对比

```python
# Python 2
print "Hello"
print 1, 2, 3
print >> sys.stderr, "Error"

# Python 3
print("Hello")
print(1, 2, 3)
print("Error", file=sys.stderr)

# Python 2 - 除法
>>> 3 / 2
1
>>> 3.0 / 2
1.5

# Python 3 - 除法
>>> 3 / 2
1.5
>>> 3 // 2  # 整除
1
```

**建议**：现在只学习和使用 Python 3，Python 2 已经停止维护。

---

## Python 的应用领域

### 1. Web 开发
```python
# Flask 示例
from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello, World!"

if __name__ == '__main__':
    app.run()
```

**流行框架**：Django、Flask、FastAPI、Tornado

### 2. 数据科学与分析
```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 读取数据
df = pd.read_csv('data.csv')

# 数据分析
mean = df['column'].mean()
correlation = df.corr()

# 可视化
df.plot(kind='bar')
plt.show()
```

**常用库**：Pandas、NumPy、Matplotlib、Seaborn

### 3. 机器学习与人工智能
```python
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression

# 训练模型
X_train, X_test, y_train, y_test = train_test_split(X, y)
model = LinearRegression()
model.fit(X_train, y_train)
predictions = model.predict(X_test)
```

**主流框架**：TensorFlow、PyTorch、scikit-learn、Keras

### 4. 自动化脚本
```python
import os
import shutil

# 文件整理脚本
for filename in os.listdir('.'):
    if filename.endswith('.txt'):
        shutil.move(filename, 'text_files/')
```

### 5. 游戏开发
```python
import pygame

# 简单游戏循环
pygame.init()
screen = pygame.display.set_mode((800, 600))

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
```

### 6. 网络爬虫
```python
import requests
from bs4 import BeautifulSoup

response = requests.get('https://example.com')
soup = BeautifulSoup(response.text, 'html.parser')
titles = soup.find_all('h1')
```

---

## 开发环境配置

### macOS 安装

#### 方法 1：Homebrew（推荐）
```bash
# 安装 Homebrew（如果还没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Python
brew install python3

# 验证安装
python3 --version
pip3 --version
```

#### 方法 2：官方安装包
1. 访问 https://www.python.org/downloads/
2. 下载 macOS 安装包
3. 运行 .pkg 文件安装

#### 配置环境变量
```bash
# 编辑 ~/.zshrc 或 ~/.bash_profile
echo 'export PATH="/usr/local/opt/python/libexec/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Windows 安装

#### 方法 1：官方安装包
1. 访问 https://www.python.org/downloads/
2. 下载 Windows 安装程序
3. **重要**：勾选 "Add Python to PATH"
4. 选择 "Install Now" 或 "Customize installation"

#### 方法 2：Microsoft Store
```powershell
# 在 Microsoft Store 搜索 Python 3.12
```

#### 验证安装
```powershell
python --version
pip --version
```

### Linux 安装

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 验证
python3 --version
pip3 --version
```

#### CentOS/RHEL
```bash
sudo yum install python3 python3-pip

# 或使用 dnf
sudo dnf install python3 python3-pip
```

#### Arch Linux
```bash
sudo pacman -S python python-pip
```

---

## 包管理工具详解

### pip - Python 包管理器

#### 基本命令
```bash
# 安装包
pip install package_name

# 安装特定版本
pip install package_name==1.2.3

# 安装最低版本
pip install 'package_name>=1.2.3'

# 升级包
pip install --upgrade package_name

# 卸载包
pip uninstall package_name

# 列出已安装的包
pip list

# 显示包信息
pip show package_name

# 搜索包
pip search keyword  # 注意：PyPI 已禁用搜索功能
```

#### requirements.txt
```bash
# 生成依赖列表
pip freeze > requirements.txt

# 从文件安装依赖
pip install -r requirements.txt
```

**requirements.txt 示例：**
```
Django==4.2.0
requests>=2.28.0
numpy==1.24.3
pandas>=1.5.0,<2.0.0
```

#### pip 配置
```bash
# 查看配置
pip config list

# 设置国内镜像源（加速下载）
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 临时使用镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple package_name
```

**常用镜像源：**
```
清华：https://pypi.tuna.tsinghua.edu.cn/simple
阿里云：https://mirrors.aliyun.com/pypi/simple/
中科大：https://pypi.mirrors.ustc.edu.cn/simple/
豆瓣：http://pypi.douban.com/simple/
```

### pipenv - 依赖和虚拟环境管理
```bash
# 安装 pipenv
pip install pipenv

# 创建虚拟环境并安装包
pipenv install requests

# 激活虚拟环境
pipenv shell

# 安装开发依赖
pipenv install --dev pytest

# 生成 Pipfile.lock
pipenv lock
```

### poetry - 现代依赖管理
```bash
# 安装 poetry
curl -sSL https://install.python-poetry.org | python3 -

# 创建新项目
poetry new my-project

# 安装依赖
poetry add requests

# 安装开发依赖
poetry add --dev pytest

# 运行脚本
poetry run python script.py
```

---

## 虚拟环境

### 为什么需要虚拟环境？

**问题场景：**
```
项目 A 需要 Django 3.2
项目 B 需要 Django 4.2
如何在同一台机器上同时开发？
```

**解决方案：** 虚拟环境为每个项目创建独立的 Python 环境

### venv - 内置虚拟环境工具

#### 创建虚拟环境
```bash
# 创建虚拟环境
python3 -m venv myenv

# 或指定 Python 版本
python3.11 -m venv myenv
```

#### 激活虚拟环境
```bash
# macOS/Linux
source myenv/bin/activate

# Windows
myenv\Scripts\activate

# 激活后命令提示符会显示
(myenv) user@computer:~$
```

#### 在虚拟环境中工作
```bash
# 安装包（只在虚拟环境中）
pip install requests

# 查看已安装的包
pip list

# 退出虚拟环境
deactivate
```

#### 完整工作流程
```bash
# 1. 创建项目目录
mkdir my_project
cd my_project

# 2. 创建虚拟环境
python3 -m venv venv

# 3. 激活虚拟环境
source venv/bin/activate  # macOS/Linux

# 4. 安装项目依赖
pip install django requests

# 5. 生成 requirements.txt
pip freeze > requirements.txt

# 6. 工作完成后退出
deactivate
```

### virtualenvwrapper - 虚拟环境管理增强

```bash
# 安装
pip install virtualenvwrapper

# 配置（添加到 ~/.zshrc 或 ~/.bashrc）
export WORKON_HOME=$HOME/.virtualenvs
source /usr/local/bin/virtualenvwrapper.sh

# 使用
mkvirtualenv myproject    # 创建并激活
workon myproject          # 切换到环境
deactivate               # 退出环境
rmvirtualenv myproject   # 删除环境
lsvirtualenv            # 列出所有环境
```

### conda - Anaconda 环境管理

```bash
# 创建环境
conda create -n myenv python=3.11

# 激活环境
conda activate myenv

# 安装包
conda install numpy pandas

# 列出环境
conda env list

# 删除环境
conda remove -n myenv --all
```

---

## IDE 和编辑器选择

### 1. PyCharm（最强大）

**优点：**
- 功能最全面的 Python IDE
- 智能代码补全和重构
- 内置调试器、测试运行器
- 数据库工具
- Git 集成

**安装：**
```bash
# macOS (Homebrew)
brew install --cask pycharm-ce  # 社区版（免费）

# 或下载专业版（付费，学生免费）
# https://www.jetbrains.com/pycharm/
```

**基本配置：**
```python
# 设置解释器：Preferences → Project → Python Interpreter
# 配置代码风格：Preferences → Editor → Code Style → Python
# 启用 PEP 8 检查：Preferences → Editor → Inspections
```

### 2. VS Code（最流行）

**优点：**
- 轻量级、快速启动
- 丰富的扩展生态
- 优秀的 Git 集成
- 免费开源

**必装扩展：**
```
1. Python (Microsoft)
2. Pylance
3. Python Debugger
4. Jupyter
5. Black Formatter
6. isort
```

**settings.json 配置：**
```json
{
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "python.formatting.blackArgs": ["--line-length", "88"],
    "editor.formatOnSave": true,
    "python.testing.pytestEnabled": true
}
```

### 3. Jupyter Notebook（数据科学）

**安装：**
```bash
pip install jupyter

# 启动
jupyter notebook

# 或安装 JupyterLab
pip install jupyterlab
jupyter lab
```

**适用场景：**
- 数据探索和可视化
- 机器学习实验
- 交互式教学

### 4. Sublime Text（轻量编辑器）

```bash
# macOS
brew install --cask sublime-text

# 必装插件
# Package Control
# Anaconda (Python IDE)
# SublimeLinter
```

### 5. Vim/Neovim（命令行）

```bash
# 安装 Python 支持
pip install jedi autopep8 flake8

# .vimrc 配置
Plugin 'davidhalter/jedi-vim'
Plugin 'nvie/vim-flake8'
```

---

## Python 解释器详解

### 什么是解释器？

Python 是解释型语言，代码通过解释器逐行执行，而非预先编译成机器码。

```
源代码 (.py) → 字节码 (.pyc) → Python 虚拟机 → 执行
```

### 主要 Python 实现

#### 1. CPython（官方实现）
```bash
# 默认的 Python 解释器
python3 --version
# Python 3.12.0

# 用 C 语言编写
# 最广泛使用
# 性能适中
```

#### 2. PyPy（高性能）
```bash
# 安装
brew install pypy3

# 使用 JIT 编译
# 执行速度比 CPython 快 4-7 倍
# 适合长时间运行的程序
```

**性能对比：**
```python
# test.py
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(35))

# CPython: ~3 秒
# PyPy: ~0.3 秒
```

#### 3. Jython（Java 平台）
```bash
# 运行在 JVM 上
# 可以调用 Java 类库
# 适合 Java 项目集成
```

#### 4. IronPython（.NET 平台）
```bash
# 运行在 .NET 平台
# 可以调用 .NET 类库
```

### Python 交互式解释器

#### 标准 REPL
```bash
# 启动交互式 shell
python3

>>> print("Hello")
Hello
>>> 2 + 2
4
>>> exit()
```

#### IPython（增强版）
```bash
# 安装
pip install ipython

# 启动
ipython
```

**IPython 特性：**
```python
In [1]: import numpy as np

In [2]: np.array([1, 2, 3])
Out[2]: array([1, 2, 3])

# 自动补全（按 Tab 键）
In [3]: np.ar<Tab>
# 显示所有以 ar 开头的方法

# 查看帮助
In [4]: np.array?
# 显示函数文档

# 魔术命令
In [5]: %timeit sum(range(100))
# 测试代码执行时间

In [6]: %hist
# 查看命令历史
```

### Python 字节码

```python
# 查看字节码
import dis

def add(a, b):
    return a + b

dis.dis(add)
```

**输出：**
```
  2           0 LOAD_FAST                0 (a)
              2 LOAD_FAST                1 (b)
              4 BINARY_ADD
              6 RETURN_VALUE
```

### 编译 Python 代码

```bash
# 手动编译为 .pyc
python3 -m py_compile script.py

# 编译整个目录
python3 -m compileall .

# 优化编译
python3 -O -m py_compile script.py  # 生成 .pyo
```

---

## 环境变量配置

### PYTHONPATH
```bash
# 添加模块搜索路径
export PYTHONPATH="/path/to/modules:$PYTHONPATH"
```

### 查看 Python 路径
```python
import sys
print(sys.path)

# 输出：
# ['/current/directory',
#  '/usr/lib/python3.12',
#  '/usr/lib/python3.12/site-packages',
#  ...]
```

---

## 最佳实践

### 1. 项目结构
```
my_project/
│
├── venv/              # 虚拟环境
├── src/               # 源代码
│   ├── __init__.py
│   └── main.py
├── tests/             # 测试
│   └── test_main.py
├── docs/              # 文档
├── requirements.txt   # 依赖
├── setup.py          # 安装脚本
├── README.md         # 项目说明
└── .gitignore        # Git 忽略文件
```

### 2. .gitignore 配置
```gitignore
# 虚拟环境
venv/
env/
ENV/

# 字节码
__pycache__/
*.py[cod]
*$py.class

# 分发
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp

# 环境变量
.env
```

### 3. 代码规范
```bash
# 安装代码检查工具
pip install pylint black isort mypy

# 使用 Black 格式化代码
black script.py

# 使用 isort 整理导入
isort script.py

# 使用 Pylint 检查代码
pylint script.py

# 类型检查
mypy script.py
```

---

## 常见问题解决

### 1. Python 命令不存在
```bash
# macOS/Linux
which python3
# 如果没有输出，重新安装 Python

# Windows
where python
```

### 2. pip 安装失败
```bash
# 升级 pip
python3 -m pip install --upgrade pip

# 使用国内镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple package_name
```

### 3. 权限错误
```bash
# 不要使用 sudo pip
# 使用虚拟环境或用户安装
pip install --user package_name
```

### 4. 多版本 Python 管理
```bash
# macOS - 使用 pyenv
brew install pyenv

pyenv install 3.11.0
pyenv install 3.12.0
pyenv global 3.12.0

# 查看版本
pyenv versions
```

---

## 学习检查清单

完成本章后，你应该能够：

- [ ] 理解 Python 的设计哲学和应用领域
- [ ] 在你的系统上成功安装 Python
- [ ] 使用 pip 管理包
- [ ] 创建和使用虚拟环境
- [ ] 配置合适的开发环境
- [ ] 理解 Python 解释器的工作原理
- [ ] 区分不同的 Python 实现

---

## 下一步

环境配置完成后，你就可以开始学习 Python 语法了！

继续学习：**02_Python基础语法.md**
