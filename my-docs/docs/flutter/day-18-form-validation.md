# 前端转 Flutter 笔记 (Day 18)：表单机制与校验——从 Element Plus 到 Form Widget 📋

> **前言**：
> 在前端中，我们对 Element Plus 的 `<el-form>` + `<el-form-item>` + `rules` 属性已经烂熟于心。校验规则写在 `rules` 对象中，一个 `formRef.validate()` 就能批量校验全部字段。
>
> 在 Flutter 中，同样有一套完整的 **Form + TextFormField + GlobalKey** 体系来做表单校验。但它的设计思路和前端的双向绑定 (v-model) 截然不同，更偏向命令式。今天我们来彻底搞懂它。

---

## 1. 核心对比：前端 vs Flutter 的表单模型 🔄

| 概念                 | 前端 (Vue + Element Plus)                | Flutter                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------ |
| **表单容器**         | `<el-form :model="form" :rules="rules">` | `Form(key: _formKey)`                            |
| **表单项**           | `<el-form-item prop="email">`            | `TextFormField(validator: ...)`                  |
| **双向绑定**         | `v-model="form.email"`                   | `TextEditingController` (命令式)                 |
| **校验规则声明位置** | 外部 `rules` 对象，通过 `prop` 名称映射  | 每个 `TextFormField` 的 `validator` 回调（内联） |
| **触发校验**         | `formRef.validate()`                     | `_formKey.currentState!.validate()`              |
| **获取表单数据**     | 直接读 `form` 响应式对象                 | 读 `controller.text` 或 `onSaved` 回调           |
| **重置表单**         | `formRef.resetFields()`                  | `_formKey.currentState!.reset()`                 |

> **💡 关键差异**：前端的表单模型是声明式的（规则写在外面，引擎自动匹配字段）；Flutter 的表单模型是内联的（每个字段自带校验器，容器只负责统一触发）。

---

## 2. Flutter Form 体系三件套 🧩

### 2.1 `Form` — 表单容器

```dart
// 1. 创建一个 GlobalKey 来引用 Form 的状态
final _formKey = GlobalKey<FormState>();

// 2. 用 Form 包裹所有表单字段
Form(
  key: _formKey,
  // autovalidateMode 控制何时自动校验：
  // - disabled: 手动调用时才校验（默认）
  // - onUserInteraction: 用户输入时实时校验
  // - always: 始终校验
  autovalidateMode: AutovalidateMode.onUserInteraction,
  child: Column(
    children: [
      // 这里放 TextFormField ...
    ],
  ),
)
```

### 2.2 `TextFormField` — 自带校验的输入框

```dart
TextFormField(
  controller: emailController,
  decoration: const InputDecoration(
    labelText: '邮箱',
    hintText: '请输入邮箱地址',
    prefixIcon: Icon(Icons.email),
  ),
  keyboardType: TextInputType.emailAddress,

  // 🔥 校验器：返回 null 表示通过，返回 String 表示错误信息
  validator: (value) {
    if (value == null || value.isEmpty) {
      return '邮箱不能为空';
    }
    if (!RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
      return '请输入有效的邮箱格式';
    }
    return null; // 通过！
  },

  // 📦 onSaved: 在调用 _formKey.currentState!.save() 时触发
  onSaved: (value) {
    // 可以在这里把值收集到一个 Map 或 Model 中
  },
)
```

> **前端对标**：`validator` 就相当于 Element Plus 的 `rules` 数组中每条规则的 `validator` 函数。但在 Flutter 中，它直接写在字段上，不需要通过 `prop` 名去匹配。

### 2.3 `GlobalKey<FormState>` — 表单遥控器

```dart
// 校验全部字段
if (_formKey.currentState!.validate()) {
  // 所有字段都通过校验
  _formKey.currentState!.save(); // 触发每个字段的 onSaved
  // 提交逻辑...
}

// 重置表单
_formKey.currentState!.reset();
```

---

## 3. 用 Hooks 干掉 dispose 地狱 🪝

传统写法中，每个 `TextEditingController` 都要在 `initState` 中创建、在 `dispose` 中销毁。一个注册页面有 5 个字段，就要管理 5 对生命周期。

### 传统 StatefulWidget (痛苦版) 😵

```dart
class RegisterPage extends StatefulWidget { ... }

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  late final _nameCtrl = TextEditingController();
  late final _emailCtrl = TextEditingController();
  late final _passwordCtrl = TextEditingController();
  late final _confirmCtrl = TextEditingController();
  late final _phoneCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }
  // ...
}
```

### Hooks 版 (优雅版) ✨

```dart
class RegisterPage extends HookConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 🪄 一行搞定，自动销毁！
    final formKey = useMemoized(() => GlobalKey<FormState>());
    final nameCtrl = useTextEditingController();
    final emailCtrl = useTextEditingController();
    final passwordCtrl = useTextEditingController();
    final confirmCtrl = useTextEditingController();
    final phoneCtrl = useTextEditingController();

    // 不需要 dispose！Hooks 框架会自动管理生命周期
    // ...
  }
}
```

> **💡 前端类比**：`useTextEditingController()` 就像 Vue 的 `ref('')`，`useMemoized` 就像 `useMemo`。Hooks 让 Flutter 的状态管理像写 Composition API 一样丝滑。

---

## 4. 实战：用户资料编辑表单 (完整示例) 💻

我们在项目中创建一个 **用户资料编辑** 的表单 Demo 页面，整合以下技术栈：

- `Form` + `TextFormField` (表单体系)
- `flutter_hooks` (自动管理 Controller 生命周期)
- `Riverpod` (状态管理)

### 核心代码逻辑

```dart
class FormDemoPage extends HookConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(() => GlobalKey<FormState>());
    final nameCtrl = useTextEditingController();
    final emailCtrl = useTextEditingController();
    final phoneCtrl = useTextEditingController();
    final bioCtrl = useTextEditingController();

    return Scaffold(
      appBar: AppBar(title: const Text('表单 Demo')),
      body: Form(
        key: formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: '昵称',
                prefixIcon: Icon(Icons.person),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) return '昵称不能为空';
                if (value.length < 2) return '昵称至少 2 个字符';
                if (value.length > 20) return '昵称最多 20 个字符';
                return null;
              },
            ),

            TextFormField(
              controller: emailCtrl,
              decoration: const InputDecoration(
                labelText: '邮箱',
                prefixIcon: Icon(Icons.email),
              ),
              keyboardType: TextInputType.emailAddress,
              validator: (value) {
                if (value == null || value.isEmpty) return '邮箱不能为空';
                final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$');
                if (!emailRegex.hasMatch(value)) return '邮箱格式不正确';
                return null;
              },
            ),

            // ... 更多字段

            ElevatedButton(
              onPressed: () {
                // 一键校验全部字段
                if (formKey.currentState!.validate()) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✅ 校验通过，提交成功！')),
                  );
                }
              },
              child: const Text('提交'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 5. 进阶技巧 🚀

### 5.1 自定义 FormField (封装下拉框、开关等非文本输入)

```dart
FormField<bool>(
  initialValue: false,
  validator: (value) {
    if (value != true) return '请同意用户协议';
    return null;
  },
  builder: (FormFieldState<bool> state) {
    return Column(
      children: [
        CheckboxListTile(
          title: const Text('我已阅读并同意用户协议'),
          value: state.value,
          onChanged: (val) => state.didChange(val),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (state.hasError)
          Text(state.errorText!, style: TextStyle(color: Colors.red, fontSize: 12)),
      ],
    );
  },
)
```

### 5.2 跨字段校验（确认密码场景）

```dart
final passwordCtrl = useTextEditingController();

TextFormField(
  controller: confirmCtrl,
  validator: (value) {
    if (value != passwordCtrl.text) {
      return '两次密码不一致';
    }
    return null;
  },
)
```

### 5.3 异步校验（检查用户名是否已存在）

```dart
TextFormField(
  validator: (value) {
    // 注意：validator 是同步的！异步校验需要换一种方式
    // 方案：用 onChanged + Riverpod 异步 Provider 做实时检查
    if (value == null || value.isEmpty) return '用户名不能为空';
    return null;
  },
  onChanged: (value) {
    // 触发 Riverpod 异步查询
    ref.read(usernameCheckProvider.notifier).check(value);
  },
)
```

---

## 6. 避坑指南 ⚠️

### ❌ TextField vs TextFormField

- `TextField`：纯输入框，**不参与** Form 校验。
- `TextFormField`：继承了 `FormField`，**参与** Form 校验。
- **规则**：在 `Form` 里面，永远用 `TextFormField`，别用 `TextField`！

### ❌ 忘记 `useMemoized` 包裹 `GlobalKey`

```dart
// ❌ 错误：每次 build 都会创建新的 Key，导致 Form 状态丢失
final formKey = GlobalKey<FormState>();

// ✅ 正确：用 useMemoized 保证只创建一次
final formKey = useMemoized(() => GlobalKey<FormState>());
```

### ❌ autovalidateMode 用错时机

```dart
// ❌ 一开始就 always，用户还没输入就看到一堆红色错误
autovalidateMode: AutovalidateMode.always,

// ✅ 推荐：onUserInteraction，只在用户开始输入后才校验
autovalidateMode: AutovalidateMode.onUserInteraction,
```

---

## Day 18 总结 📝

- **Form** 是容器，**TextFormField** 是参与者，**GlobalKey** 是遥控器。三件套缺一不可。
- `validator` 回调是内联的，返回 `null` = 通过，返回 `String` = 错误信息。这比前端的 `rules` 对象更加直观。
- 用 **Hooks** (`useTextEditingController`) 干掉 `dispose` 地狱，让代码量减少 50%。
- `AutovalidateMode.onUserInteraction` 是最佳默认选择——用户不碰不报错，碰了才实时反馈。
- 跨字段校验（如确认密码）直接在 `validator` 中读取另一个 Controller 的值即可。
- 异步校验（如用户名查重）用 `onChanged` + Riverpod 异步 Provider 来实现，因为 `validator` 本身是同步的。
