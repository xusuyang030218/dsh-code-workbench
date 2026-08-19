/**
 * dsh-code-workbench browser 半：输入栏「💻 代码」按钮 + 代码工作台面板。
 *
 * 流程：上传代码（多选/多拖）→ 选择操作类型 → 提交给 AI →
 * AI 经 code_workbench 工具读取/修改/评测 → 面板轮询 /list 展示结果 →
 * 下载单文件 / 打包下载 .zip / diff 视图 / 评测报告。
 *
 * 零外部依赖：语法高亮自写 token 化器、diff 自写 LCS、CSS 内联注入。
 *
 * 装载链：官方 client-modules 扫描 dsh.client 声明后，把本文件以
 * /plugins/dsh-code-workbench/client.js 供给浏览器（window.__ModuleLoader__.load 契约）。
 * React 由平台 require 提供，无需构建。
 */
window.__ModuleLoader__.load({
  id: 'dsh-code-workbench',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    // ===== 微型共享 store：按钮与面板的开合状态 =====
    let open = false
    const listeners = new Set()
    const subscribe = (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }
    const getOpen = () => open
    const setOpen = (v) => {
      open = v
      listeners.forEach((fn) => fn())
    }

    // ===== 常量 =====
    const ACCEPT = '.py,.js,.mjs,.cjs,.jsx,.ts,.tsx,.mts,.cts,.java,.go,.rs,.c,.h,.cc,.cpp,.hpp,.html,.htm,.css,.scss,.less,.sql,.sh,.bash,.zsh,.rb,.php,.swift,.kt,.kts,.vue,.svelte,.json,.xml,.svg,.yaml,.yml,.md,.markdown,.txt,.log,.toml,.conf,.env,.ini,.cfg,.csv,.tsv'

    const ACTIONS = [
      { id: 'optimize', label: '优化性能' },
      { id: 'refactor', label: '重构代码' },
      { id: 'review', label: '代码审查' },
      { id: 'fix', label: '修复Bug' },
      { id: 'comment', label: '添加注释' },
      { id: 'test', label: '添加测试' },
      { id: 'convert', label: '转换语言' },
    ]
    const ACTION_LABEL = ACTIONS.reduce((m, a) => { m[a.id] = a.label; return m }, {})
    const TARGET_LANGS = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C', 'PHP', 'Ruby', 'Kotlin', 'Swift']

    // ===== 语法高亮 token 化器（自写，零依赖） =====
    const set = (arr) => new Set(arr)
    const KW = {
      python: 'def class return if elif else for while import from as with try except finally raise lambda pass break continue yield async await global nonlocal and or not in is None True False del assert print self super'.split(' '),
      javascript: 'var let const function return if else for while do switch case break continue new delete typeof instanceof in of class extends super import export default from async await try catch finally throw yield this null undefined true false void static get set'.split(' '),
      typescript: 'var let const function return if else for while do switch case break continue new delete typeof instanceof in of class extends super import export default from async await try catch finally throw yield this null undefined true false void static get set type interface enum namespace implements declare readonly public private protected abstract keyof infer never unknown any string number boolean symbol'.split(' '),
      java: 'public private protected static final void int long short byte char boolean double float class interface enum extends implements import package return if else for while do switch case break continue new try catch finally throw throws this super null true false abstract synchronized volatile transient instanceof'.split(' '),
      go: 'func var const type struct interface map chan package import return if else for range switch case break continue defer go select fallthrough default nil true false make new len cap append copy delete panic recover'.split(' '),
      rust: 'fn let mut const struct enum impl trait pub crate mod use as return if else for while loop match break continue in ref move where self super Self true false async await dyn box static unsafe extern type'.split(' '),
      c: 'int char float double long short unsigned signed void struct union enum typedef static extern const return if else for while do switch case break continue sizeof goto volatile register auto'.split(' '),
      cpp: 'int char float double long short unsigned signed void struct union enum typedef static extern const return if else for while do switch case break continue sizeof new delete class public private protected virtual template typename namespace using this nullptr true false try catch throw constexpr auto inline friend operator explicit mutable'.split(' '),
      css: 'color background border margin padding width height display position top left right bottom flex grid font text align justify none block inline absolute relative fixed static'.split(' '),
      scss: 'color background border margin padding width height display position top left right bottom flex grid font text align justify none block inline absolute relative fixed static mixin include function return if else for each while extend import use'.split(' '),
      sql: 'select from where insert into values update set delete create table drop alter index view join inner left right full outer on group by having order limit offset as and or not null primary key foreign references unique default case when then else end distinct count sum avg min max'.split(' '),
      bash: 'if then else elif fi for while until do done case esac function in export local read echo printf cd pwd exit return set unset shift trap source alias'.split(' '),
      ruby: 'def end class module require if else elsif unless while until for do yield return begin rescue ensure raise attr_accessor attr_reader attr_writer self nil true false and or not new'.split(' '),
      php: 'function class extends implements public private protected static return if else elseif for foreach while do switch case break continue new echo print include require namespace use as try catch finally throw this null true false and or'.split(' '),
      swift: 'func var let class struct enum extension protocol import return if else for while repeat switch case break continue guard defer do catch try throw throws self super nil true false static lazy weak unowned override public private internal fileprivate open'.split(' '),
      kotlin: 'fun val var class object interface enum package import return if else for while do when break continue try catch finally throw this super null true false data sealed abstract open override companion init lateinit suspend inline vararg'.split(' '),
    }
    const GENERIC_KW = set('return if else for while function class import export new try catch throw true false null undefined var let const async await def self this'.split(' '))

    const LANG_SPECS = {
      python: { line: '#', block: null, strings: ['"', "'"], triple: true, html: false, keywords: set(KW.python) },
      javascript: { line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'], triple: false, html: false, keywords: set(KW.javascript) },
      typescript: { line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'], triple: false, html: false, keywords: set(KW.typescript) },
      java: { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.java) },
      go: { line: '//', block: ['/*', '*/'], strings: ['"', '`'], triple: false, html: false, keywords: set(KW.go) },
      rust: { line: '//', block: ['/*', '*/'], strings: ['"'], triple: false, html: false, keywords: set(KW.rust) },
      c: { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.c) },
      cpp: { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.cpp) },
      css: { line: null, block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.css) },
      scss: { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.scss) },
      sql: { line: '--', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.sql) },
      bash: { line: '#', block: null, strings: ['"', "'"], triple: false, html: false, keywords: set(KW.bash) },
      ruby: { line: '#', block: null, strings: ['"', "'", '`'], triple: false, html: false, keywords: set(KW.ruby) },
      php: { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: set(KW.php) },
      swift: { line: '//', block: ['/*', '*/'], strings: ['"'], triple: false, html: false, keywords: set(KW.swift) },
      kotlin: { line: '//', block: ['/*', '*/'], strings: ['"'], triple: false, html: false, keywords: set(KW.kotlin) },
      html: { line: null, block: ['<!--', '-->'], strings: ['"', "'"], triple: false, html: true, keywords: new Set() },
      xml: { line: null, block: ['<!--', '-->'], strings: ['"', "'"], triple: false, html: true, keywords: new Set() },
      vue: { line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'], triple: false, html: true, keywords: set(KW.javascript) },
      json: { line: null, block: null, strings: ['"'], triple: false, html: false, keywords: new Set() },
      yaml: { line: '#', block: null, strings: ['"', "'"], triple: false, html: false, keywords: new Set() },
      markdown: { line: null, block: null, strings: [], triple: false, html: false, keywords: new Set() },
      text: { line: null, block: null, strings: [], triple: false, html: false, keywords: new Set() },
    }
    const GENERIC_SPEC = { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: GENERIC_KW }

    function tokenize(code, spec) {
      const tokens = []
      const n = code.length
      let i = 0
      let buf = ''
      const flush = (type) => { if (buf) { tokens.push({ type, text: buf }); buf = '' } }
      while (i < n) {
        // 行注释
        if (spec.line && code.startsWith(spec.line, i)) {
          flush('plain')
          const nl = code.indexOf('\n', i)
          const end = nl === -1 ? n : nl
          tokens.push({ type: 'comment', text: code.slice(i, end) })
          i = end
          continue
        }
        // 块注释
        if (spec.block && code.startsWith(spec.block[0], i)) {
          flush('plain')
          const close = code.indexOf(spec.block[1], i + spec.block[0].length)
          const end = close === -1 ? n : close + spec.block[1].length
          tokens.push({ type: 'comment', text: code.slice(i, end) })
          i = end
          continue
        }
        const ch = code[i]
        // 字符串
        if (spec.strings && spec.strings.includes(ch)) {
          if (spec.triple && code.startsWith(ch + ch + ch, i)) {
            flush('plain')
            const close = code.indexOf(ch + ch + ch, i + 3)
            const end = close === -1 ? n : close + 3
            tokens.push({ type: 'string', text: code.slice(i, end) })
            i = end
            continue
          }
          flush('plain')
          let j = i + 1
          while (j < n) {
            const c = code[j]
            if (c === '\\') { j += 2; continue }
            if (c === ch) { j += 1; break }
            if (c === '\n') break
            j += 1
          }
          tokens.push({ type: 'string', text: code.slice(i, j) })
          i = j
          continue
        }
        // HTML/XML 标签
        if (spec.html && ch === '<' && /[A-Za-z!/?]/.test(code[i + 1] || '')) {
          flush('plain')
          let j = i + 1
          while (j < n && code[j] !== '>') j += 1
          tokens.push({ type: 'tag', text: code.slice(i, j + 1) })
          i = j + 1
          continue
        }
        // 数字
        if (/[0-9]/.test(ch)) {
          flush('plain')
          let j = i
          if (code.startsWith('0x', i) || code.startsWith('0X', i)) {
            j += 2
            while (j < n && /[0-9a-fA-F_]/.test(code[j])) j += 1
          } else if (code.startsWith('0b', i) || code.startsWith('0B', i)) {
            j += 2
            while (j < n && /[01_]/.test(code[j])) j += 1
          } else {
            while (j < n && /[0-9_]/.test(code[j])) j += 1
            if (code[j] === '.' && /[0-9]/.test(code[j + 1] || '')) {
              j += 1
              while (j < n && /[0-9_]/.test(code[j])) j += 1
            }
            if (code[j] === 'e' || code[j] === 'E') {
              let k = j + 1
              if (code[k] === '+' || code[k] === '-') k += 1
              if (/[0-9]/.test(code[k] || '')) {
                j = k
                while (j < n && /[0-9_]/.test(code[j])) j += 1
              }
            }
          }
          tokens.push({ type: 'number', text: code.slice(i, j) })
          i = j
          continue
        }
        // 标识符 / 关键字 / 函数名
        if (/[A-Za-z_$]/.test(ch)) {
          flush('plain')
          let j = i
          while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j += 1
          const word = code.slice(i, j)
          let k = j
          while (k < n && /\s/.test(code[k])) k += 1
          if (spec.keywords && spec.keywords.has(word)) tokens.push({ type: 'keyword', text: word })
          else if (code[k] === '(') tokens.push({ type: 'function', text: word })
          else tokens.push({ type: 'plain', text: word })
          i = j
          continue
        }
        buf += ch
        i += 1
      }
      flush('plain')
      return tokens
    }

    function renderHighlighted(code, lang) {
      const spec = LANG_SPECS[lang] || GENERIC_SPEC
      const tokens = tokenize(String(code ?? ''), spec)
      const out = []
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]
        if (t.type === 'plain') out.push(t.text)
        else out.push(React.createElement('span', { key: i, className: 'cw-' + t.type }, t.text))
      }
      return out
    }

    // ===== Diff（自写 LCS 最长公共子序列） =====
    function computeDiff(a, b) {
      const N = a.length
      const M = b.length
      const out = []
      // 过大时退化为逐行对比（避免 O(N*M) 内存爆炸）。
      if (N * M > 4000000) {
        const max = Math.max(N, M)
        for (let i = 0; i < max; i++) {
          const l = a[i]
          const r = b[i]
          if (l === undefined) out.push({ type: 'add', left: null, right: r, lnL: null, lnR: i + 1 })
          else if (r === undefined) out.push({ type: 'del', left: l, right: null, lnL: i + 1, lnR: null })
          else if (l === r) out.push({ type: 'same', left: l, right: r, lnL: i + 1, lnR: i + 1 })
          else out.push({ type: 'mod', left: l, right: r, lnL: i + 1, lnR: i + 1 })
        }
        return out
      }
      const W = M + 1
      const dp = new Uint32Array((N + 1) * W)
      for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
          if (a[i - 1] === b[j - 1]) dp[i * W + j] = dp[(i - 1) * W + (j - 1)] + 1
          else dp[i * W + j] = Math.max(dp[(i - 1) * W + j], dp[i * W + (j - 1)])
        }
      }
      const ops = []
      let i = N
      let j = M
      while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) { ops.push({ type: 'same', aIndex: i - 1, bIndex: j - 1 }); i -= 1; j -= 1 }
        else if (dp[(i - 1) * W + j] >= dp[i * W + (j - 1)]) { ops.push({ type: 'del', aIndex: i - 1 }); i -= 1 }
        else { ops.push({ type: 'add', bIndex: j - 1 }); j -= 1 }
      }
      while (i > 0) { ops.push({ type: 'del', aIndex: i - 1 }); i -= 1 }
      while (j > 0) { ops.push({ type: 'add', bIndex: j - 1 }); j -= 1 }
      ops.reverse()

      // 把相邻的「删除段 + 新增段」等长配对成「修改行」。
      let k = 0
      while (k < ops.length) {
        const op = ops[k]
        if (op.type === 'same') {
          out.push({ type: 'same', left: a[op.aIndex], right: b[op.bIndex], lnL: op.aIndex + 1, lnR: op.bIndex + 1 })
          k += 1
          continue
        }
        let dCount = 0
        while (k + dCount < ops.length && ops[k + dCount].type === 'del') dCount += 1
        let aCount = 0
        while (k + dCount + aCount < ops.length && ops[k + dCount + aCount].type === 'add') aCount += 1
        const pair = Math.min(dCount, aCount)
        for (let p = 0; p < pair; p++) {
          const dOp = ops[k + p]
          const aOp = ops[k + dCount + p]
          out.push({ type: 'mod', left: a[dOp.aIndex], right: b[aOp.bIndex], lnL: dOp.aIndex + 1, lnR: aOp.bIndex + 1 })
        }
        for (let p = pair; p < dCount; p++) {
          const dOp = ops[k + p]
          out.push({ type: 'del', left: a[dOp.aIndex], right: null, lnL: dOp.aIndex + 1, lnR: null })
        }
        for (let p = pair; p < aCount; p++) {
          const aOp = ops[k + dCount + p]
          out.push({ type: 'add', left: null, right: b[aOp.bIndex], lnL: null, lnR: aOp.bIndex + 1 })
        }
        k += dCount + aCount
      }
      return out
    }

    const DIFF_BG = {
      same: 'transparent',
      mod: 'rgba(250, 204, 21, 0.18)',
      add: 'rgba(34, 197, 94, 0.16)',
      del: 'rgba(239, 68, 68, 0.16)',
    }

    // ===== 内联 CSS 注入 =====
    const CSS_TEXT = [
      '.cw-keyword { color: #2563eb; font-weight: 600; }',
      '.cw-string { color: #16a34a; }',
      '.cw-comment { color: #9ca3af; font-style: italic; }',
      '.cw-number { color: #ea580c; }',
      '.cw-function { color: #ca8a04; }',
      '.cw-tag { color: #db2777; }',
      '.cw-code { font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }',
      '.cw-diff { font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 18px; }',
      '.cw-diff-row { display: flex; border-bottom: 1px solid rgba(128,128,128,.12); }',
      '.cw-diff-cell { flex: 1; min-width: 0; padding: 1px 6px; white-space: pre-wrap; word-break: break-all; overflow: hidden; border-right: 1px solid rgba(128,128,128,.12); }',
      '.cw-diff-ln { color: rgba(128,128,128,.7); padding-right: 8px; user-select: none; display: inline-block; min-width: 2em; text-align: right; }',
      '.cw-diff-head .cw-diff-cell { font-weight: 600; color: var(--dsw-alias-label-secondary, #888); }',
    ].join('\n')

    let stylesInjected = false
    function ensureStyles() {
      if (stylesInjected || typeof document === 'undefined') return
      stylesInjected = true
      try {
        const el = document.createElement('style')
        el.setAttribute('data-cw', 'dsh-code-workbench')
        el.textContent = CSS_TEXT
        document.head.appendChild(el)
      } catch { /* 忽略 */ }
    }

    // ===== 工具函数 =====
    function fmtSize(bytes) {
      if (bytes < 1024) return bytes + 'B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
      return (bytes / 1024 / 1024).toFixed(1) + 'MB'
    }
    function downloadUrl(url, name) {
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch { /* 忽略 */ }
    }
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {})
    }
    const btn = (label, onClick, opts) => {
      opts = opts || {}
      return React.createElement('button', {
        type: 'button',
        onClick,
        disabled: !!opts.disabled,
        title: opts.title,
        style: Object.assign(
          { border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, lineHeight: '18px' },
          opts.primary
            ? { background: 'var(--dsw-alias-interactive-bg-active, #2563eb)', color: '#fff' }
            : { background: 'transparent', border: '1px solid rgba(128,128,128,.4)', color: 'var(--dsw-alias-label-primary, inherit)' },
          opts.active ? { background: 'var(--dsw-alias-interactive-bg-active, #2563eb)', color: '#fff' } : {},
          opts.disabled ? { opacity: .5, cursor: 'not-allowed' } : {},
          opts.style || {},
        ),
      }, label)
    }
    const hint = (text) => React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12, padding: '10px 4px' } }, text)

    // ===== 输入栏「💻 代码」按钮 =====
    function CodeButton() {
      const isOpen = React.useSyncExternalStore(subscribe, getOpen)
      const toggle = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setOpen(!isOpen)
      }
      return React.createElement('button', {
        type: 'button',
        title: '代码工作台（上传代码 → AI 修改/优化/审查 → 下载 + diff）',
        'aria-label': '代码工作台',
        onClick: toggle,
        style: {
          border: 'none',
          background: isOpen ? 'rgba(128,128,128,.22)' : 'transparent',
          borderRadius: 8,
          padding: '4px 6px',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        },
      }, '💻')
    }

    // ===== 代码块（语法高亮） =====
    function CodeBlock(props) {
      return React.createElement('pre', {
        className: 'cw-code',
        style: {
          background: 'rgba(128,128,128,.06)',
          border: '1px solid rgba(128,128,128,.18)',
          borderRadius: 8,
          padding: 10,
          margin: '6px 0',
          maxHeight: props.maxHeight || 340,
          overflow: 'auto',
          fontSize: 12,
          lineHeight: '18px',
          whiteSpace: 'pre',
          wordBreak: 'normal',
        },
      }, React.createElement('code', { style: { fontFamily: 'inherit' } }, renderHighlighted(props.code, props.lang)))
    }

    // ===== Diff 视图 =====
    function DiffView(props) {
      const rows = computeDiff(props.original.split(/\r\n|\r|\n/), props.modified.split(/\r\n|\r|\n/))
      const cell = (text, ln, type, side) => {
        const prefix = type === 'del' && side === 'left' ? '- ' : (type === 'add' && side === 'right' ? '+ ' : '')
        return React.createElement('span', null,
          React.createElement('span', { className: 'cw-diff-ln' }, ln == null ? '' : String(ln)),
          React.createElement('span', null, text == null ? '' : prefix + text),
        )
      }
      return React.createElement('div', { className: 'cw-diff' },
        React.createElement('div', { className: 'cw-diff-row cw-diff-head' },
          React.createElement('div', { className: 'cw-diff-cell' }, '原始代码'),
          React.createElement('div', { className: 'cw-diff-cell' }, '修改后代码'),
        ),
        rows.map((r, i) => React.createElement('div', { key: i, className: 'cw-diff-row', style: { background: DIFF_BG[r.type] } },
          React.createElement('div', { className: 'cw-diff-cell' }, cell(r.left, r.lnL, r.type, 'left')),
          React.createElement('div', { className: 'cw-diff-cell' }, cell(r.right, r.lnR, r.type, 'right')),
        )),
      )
    }

    // ===== 工作台面板 =====
    function WorkbenchPanel(props) {
      const isOpen = React.useSyncExternalStore(subscribe, getOpen)
      const inputRef = React.useRef(null)
      const inputActions = props && props.inputActions

      const [files, setFiles] = React.useState([])
      const [action, setAction] = React.useState('')
      const [targetLang, setTargetLang] = React.useState('TypeScript')
      const [extra, setExtra] = React.useState('')
      const [activeTab, setActiveTab] = React.useState('code')
      const [busy, setBusy] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [previewId, setPreviewId] = React.useState(null)

      const refresh = React.useCallback(async () => {
        try {
          const res = await fetch('/dsh-code-workbench/list')
          const data = await res.json().catch(() => null)
          if (!res.ok || !data || data.ok !== true) return false
          const list = data.files || []
          setFiles(list)
          return list.length > 0 && list.every((f) => f.modifiedContent != null)
        } catch {
          return false
        }
      }, [])

      // 打开面板时拉取一次；处理中轮询直到全部有修改结果。
      React.useEffect(() => { if (isOpen) refresh() }, [isOpen, refresh])
      React.useEffect(() => {
        if (!loading || !isOpen) return
        const timer = setInterval(() => {
          refresh().then((allDone) => { if (allDone) setLoading(false) })
        }, 2000)
        return () => clearInterval(timer)
      }, [loading, isOpen, refresh])

      const uploadFile = React.useCallback(async (file) => {
        setBusy((n) => n + 1)
        try {
          const body = await file.arrayBuffer()
          const res = await fetch('/dsh-code-workbench/upload', {
            method: 'POST',
            headers: { 'x-file-name': encodeURIComponent(file.name), 'content-type': 'application/octet-stream' },
            body,
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || `上传失败 HTTP ${res.status}`)
          return { ok: true, file: data.file }
        } catch (e) {
          return { ok: false, name: file.name, error: e instanceof Error ? e.message : String(e) }
        } finally {
          setBusy((n) => n - 1)
        }
      }, [])

      const uploadAll = React.useCallback(async (fileList) => {
        const list = Array.from(fileList || [])
        if (list.length === 0) return
        setError(null)
        const outcomes = await Promise.all(list.map((f) => uploadFile(f)))
        const failed = outcomes.filter((o) => !o.ok)
        if (failed.length > 0) setError(failed.map((e) => e.name + ': ' + e.error).join('；'))
        setFiles((prev) => {
          const map = new Map(prev.map((f) => [f.id, f]))
          for (const o of outcomes) if (o.ok && o.file) map.set(o.file.id, o.file)
          return [...map.values()]
        })
      }, [uploadFile])

      const onPick = (e) => {
        const fl = e.target && e.target.files
        if (fl && fl.length > 0) uploadAll(fl)
        if (e.target) e.target.value = ''
      }
      const onDrop = (e) => {
        e.preventDefault()
        const fl = e.dataTransfer && e.dataTransfer.files
        if (fl && fl.length > 0) uploadAll(fl)
      }
      const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id))

      const buildNote = () => {
        const actionLabel = action === 'convert' ? `转换语言（目标：${targetLang || '未指定'}）` : ACTION_LABEL[action]
        const lines = files.map((f) => `- ${f.name}（${f.lang}，${f.lines} 行，fileId: ${f.id}）`).join('\n')
        return [
          `我已通过「💻 代码」面板上传 ${files.length} 个代码文件：`,
          lines,
          '',
          `操作类型：${actionLabel}`,
          extra.trim() ? `补充要求：${extra.trim()}` : '',
          '',
          '请按以下步骤处理：',
          '1. 调用 code_workbench(action="read", fileId=...) 读取每个文件内容',
          '2. 按上述操作类型对每个文件进行修改',
          '3. 对每个被修改的文件调用 code_workbench(action="modify", fileId=..., modification=该文件修改后的完整代码) 存储修改结果',
          '4. 最后调用 code_workbench(action="review", fileId=..., report=Markdown 格式评测报告，含质量评分/问题列表/改进建议) 生成评测报告',
          '完成后用简短文字说明每个文件的修改要点。',
        ].filter((s) => s !== '').join('\n')
      }

      const submit = () => {
        if (files.length === 0 || !action) return
        if (!inputActions) { setError('未连接到输入框（inputActions 不可用）'); return }
        try {
          inputActions.setDraft(buildNote())
          inputActions.submit()
          setLoading(true)
          setActiveTab('code')
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }

      const insertAndSend = () => {
        const modified = files.filter((f) => f.modifiedContent != null)
        if (modified.length === 0 || !inputActions) return
        const note = `代码工作台处理完成：共 ${files.length} 个文件，${modified.length} 个已生成修改结果（可在面板查看 diff / 下载）。请继续。`
        try {
          inputActions.setDraft(note)
          inputActions.submit()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }

      if (!isOpen) return null

      const modifiedFiles = files.filter((f) => f.modifiedContent != null)
      const hasResult = modifiedFiles.length > 0
      const reportFiles = files.filter((f) => f.report != null && f.report.trim() !== '')

      const tabStyle = (id) => ({
        padding: '5px 12px',
        cursor: 'pointer',
        fontSize: 12,
        border: 'none',
        background: activeTab === id ? 'var(--dsw-alias-interactive-bg-active, #2563eb)' : 'transparent',
        color: activeTab === id ? '#fff' : 'var(--dsw-alias-label-primary, inherit)',
        borderRadius: 6,
      })

      const fileRowStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12, alignItems: 'center' }

      return React.createElement('div', {
        onDragOver: (e) => e.preventDefault(),
        onDrop,
        style: {
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: 0,
          width: 'min(760px, 92vw)',
          boxSizing: 'border-box',
          background: 'var(--dsw-specific-input-major, #fff)',
          border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
          borderRadius: 12,
          boxShadow: '0 10px 34px rgba(0,0,0,.28)',
          padding: 14,
          zIndex: 60,
          fontSize: 13,
          lineHeight: '20px',
          color: 'var(--dsw-alias-label-primary, inherit)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '72vh',
          overflow: 'hidden',
        },
      },
        // 头部
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
          React.createElement('div', { style: { fontWeight: 600 } }, '💻 代码工作台'),
          React.createElement('button', { type: 'button', onClick: () => setOpen(false), style: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--dsw-alias-label-secondary, #888)' } }, '×'),
        ),
        React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12, marginBottom: 10 } }, '上传代码文件 → 选择操作 → AI 修改/优化/审查 → 下载修改后代码 + diff + 评测报告'),
        React.createElement('div', { style: { flex: 1, overflow: 'auto', minHeight: 0 } },
          // 上传区
          React.createElement('input', { ref: inputRef, type: 'file', multiple: true, style: { display: 'none' }, accept: ACCEPT, onChange: onPick }),
          React.createElement('div', {
            style: {
              border: '1px dashed rgba(128,128,128,.5)', borderRadius: 8, padding: '12px 8px', textAlign: 'center',
              color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12, marginBottom: 10, cursor: 'pointer',
            },
            onClick: () => inputRef.current && inputRef.current.click(),
          }, busy > 0 ? '上传解析中…' : '📁 拖入代码文件，或点击选择文件（支持多选）'),
          error && React.createElement('div', { style: { color: 'var(--dsw-alias-state-error-primary, #d33)', marginBottom: 6 } }, '操作失败：' + error),

          // 文件列表
          files.length > 0 && React.createElement('div', { style: { marginBottom: 10 } },
            files.map((f) => React.createElement('div', { key: f.id, style: { border: '1px solid rgba(128,128,128,.18)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 } },
              React.createElement('div', { style: fileRowStyle },
                React.createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  (f.modifiedContent != null ? '✅ ' : '📄 ') + f.name + '（' + f.lang + ' · ' + f.lines + ' 行 · ' + fmtSize(f.size) + '）'),
                btn(previewId === f.id ? '收起' : '预览', () => setPreviewId(previewId === f.id ? null : f.id), { style: { padding: '3px 8px' } }),
                btn('×', () => removeFile(f.id), { style: { padding: '3px 8px' }, title: '移除' }),
              ),
              previewId === f.id && CodeBlock({ code: f.content, lang: f.lang }),
            )),
          ),

          // 操作类型
          React.createElement('div', { style: { marginBottom: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' } }, '操作类型：'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 } },
            ACTIONS.map((a) => btn(a.label, () => setAction(a.id), { active: action === a.id, style: { padding: '4px 10px' } })),
          ),
          action === 'convert' && React.createElement('div', { style: { marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 } },
            React.createElement('span', null, '目标语言：'),
            React.createElement('select', { value: targetLang, onChange: (e) => setTargetLang(e.target.value), style: { fontSize: 12, padding: '4px 6px', borderRadius: 6 } },
              TARGET_LANGS.map((l) => React.createElement('option', { key: l, value: l }, l)),
            ),
          ),

          // 补充要求
          React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)', marginBottom: 4 } }, '补充要求（可选）：'),
          React.createElement('textarea', {
            value: extra,
            onChange: (e) => setExtra(e.target.value),
            placeholder: '例如：把同步改成 async/await、加错误处理',
            rows: 2,
            style: {
              width: '100%', boxSizing: 'border-box', fontSize: 12, lineHeight: '18px', borderRadius: 8,
              padding: '6px 8px', border: '1px solid rgba(128,128,128,.3)', resize: 'vertical', marginBottom: 10,
              background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit',
            },
          }),

          // 提交
          React.createElement('div', { style: { marginBottom: 10 } },
            btn(loading ? '⏳ AI 处理中…（自动刷新）' : '提交给 AI 处理', submit, { primary: true, disabled: files.length === 0 || !action || loading, style: { width: '100%', padding: '8px' } }),
          ),

          // 结果区
          hasResult && React.createElement('div', { style: { borderTop: '1px solid rgba(128,128,128,.2)', paddingTop: 8 } },
            React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
              btn('修改后代码', () => setActiveTab('code'), { active: activeTab === 'code' }),
              btn('Diff 差异', () => setActiveTab('diff'), { active: activeTab === 'diff' }),
              btn('评测报告', () => setActiveTab('report'), { active: activeTab === 'report' }),
            ),
            activeTab === 'code' && modifiedFiles.map((f) => React.createElement('div', { key: f.id, style: { marginBottom: 10 } },
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 } },
                React.createElement('span', { style: { fontWeight: 600, fontSize: 12 } }, f.name + '（修改后）'),
                React.createElement('div', { style: { display: 'flex', gap: 6 } },
                  btn('复制', () => copyText(f.modifiedContent), { style: { padding: '3px 8px' } }),
                  btn('下载', () => downloadUrl('/dsh-code-workbench/download/' + encodeURIComponent(f.id), f.name), { primary: true, style: { padding: '3px 8px' } }),
                ),
              ),
              CodeBlock({ code: f.modifiedContent, lang: f.lang }),
            )),
            activeTab === 'diff' && modifiedFiles.map((f) => React.createElement('div', { key: f.id, style: { marginBottom: 10 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 12, marginBottom: 2 } }, f.name + ' · 差异对比'),
              DiffView({ original: f.content, modified: f.modifiedContent }),
            )),
            activeTab === 'report' && (reportFiles.length > 0
              ? reportFiles.map((f) => React.createElement('div', { key: f.id, style: { marginBottom: 10 } },
                  React.createElement('div', { style: { fontWeight: 600, fontSize: 12, marginBottom: 2 } }, f.name + ' · 评测报告'),
                  React.createElement('pre', { style: { background: 'rgba(128,128,128,.06)', border: '1px solid rgba(128,128,128,.18)', borderRadius: 8, padding: 10, margin: 0, maxHeight: 280, overflow: 'auto', fontSize: 12, lineHeight: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, f.report),
                ))
              : hint('暂无评测报告（AI 生成后显示在这里）')),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
              btn('全部下载(.zip)', () => downloadUrl('/dsh-code-workbench/download-all', 'code-workbench.zip'), { primary: true }),
              btn('刷新结果', () => refresh()),
              btn('插入引用并发送', insertAndSend, { disabled: !inputActions }),
              btn('关闭', () => setOpen(false)),
            ),
          ),
        ),
      )
    }

    const apply = (ctx) => {
      ensureStyles()
      ctx.effect(
        () => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'code-workbench',
          order: 31,
          label: () => '代码',
        }, CodeButton)),
        'dsh-code-workbench: composer left button',
      )
      ctx.effect(
        () => ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
          name: 'conversation.input.overlay',
          id: 'code-workbench',
          order: 31,
          label: () => '代码工作台',
        }, WorkbenchPanel)),
        'dsh-code-workbench: composer overlay panel',
      )
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
