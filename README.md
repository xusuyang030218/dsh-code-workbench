# dsh-code-workbench

DSH 代码工作台插件：在输入栏添加「💻 代码」按钮，用户可上传代码文件（单/多），AI 读取后进行**修改、优化、重构、审查、评测**，修改后的代码可**一键下载**或**复制**，并展示 **diff 差异视图**与**评测报告**。

## 与 dsh-doc-import 的区别

- `dsh-doc-import`：只读文档/代码 → AI 在对话中回复（无下载、无 diff、无结构化评测）
- `dsh-code-workbench`：专注代码 → AI 修改后生成可下载文件 + diff 视图 + 评测报告

## 核心功能

| 功能 | 描述 |
|------|------|
| 代码上传 | 多选/多拖代码文件（.py/.js/.ts/.java/.go/.rs/.c/.cpp/.html/.css/.sql/.sh 等） |
| 语法高亮预览 | 上传后逐文件显示带语法高亮的代码预览 |
| AI 修改指令 | 操作类型：优化 / 重构 / 审查 / 修Bug / 加注释 / 加测试 / 转语言 |
| Diff 差异视图 | 原始代码 vs 修改后代码逐行对比（新增绿 / 删除红 / 修改黄 / 未变灰） |
| 下载 | 单文件下载 + 多文件打包 .zip 下载 |
| 评测报告 | AI 生成结构化代码评测报告（评分 / 问题 / 建议） |
| 历史记录 | 本次会话内所有上传 + 修改记录可回看（内存存储，不持久化） |

## 使用流程

1. 点击输入栏「💻 代码」按钮 → 弹出代码工作台面板
2. 拖入/选择代码文件（支持多选）→ 逐文件解析 + 语法高亮预览
3. 选择操作类型（优化 / 重构 / 审查 / 修Bug / 加注释 / 加测试 / 转语言）
4. 可选补充具体要求
5. 点击「提交给 AI」→ AI 经 `code_workbench` 工具读取/修改/评测
6. 面板自动刷新，在「修改后代码 / Diff 差异 / 评测报告」三个 Tab 中查看结果
7. 下载单个文件，或「全部下载(.zip)」打包下载

## 架构

```
lib/
  client.js              浏览器半（React 面板 + 自写语法高亮 token 化器 + LCS diff）
  host/
    index.mjs            host 工具半：code_workbench 工具 + 系统提示
    web.mjs              web 路由半：上传 / 列表 / 单文件下载 / 打包下载
    parse.mjs            语言检测 + 行数 + 文本解码 + ZIP 打包（node:zlib）
    store.mjs            内存存储（进程内 Map，不落盘）
cordis.patch.yml         两行 host 半注册
```

## 零外部依赖

- 语法高亮：自写正则 token 化器（关键字/字符串/注释/数字/函数名/HTML 标签）
- Diff：自写 LCS（最长公共子序列）逐行对比
- ZIP：`node:zlib` 的 `deflateRawSync` + 手写中央目录（自带 CRC32 查表实现）
- 语法高亮 CSS：内联在 `client.js` 注入

## 工具

`code_workbench`：`read`（读取代码）/ `modify`（存储修改后代码）/ `review`（存储评测报告）/ `list`（列出文件）。

## 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/dsh-code-workbench/upload` | 上传单个代码文件（原始字节 + `x-file-name`） |
| GET | `/dsh-code-workbench/list` | 当前会话全部文件 + 修改/评测状态 |
| GET | `/dsh-code-workbench/download/:fileId` | 下载单个文件（有修改结果则下载修改后代码） |
| GET | `/dsh-code-workbench/download-all` | 全部文件打包 .zip 下载 |

## 安装

```bash
cd C:\Users\23074\.dsh\profiles\web
pnpm add dsh-code-workbench@link:D:\dsh-code-workbench
# 并在 profiles/web/package.json 的 dsh.profile.bundles 中加入 "dsh-code-workbench"
dsh --profile web --dump-config   # 验证加载
```

## License

Apache-2.0
