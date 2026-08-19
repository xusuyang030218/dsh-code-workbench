# dsh-code-workbench

DSH 代码工作台插件：在输入栏添加「💻 代码」按钮，用户可上传代码文件（单/多），AI 读取后进行**修改、优化、重构、审查、评测**，修改后的代码可**一键下载**或**复制**，并展示 **diff 差异视图**与**评测报告**。

## 与 dsh-doc-import 的区别

- `dsh-doc-import`：只读文档/代码 → AI 在对话中回复（无下载、无 diff、无结构化评测）
- `dsh-code-workbench`：专注代码 → AI 修改后生成可下载文件 + diff 视图 + 评测报告

## 核心功能

| 功能 | 描述 |
|------|------|
| 代码上传 | 多选/多拖代码文件（.py/.js/.ts/.java/.go/.rs/.c/.cpp/.html/.css/.sql/.sh 等） |
| 粘贴代码 | 不必落成文件，「+ 粘贴代码」直接建文件参与处理（N1） |
| 勾选圈定 | 文件级 checkbox 决定提交范围，提交按钮实时显示「提交 · N 个文件」（N2） |
| 语法高亮预览 | 源码视图带行号 + 语法高亮（关键字/字符串/注释/数字/函数名/HTML 标签） |
| AI 修改指令 | 操作类型：审查 / 修Bug / 重构 / 性能 / 注释 / 测试 / 转语言 |
| Diff 双模式 | 统一 / 并排切换 + 词级高亮 + 未变更行折叠 + `+N −N` 统计徽章（N5） |
| 版本历史 | 每次修改追加版本记录（AI / 手动编辑 / 回滚），任意两版对比、回滚、下载（N4） |
| 源码可编辑 | 编辑态 textarea 叠加高亮层，保存生成新版本（N3） |
| 评测报告 | AI 生成 Markdown 评测报告，面板内 mini 渲染（N7） |
| 下载 | 单文件（可指定版本）+ 按勾选打包 .zip（N8） |
| 交互 | 快捷键（⌘⏎ 提交 / Esc 关闭 / ⌘F 搜索）、面板最大化、轻量元数据轮询（N9-N11） |
| 历史记录 | 本次会话内所有上传 + 修改记录可回看（内存存储，不持久化） |

## 使用流程

1. 点击输入栏「💻 代码」按钮 → 弹出 v3 三区工作台（顶栏 / 文件栏 / 编辑区 / 命令栏）
2. 拖入/选择代码文件，或「+ 粘贴代码」直接粘贴（支持多选）
3. 勾选要参与的文件（未勾选的不进入提交指令）
4. 在命令栏选择操作类型，可选补充要求
5. 「⌘⏎ 提交 · N 个文件」→ AI 经 `code_workbench` 工具读取/修改/评测
6. 面板轻量轮询，完成后在「源码 / Diff / 报告 / 历史」四视图中查看结果
7. 不满意可「编辑」手动微调保存为新版本、回滚到任意历史版本、按勾选打包下载

## 架构

```
lib/
  client.js              浏览器半（React 面板 + 自写语法高亮 token 化器 + LCS diff）
  host/
    index.mjs            host 工具半：code_workbench 工具 + 系统提示
    web.mjs              web 路由半：上传 / 列表 / 单文件下载 / 打包下载
    parse.mjs            语言检测 + 行数 + 文本解码 + ZIP 打包（node:zlib）
    store.mjs            内存存储 + 版本历史（进程内 Map，不落盘）
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
| POST | `/dsh-code-workbench/paste` | 粘贴代码建文件（body JSON `{ name, content }`） |
| PUT | `/dsh-code-workbench/file/:id` | 手动编辑保存（追加 manual 版本） |
| POST | `/dsh-code-workbench/rollback/:id` | 回滚到指定版本（body `{ to: v }`，追加 rollback 记录） |
| GET | `/dsh-code-workbench/list?meta=1` | 全量记录 / 轻量轮询元数据（不含大字段） |
| GET | `/dsh-code-workbench/version/:id/:v` | 读取指定版本内容（历史查看/对比用） |
| GET | `/dsh-code-workbench/download/:fileId?version=N` | 下载单个文件（指定版本，缺省当前） |
| GET | `/dsh-code-workbench/download-all?ids=a,b` | 按勾选 id 打包 .zip（缺省全部） |

## 安装

```bash
cd C:\Users\23074\.dsh\profiles\web
pnpm add dsh-code-workbench@link:D:\dsh-code-workbench
# 并在 profiles/web/package.json 的 dsh.profile.bundles 中加入 "dsh-code-workbench"
dsh --profile web --dump-config   # 验证加载
```

## License

Apache-2.0
