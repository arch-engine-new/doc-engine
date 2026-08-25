# Task 1 Brief

## Title
脚手架 monorepo + agent-runtime 包

## Steps
- 初始化根 package.json（workspaces）、packages/agent-runtime、tsconfig、vitest
- MCP: search_arch query=agent runtime（确认仅有 schema SQL 资产）— 可选，空仓可跳过若工具不可用

## Files whitelist (ONLY these)
- package.json
- packages/agent-runtime/package.json
- packages/agent-runtime/tsconfig.json
- packages/agent-runtime/vitest.config.ts
- packages/agent-runtime/src/index.ts

## Verify
npm install && npx tsc -p packages/agent-runtime --noEmit

## Done criteria
- workspace root + agent-runtime package exist
- TypeScript compiles with empty/minimal export
- git commit this task only

## Coding standards (must follow)
# Code Standards（本项目编码规范）

> AI 在本项目中写代码时**必须遵守**以下规范。`/feature` 和 `/implement-plan` 会自动读取本文件并注入到子 Agent 的编码指令中。

## 通用

### 命名
- 变量/函数：camelCase（JS/TS/Java 方法）
- 类/接口/组件：PascalCase
- 常量：UPPER_SNAKE_CASE
- 文件名：组件 PascalCase，工具 camelCase，样式 kebab-case
- 布尔变量：以 is/has/can/should 开头

### 函数
- 单一职责：一个函数只做一件事
- 函数体 ≤ 80 行（超过则拆分）
- 参数 ≤ 5 个（超过则用对象参数）
- TS 函数必须有明确 return type

### 注释
- **关键方法**必须有注释：仓库外可调用入口（`export` / `public` / Go 大写导出 / Python 模块级 `def`）。公共类/方法/字段沿用此条。
- **关键逻辑**必须有行内或块注释：分支 / 状态 / 权限 / 钱 / 日期 / 并发 / 锁定等业务不变量；函数体很长或分支很多时必须注释。
- 注释说为什么，不复述代码在做什么。
- 禁止无意义注释（如 `// set x`、空 TODO）。
- 不要求每个 getter 或每一条 `if` 都写注释。

---

## 前端（React / Vue / 通用）

### 组件化
- **一个文件一个组件**（只 `export default` 一个）
- 组件文件名 = 组件名（PascalCase，如 `UserList.tsx`）
- 组件行数 ≤ 300 行（超过则拆子组件）
- props 必须有 TypeScript `interface` 或 `type` 定义
- 禁止在组件内写内联样式超过 3 个属性

### CSS / 样式
- **公共样式提取到独立文件**（`styles/` 目录或 `*.module.css`）
- 优先使用 CSS Modules 或 styled-components（非内联 `style`）
- 类名用 BEM 规范（`block__element--modifier`）
- 颜色/字号/间距用**设计 tokens**（不从硬编码 `#fff`）
- 禁止 `!important`（除非覆盖第三方库且注释原因）
- 全局 CSS 放 `styles/global.css`，组件 CSS 放组件同目录

### 状态管理
- 组件局部状态用 `useState` / `ref`
- 跨组件状态用 store（Pinia / Zustand / Redux）
- **禁止直接操作 DOM**（`document.querySelector` 等），用框架的 ref

### 列表渲染
- 必须有稳定的 `key`
- **不允许用 index 做 key**（列表项会增删时）

### 前端文件结构（推荐）
```
src/
├── components/          ← 公共组件（跨页面复用）
│   ├── Button/
│   │   ├── index.tsx
│   │   └── style.module.css
│   └── ...
├── pages/               ← 页面组件（路由级）
├── hooks/               ← 自定义 hooks
├── stores/              ← 状态管理
├── services/            ← API 调用层
├── styles/              ← 全局样式 + tokens
│   ├── global.css
│   ├── tokens.css       ← 设计 tokens（颜色/字号/间距）
│   └── reset.css
├── types/               ← TypeScript 类型定义
└── utils/               ← 工具函数
```

---

## 后端（Java）

### 命名（阿里巴巴 Java 开发手册）
- 类名：UpperCamelCase（`UserController`）
- 方法名：lowerCamelCase（`getUserById`）
- 常量：UPPER_SNAKE_CASE（`MAX_PAGE_SIZE`）
- 包名：全小写（`com.xxx.controller`）
- 抽象类用 `Abstract` 开头
- 接口实现类用 `Impl` 结尾
- 测试类用被测类名 + `Test`（`UserServiceTest`）

### 分层架构
- **Controller**：参数校验 + 调 Service（**禁止**直接调 Mapper/Entity）
- **Service**：业务逻辑（可调 Mapper）
- **Mapper/Repository**：数据库操作（不含业务逻辑）
- **Entity**：纯数据载体（不含业务逻辑）
- **DTO**：数据传输对象（接口层与业务层隔离）

### API 设计
- RESTful：GET 查询 / POST 创建 / PUT 更新 / DELETE 删除
- 统一返回 `Result<T>`（`code` / `message` / `data`）
- 分页用 `PageResult<T>`（`list` / `total` / `pageNum` / `pageSize`）
- 参数校验用 `@Valid` + JSR 303 注解

### 异常处理
- 用全局异常处理器（`@ControllerAdvice` + `@ExceptionHandler`）
- **禁止空 catch 块**（至少记日志）
- 业务异常用自定义异常类（`BusinessException`）
- 异常信息不暴露给前端（用统一 code/message）

### 注释（阿里巴巴手册）
- 类必须有 `@author` + 功能说明
- 公共方法必须有 `@param` + `@return` + 功能说明
- 复杂逻辑必须行内注释

---

## 后端（Python）

### 命名（PEP 8）
- 函数/变量：snake_case（`get_user_by_id`）
- 类：PascalCase（`UserController`）
- 常量：UPPER_SNAKE_CASE（`MAX_PAGE_SIZE`）
- 私有：_ 前缀（`_internal_method`）

### 结构
- 一个函数 ≤ 50 行
- 类型注解（`def get_user(user_id: int) -> User:`）
- docstring（公共函数）
- 异常用 `try/except`，不裸 `except:`
- 路由函数用装饰器（`@app.route`）

---

## 后端（Go）

### 命名（Effective Go）
- 导出（公开）：PascalCase（`GetUser`）
- 未导出（私有）：camelCase（`getUser`）
- 接口名：-er 后缀（`Reader` / `Writer` / `Validator`）

### 结构
- 一个文件一个主要类型
- `error` 必须处理（**禁止 `_, _ = fn()`**）
- 包注释（`// Package xxx ...`）
- 不用 `panic` 做正常错误处理（用 `error` 返回）

---

## 数据库

### 表设计（每张业务表必须满足）
- **主键**：`id`，BIGINT 自增（或框架等价）
- **公共审计字段**（框架不自动提供时必须显式声明）：

  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `id` | BIGINT | 主键 |
  | `created_at` / `create_time` | DATETIME | 创建时间 |
  | `updated_at` / `update_time` | DATETIME | 更新时间 |
  | `creator` / `created_by` | VARCHAR(64) | 创建人标识 |
  | `updater` / `updated_by` | VARCHAR(64) | 更新人标识 |
  | `deleted` / `is_deleted` | TINYINT(1) | 逻辑删除标记（0=正常，1=已删） |
  | `tenant_id` | BIGINT | 多租户场景的租户 ID（无多租户可省） |

- **逻辑删除**：用 `deleted TINYINT(1) DEFAULT 0`，**禁止物理删除**业务数据（除非明确数据治

## Report
Write D:/software/doc-engine/.apt/orchestration/task-1-report.md with Status DONE|BLOCKED, commits, test summary
