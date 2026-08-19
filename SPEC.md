# dsh-code-workbench 插件规格

> 本文档是交给 DeepSeek Harness (DSH) 的实现指令。DSH 读完本文件后应能完整实现该插件。

## 1. 概述

**插件名**: `dsh-code-workbench`
**版本**: `0.1.0`
**描述**: DSH 代码工作台插件——在输入栏添加「💻 代码」按钮，用户可上传代码文件（单/多），AI 读取后可进行**修改、优化、重构、审查、评测**，修改后的代码可**一键下载**或**复制**，并展示**diff 差异视图**。

**与 dsh-doc-import 的区别**:
- `dsh-doc-import`：只读文档/代码 → AI 在对话中回复（无下载、无 diff、无结构化评测）
- `dsh-code-workbench`：专注代码 → AI 修改后生成可下载文件 + diff 视图 + 评测报告

## 2. 核心功能

| 功能 | 描述 |
|------|------|
| 代码上传 | 支持多选/多拖代码文件（.py/.js/.ts/.java/.go/.rs/.c/.cpp/.html/.css/.sql/.sh 等） |
| 语法高亮预览 | 上传后逐文件显示带语法高亮的代码预览 |
| AI 修改指令 | 用户选择操作类型：优化 / 重构 / 审查 / 修Bug / 加注释 / 加测试 / 转语言 |
| Diff 差异视图 | 原始代码 vs AI 修改后代码的逐行对比（新增绿/删除红/未变灰） |
| 下载修改后代码 | 一键下载单个文件或打包下载多个文件（.zip） |
| 评测报告 | AI 生成结构化代码评测报告（质量评分、问题列表、改进建议） |
| 历史记录 | 本次会话内所有上传+修改记录可回看（存内存即可，不持久化） |

## 3. 用户流程

```
1. 用户点击输入栏「💻 代码」按钮
   → 弹出代码工作台面板（浮层/侧边面板）

2. 用户拖入或选择代码文件（支持多选）
   → 逐文件解析 + 语法高亮预览
   → 每个文件显示：文件名 | 语言 | 行数 | 大小

3. 用户选择操作类型（下拉/按钮组）：
   [优化性能] [重构代码] [代码审查] [修复Bug] [添加注释] [添加测试] [转换语言→]

4. 用户可在输入框补充具体要求（如"把同步改成异步"、"加错误处理"）

5. 点击「提交给 AI」
   → AI 读取全部上传代码 + 用户指令
   → AI 生成修改后的代码

6. 结果展示：
   ├── Tab 1: 修改后代码（语法高亮 + 复制按钮 + 下载按钮）
   ├── Tab 2: Diff 差异视图（原始 vs 修改后）
   ├── Tab 3: 评测报告（评分 + 问题 + 建议）
   └── 底部: 「全部下载(.zip)」|「插入引用并发送」|「关闭」

7. 用户可下载文件，或把结果插入对话继续追问
```

## 4. UI/UX 设计

### 4.1 入口

- 输入栏左侧，「📄 文档」按钮旁新增「💻 代码」按钮
- 点击后面板从右侧滑入（或底部弹出），宽度 60% 视口

### 4.2 面板布局

```
┌─────────────────────────────────────────────┐
│  💻 代码工作台                        [×]   │
├─────────────────────────────────────────────┤
│  📁 拖入代码文件 或 [选择文件]              │
├─────────────────────────────────────────────┤
│  ┌─ app.py ──── Python · 42行 · 1.2KB ─┐   │
│  │  def hello():                        │   │
│  │      print("hello")                  │   │
│  │  ...                    [预览] [×]   │   │
│  └──────────────────────────────────────┘   │
│  ┌─ utils.js ── JavaScript · 18行 · 0.5KB┐  │
│  │  ...                    [预览] [×]    │  │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  操作: [优化] [重构] [审查] [修Bug]        │
│        [加注释] [加测试] [转语言 ▼]        │
├─────────────────────────────────────────────┤
│  补充要求（可选）:                          │
│  ┌──────────────────────────────────────┐  │
│  │  例如：把同步改成 async/await        │  │
│  └──────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│           [提交给 AI 处理]                  │
└─────────────────────────────────────────────┘
```

### 4.3 结果展示

```
┌─────────────────────────────────────────────┐
│  [修改后代码] [Diff 差异] [评测报告]        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ app.py (修改后) ────── [复制] [下载] ┐ │
│  │                                        │ │
│  │  async def hello():                   │ │
│  │      await asyncio.sleep(0)           │ │
│  │      print("hello")                   │ │
│  │  ...                                   │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ utils.js (修改后) ─── [复制] [下载] ─┐ │
│  │  ...                                   │ │
│  └────────────────────────────────────────┘ │
│                                             │
│         [全部下载(.zip)] [插入对话]         │
└─────────────────────────────────────────────┘
```

### 4.4 Diff 视图

```
  原始代码                    修改后代码
┌───────────────────┬───────────────────────┐
│ def hello():      │ async def hello():    │  ← 修改行（黄底）
│     print("hi")   │     await asyncio...  │  ← 修改行（黄底）
│                   │     print("hi")      │
│ def bye():        │ async def bye():     │  ← 修改行（黄底）
│     pass          │     await asyncio... │  ← 新增行（绿底+）
│                   │     pass             │
└───────────────────┴───────────────────────┘
```

## 5. 技术架构

### 5.1 整体结构

```
lib/
  client.js              浏览器半（React 面板 + 语法高亮 + diff 渲染）
  host/
    index.mjs            工具半：code_workbench 工具注册 + 系统提示
    web.mjs              web 路由半：上传 / 修改结果下载 / 打包下载
    parse.mjs            代码解析：语言检测 + 语法高亮 token 化
    store.mjs            内存存储：本次会话的代码文件 + 修改结果
cordis.patch.yml         两行 host 半注册
```

### 5.2 零外部依赖原则

与 dsh-doc-import 保持一致：
- 语法高亮：自己写 token 化器（正则匹配关键字/字符串/注释/数字），不引入 highlight.js / prismjs
- Diff：自己写 LCS 算法计算逐行差异，不引入 diff 库
- ZIP 打包：用 `node:zlib` 手写 ZIP 中央目录（参考 dsh-doc-import 的 parse.mjs）
- 语法高亮 CSS：内联在 client.js 中注入

### 5.3 语言检测

```javascript
// 按扩展名映射语言
const LANG_MAP = {
  '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
  '.jsx': 'javascript', '.tsx': 'typescript',
  '.java': 'java', '.go': 'go', '.rs': 'rust',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c',
  '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.sql': 'sql', '.sh': 'bash', '.rb': 'ruby',
  '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.vue': 'vue', '.json': 'json', '.xml': 'xml',
  '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown',
};
```

## 6. 宿主端 API 设计

### 6.1 上传路由

```
POST /dsh-code-workbench/upload
  Content-Type: multipart/form-data
  Body: files[] (多文件)
  Response:
    {
      "files": [
        { "id": "f1", "name": "app.py", "lang": "python", "size": 1234, "lines": 42, "content": "..." },
        { "id": "f2", "name": "utils.js", "lang": "javascript", "size": 567, "lines": 18, "content": "..." }
      ]
    }
```

### 6.2 修改结果存储路由

```
POST /dsh-code-workbench/result
  Body: { "fileId": "f1", "modifiedContent": "...", "report": "..." }
  Response: { "ok": true, "downloadUrl": "/dsh-code-workbench/download/f1" }
```

### 6.3 下载路由

```
GET /dsh-code-workbench/download/:fileId
  → 返回单个修改后文件（Content-Disposition: attachment）

GET /dsh-code-workbench/download-all
  → 返回 ZIP 包（所有修改后文件打包）
```

### 6.4 列表路由

```
GET /dsh-code-workbench/list
  → 返回当前会话所有已上传文件 + 修改状态
```

## 7. 工具定义

### 7.1 `code_workbench` 工具

```javascript
{
  name: 'code_workbench',
  description: '读取用户上传的代码文件，进行修改/优化/重构/审查。用户通过「💻 代码」按钮上传代码文件并选择操作类型。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'modify', 'review', 'list'],
        description: 'read=读取代码内容, modify=返回修改后代码, review=生成评测报告, list=列出已上传文件'
      },
      fileId: {
        type: 'string',
        description: '指定文件ID（read/modify/review时必传）'
      },
      modification: {
        type: 'string',
        description: 'modify时必传：修改后的完整代码内容'
      },
      report: {
        type: 'string',
        description: 'review时必传：结构化评测报告（Markdown格式）'
      }
    },
    required: ['action']
  }
}
```

### 7.2 系统提示注入

```
当用户通过「💻 代码」按钮上传代码文件后，你可以：
1. 调用 code_workbench(action="read", fileId="...") 读取代码内容
2. 根据用户选择的操作类型（优化/重构/审查/修Bug/加注释/加测试/转语言）处理代码
3. 调用 code_workbench(action="modify", fileId="...", modification="修改后代码") 存储修改结果
4. 调用 code_workbench(action="review", fileId="...", report="评测报告") 生成评测报告
用户可在面板中下载修改后的代码、查看 diff 差异、阅读评测报告。
```

## 8. 客户端交互设计

### 8.1 语法高亮

自己实现简易 token 化器：
- 关键字（蓝色加粗）
- 字符串（绿色）
- 注释（灰色斜体）
- 数字（橙色）
- 函数名（黄色）
- HTML 标签（粉色）

### 8.2 Diff 算法

实现 LCS（最长公共子序列）算法：
- 逐行比较原始代码和修改后代码
- 标记：未变（灰底）/ 修改（黄底）/ 新增（绿底 + `+`）/ 删除（红底 + `-`）

### 8.3 面板状态管理

```
state = {
  files: [],           // 已上传文件列表
  selectedAction: '',  // 用户选择的操作类型
  extraInstructions: '',// 补充要求
  results: [],         // AI 返回的修改结果
  activeTab: 'code',   // 当前展示的 Tab
  loading: false,      // AI 处理中
}
```

### 8.4 ModuleLoader 契约

遵循 DSH 客户端插件契约：
- 导出 `default` React 组件（面板）
- 通过 `@deepseek-ai/dsh-client-runtime` 获取运行时
- 通过 `@deepseek-ai/dsh-client-ui-slots` 注入输入栏按钮

## 9. cordis.patch.yml

```yaml
- id: dsh-code-workbench
  tools:
    - $ref: ./lib/host/index.mjs
- id: dsh-code-workbench-web
  web:
    - $ref: ./lib/host/web.mjs
```

## 10. package.json

```json
{
  "name": "dsh-code-workbench",
  "version": "0.1.0",
  "description": "DSH 代码工作台插件：上传代码 → AI 修改/优化/审查 → 下载修改后代码 + diff 视图 + 评测报告",
  "type": "module",
  "main": "lib/host/index.mjs",
  "exports": {
    ".": "./lib/host/index.mjs",
    "./web": "./lib/host/web.mjs",
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "*",
    "@deepseek-ai/dsh-tools": "*",
    "@deepseek-ai/dsh-host-webserver": "*",
    "@deepseek-ai/dsh-home-paths": "*",
    "@deepseek-ai/dsh-client-runtime": "*",
    "@deepseek-ai/dsh-client-ui-slots": "*"
  },
  "files": ["lib", "cordis.patch.yml", "README.md"],
  "keywords": ["dsh", "code", "workbench", "refactor", "review", "diff"],
  "license": "Apache-2.0"
}
```

## 11. 验收标准

| # | 标准 | 验证方法 |
|---|------|----------|
| 1 | 输入栏出现「💻 代码」按钮 | 刷新浏览器后视觉确认 |
| 2 | 可多选/多拖代码文件上传 | 拖入 2 个 .py 文件，面板显示文件列表 |
| 3 | 上传后显示语法高亮预览 | 点击文件预览，关键字有颜色 |
| 4 | 可选择操作类型并提交给 AI | 选择「优化」→ 输入要求 → 点击提交 → AI 响应 |
| 5 | AI 修改后代码可下载 | 点击下载按钮 → 浏览器下载文件 → 内容正确 |
| 6 | Diff 视图正确显示差异 | 切到 Diff Tab → 新增行绿色 / 修改行黄色 |
| 7 | 评测报告包含评分和建议 | 切到评测 Tab → 有结构化报告 |
| 8 | 多文件可打包下载 | 点击「全部下载」→ 得到 .zip → 解压后文件正确 |
| 9 | 零外部依赖 | package.json 无 dependencies 字段 |
| 10 | `dsh --profile web --dump-config` 显示插件 | 命令行输出包含 dsh-code-workbench |

## 12. 给 DSH 的实现指令

```
请按照 D:\dsh-code-workbench\SPEC.md 的规格实现 dsh-code-workbench 插件。

要求：
1. 在 D:\dsh-code-workbench\ 目录下创建完整的插件项目
2. 严格遵循规格中的文件结构：lib/client.js + lib/host/{index,web,parse,store}.mjs + cordis.patch.yml + package.json
3. 零外部依赖：语法高亮自己写 token 化器，diff 自己写 LCS 算法，ZIP 用 node:zlib
4. 参考已安装的 dsh-doc-import 插件（D:\dsh-doc-import\）的实现模式：
   - client.js 的 ModuleLoader 契约和 React 面板写法
   - host/index.mjs 的工具注册方式
   - host/web.mjs 的路由注册方式
   - host/parse.mjs 的 ZIP 中央目录手写解析
   - host/store.mjs 的存储方式（但本插件用内存存储，不写磁盘）
5. 实现完成后，用以下命令安装到 web profile：
   cd C:\Users\23074\.dsh\profiles\web
   pnpm add dsh-code-workbench@link:D:\dsh-code-workbench
6. 用 dsh --profile web --dump-config 验证插件已加载
7. 重启 dsh web 后刷新浏览器，确认「💻 代码」按钮出现
```
