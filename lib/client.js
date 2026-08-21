window.__ModuleLoader__.load({
    id: 'dsh-code-workbench',
    factory: (requireFn) => {
        const module = { exports: {} };
        const exports = module.exports;
        const React = requireFn('react');
        // ===== 共享 store：按钮与面板开合 =====
        let open = false;
        const listeners = new Set();
        const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
        const getOpen = () => open;
        const setOpen = (v) => { open = v; listeners.forEach((fn) => fn()); };
        // ===== 常量 =====
        const ACCEPT = '.py,.js,.mjs,.cjs,.jsx,.ts,.tsx,.mts,.cts,.java,.go,.rs,.c,.h,.cc,.cpp,.hpp,.html,.htm,.css,.scss,.less,.sql,.sh,.bash,.zsh,.rb,.php,.swift,.kt,.kts,.vue,.svelte,.json,.xml,.svg,.yaml,.yml,.md,.markdown,.txt,.log,.toml,.conf,.env,.ini,.cfg,.csv,.tsv';
        const SKIP_DIR_PARTS = ['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.cache', '__pycache__', '.idea', '.vscode', '.trae-html-share-packages', 'coverage', '.venv', 'venv', '.turbo', '.yarn', '.pytest_cache', '.mypy_cache'];
        const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.zip', '.gz', '.tar', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib', '.o', '.obj', '.a', '.lib', '.class', '.jar', '.war', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pyc', '.pyo', '.db', '.sqlite', '.sqlite3', '.lockb', '.bin', '.dat', '.wasm', '.node', '.map']);
        const ACTIONS = [
            { id: 'review', label: '审查' },
            { id: 'fix', label: '修Bug' },
            { id: 'refactor', label: '重构' },
            { id: 'optimize', label: '性能' },
            { id: 'comment', label: '注释' },
            { id: 'test', label: '测试' },
            { id: 'convert', label: '转语言' },
        ];
        const ACTION_LABEL = ACTIONS.reduce((m, a) => { m[a.id] = a.label; return m; }, {});
        const TARGET_LANGS = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C', 'PHP', 'Ruby', 'Kotlin', 'Swift'];
        const LANG_TAG = {
            python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs',
            c: 'c', cpp: 'cpp', html: 'html', css: 'css', scss: 'scss', sql: 'sql', bash: 'sh',
            ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt', vue: 'vue', json: 'json',
            xml: 'xml', yaml: 'yaml', markdown: 'md', text: 'txt',
        };
        const SOURCE_LABEL = { upload: '上传', paste: '粘贴', ai: 'AI', manual: '手动编辑', rollback: '回滚' };
        const MAX_FOLDER_FILES = 60;
        // ===== 语法高亮 token 化器 =====
        const set = (arr) => new Set(arr);
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
        };
        const GENERIC_KW = set('return if else for while function class import export new try catch throw true false null undefined var let const async await def self this'.split(' '));
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
        };
        const GENERIC_SPEC = { line: '//', block: ['/*', '*/'], strings: ['"', "'"], triple: false, html: false, keywords: GENERIC_KW };
        function tokenize(code, spec) {
            const tokens = [];
            const n = code.length;
            let i = 0;
            let buf = '';
            const flush = (type) => { if (buf) {
                tokens.push({ type, text: buf });
                buf = '';
            } };
            while (i < n) {
                if (spec.line && code.startsWith(spec.line, i)) {
                    flush('plain');
                    const nl = code.indexOf('\n', i);
                    const end = nl === -1 ? n : nl;
                    tokens.push({ type: 'comment', text: code.slice(i, end) });
                    i = end;
                    continue;
                }
                if (spec.block && code.startsWith(spec.block[0], i)) {
                    flush('plain');
                    const close = code.indexOf(spec.block[1], i + spec.block[0].length);
                    const end = close === -1 ? n : close + spec.block[1].length;
                    tokens.push({ type: 'comment', text: code.slice(i, end) });
                    i = end;
                    continue;
                }
                const ch = code[i];
                if (spec.strings && spec.strings.includes(ch)) {
                    if (spec.triple && code.startsWith(ch + ch + ch, i)) {
                        flush('plain');
                        const close = code.indexOf(ch + ch + ch, i + 3);
                        const end = close === -1 ? n : close + 3;
                        tokens.push({ type: 'string', text: code.slice(i, end) });
                        i = end;
                        continue;
                    }
                    flush('plain');
                    let j = i + 1;
                    while (j < n) {
                        const c = code[j];
                        if (c === '\\') {
                            j += 2;
                            continue;
                        }
                        if (c === ch) {
                            j += 1;
                            break;
                        }
                        if (c === '\n')
                            break;
                        j += 1;
                    }
                    tokens.push({ type: 'string', text: code.slice(i, j) });
                    i = j;
                    continue;
                }
                if (spec.html && ch === '<' && /[A-Za-z!/?]/.test(code[i + 1] || '')) {
                    flush('plain');
                    let j = i + 1;
                    while (j < n && code[j] !== '>')
                        j += 1;
                    tokens.push({ type: 'tag', text: code.slice(i, j + 1) });
                    i = j + 1;
                    continue;
                }
                if (/[0-9]/.test(ch)) {
                    flush('plain');
                    let j = i;
                    if (code.startsWith('0x', i) || code.startsWith('0X', i)) {
                        j += 2;
                        while (j < n && /[0-9a-fA-F_]/.test(code[j]))
                            j += 1;
                    }
                    else if (code.startsWith('0b', i) || code.startsWith('0B', i)) {
                        j += 2;
                        while (j < n && /[01_]/.test(code[j]))
                            j += 1;
                    }
                    else {
                        while (j < n && /[0-9_]/.test(code[j]))
                            j += 1;
                        if (code[j] === '.' && /[0-9]/.test(code[j + 1] || '')) {
                            j += 1;
                            while (j < n && /[0-9_]/.test(code[j]))
                                j += 1;
                        }
                        if (code[j] === 'e' || code[j] === 'E') {
                            let k = j + 1;
                            if (code[k] === '+' || code[k] === '-')
                                k += 1;
                            if (/[0-9]/.test(code[k] || '')) {
                                j = k;
                                while (j < n && /[0-9_]/.test(code[j]))
                                    j += 1;
                            }
                        }
                    }
                    tokens.push({ type: 'number', text: code.slice(i, j) });
                    i = j;
                    continue;
                }
                if (/[A-Za-z_$]/.test(ch)) {
                    flush('plain');
                    let j = i;
                    while (j < n && /[A-Za-z0-9_$]/.test(code[j]))
                        j += 1;
                    const word = code.slice(i, j);
                    let k = j;
                    while (k < n && /\s/.test(code[k]))
                        k += 1;
                    if (spec.keywords && spec.keywords.has(word))
                        tokens.push({ type: 'keyword', text: word });
                    else if (code[k] === '(')
                        tokens.push({ type: 'function', text: word });
                    else
                        tokens.push({ type: 'plain', text: word });
                    i = j;
                    continue;
                }
                buf += ch;
                i += 1;
            }
            flush('plain');
            return tokens;
        }
        function renderHighlighted(code, lang) {
            const spec = LANG_SPECS[lang] || GENERIC_SPEC;
            const tokens = tokenize(String(code ?? ''), spec);
            const out = [];
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (t.type === 'plain')
                    out.push(t.text);
                else
                    out.push(React.createElement('span', { key: i, className: 'cw-' + t.type }, t.text));
            }
            return out;
        }
        function lcsOps(a, b) {
            const N = a.length;
            const M = b.length;
            if (N * M > 4000000)
                return null;
            const W = M + 1;
            const dp = new Uint32Array((N + 1) * W);
            for (let i = 1; i <= N; i++) {
                for (let j = 1; j <= M; j++) {
                    if (a[i - 1] === b[j - 1])
                        dp[i * W + j] = dp[(i - 1) * W + (j - 1)] + 1;
                    else
                        dp[i * W + j] = Math.max(dp[(i - 1) * W + j], dp[i * W + (j - 1)]);
                }
            }
            const ops = [];
            let i = N;
            let j = M;
            while (i > 0 && j > 0) {
                if (a[i - 1] === b[j - 1]) {
                    ops.push({ type: 'same', aIndex: i - 1, bIndex: j - 1 });
                    i -= 1;
                    j -= 1;
                }
                else if (dp[(i - 1) * W + j] >= dp[i * W + (j - 1)]) {
                    ops.push({ type: 'del', aIndex: i - 1 });
                    i -= 1;
                }
                else {
                    ops.push({ type: 'add', bIndex: j - 1 });
                    j -= 1;
                }
            }
            while (i > 0) {
                ops.push({ type: 'del', aIndex: i - 1 });
                i -= 1;
            }
            while (j > 0) {
                ops.push({ type: 'add', bIndex: j - 1 });
                j -= 1;
            }
            ops.reverse();
            return ops;
        }
        function splitLines(text) {
            const s = String(text ?? '');
            return s === '' ? [] : s.split(/\r\n|\r|\n/);
        }
        function lineDiffRows(aText, bText) {
            const a = splitLines(aText);
            const b = splitLines(bText);
            const N = a.length;
            const M = b.length;
            const out = [];
            if (N * M > 4000000) {
                const max = Math.max(N, M);
                for (let i = 0; i < max; i++) {
                    const l = a[i];
                    const r = b[i];
                    if (l === undefined)
                        out.push({ type: 'add', left: null, right: r, lnL: null, lnR: i + 1 });
                    else if (r === undefined)
                        out.push({ type: 'del', left: l, right: null, lnL: i + 1, lnR: null });
                    else if (l === r)
                        out.push({ type: 'same', left: l, right: r, lnL: i + 1, lnR: i + 1 });
                    else
                        out.push({ type: 'mod', left: l, right: r, lnL: i + 1, lnR: i + 1 });
                }
                return out;
            }
            const ops = lcsOps(a, b) || [];
            let k = 0;
            while (k < ops.length) {
                const op = ops[k];
                if (op.type === 'same') {
                    out.push({ type: 'same', left: a[op.aIndex], right: b[op.bIndex], lnL: op.aIndex + 1, lnR: op.bIndex + 1 });
                    k += 1;
                    continue;
                }
                let dCount = 0;
                while (k + dCount < ops.length && ops[k + dCount].type === 'del')
                    dCount += 1;
                let aCount = 0;
                while (k + dCount + aCount < ops.length && ops[k + dCount + aCount].type === 'add')
                    aCount += 1;
                const pair = Math.min(dCount, aCount);
                for (let p = 0; p < pair; p++) {
                    const dOp = ops[k + p];
                    const aOp = ops[k + dCount + p];
                    out.push({ type: 'mod', left: a[dOp.aIndex], right: b[aOp.bIndex], lnL: dOp.aIndex + 1, lnR: aOp.bIndex + 1 });
                }
                for (let p = pair; p < dCount; p++) {
                    const dOp = ops[k + p];
                    out.push({ type: 'del', left: a[dOp.aIndex], right: null, lnL: dOp.aIndex + 1, lnR: null });
                }
                for (let p = pair; p < aCount; p++) {
                    const aOp = ops[k + dCount + p];
                    out.push({ type: 'add', left: null, right: b[aOp.bIndex], lnL: null, lnR: aOp.bIndex + 1 });
                }
                k += dCount + aCount;
            }
            return out;
        }
        function wordDiffSpans(leftLine, rightLine) {
            const a = Array.from(leftLine);
            const b = Array.from(rightLine);
            const ops = lcsOps(a, b);
            const fallback = { left: [{ type: 'same', text: leftLine }], right: [{ type: 'same', text: rightLine }] };
            if (!ops)
                return fallback;
            const left = [];
            const right = [];
            const merge = (arr, type, text) => {
                if (!text)
                    return;
                const last = arr[arr.length - 1];
                if (last && last.type === type)
                    last.text += text;
                else
                    arr.push({ type, text });
            };
            for (const op of ops) {
                if (op.type === 'same') {
                    merge(left, 'same', a[op.aIndex]);
                    merge(right, 'same', b[op.bIndex]);
                }
                else if (op.type === 'del')
                    merge(left, 'del', a[op.aIndex]);
                else
                    merge(right, 'add', b[op.bIndex]);
            }
            return { left, right };
        }
        function foldSame(rows, ctx = 3, threshold = 6) {
            const out = [];
            let i = 0;
            const n = rows.length;
            while (i < n) {
                if (rows[i].type === 'same') {
                    let j = i;
                    while (j < n && rows[j].type === 'same')
                        j += 1;
                    const len = j - i;
                    if (len > threshold) {
                        for (let k = i; k < Math.min(i + ctx, j); k++)
                            out.push(rows[k]);
                        out.push({ type: 'folded', count: len - 2 * ctx });
                        for (let k = Math.max(j - ctx, i); k < j; k++)
                            out.push(rows[k]);
                    }
                    else {
                        for (let k = i; k < j; k++)
                            out.push(rows[k]);
                    }
                    i = j;
                }
                else {
                    out.push(rows[i]);
                    i += 1;
                }
            }
            return out;
        }
        function diffStats(rows) {
            let add = 0;
            let del = 0;
            for (const r of rows) {
                if (r.type === 'add')
                    add += 1;
                else if (r.type === 'del')
                    del += 1;
                else if (r.type === 'mod') {
                    add += 1;
                    del += 1;
                }
            }
            return { add, del };
        }
        // ===== mini Markdown 渲染 =====
        function parseInline(text) {
            const parts = [];
            const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
            let last = 0;
            let key = 0;
            let m;
            while ((m = re.exec(text))) {
                if (m.index > last)
                    parts.push(text.slice(last, m.index));
                const tok = m[0];
                if (tok.startsWith('**'))
                    parts.push(React.createElement('strong', { key: 'b' + key }, tok.slice(2, -2)));
                else if (tok.startsWith('`'))
                    parts.push(React.createElement('code', { key: 'c' + key, className: 'cw-mdc' }, tok.slice(1, -1)));
                else if (tok.startsWith('['))
                    parts.push(React.createElement('a', { key: 'a' + key, href: m[3], target: '_blank', rel: 'noreferrer' }, m[2]));
                else
                    parts.push(React.createElement('em', { key: 'e' + key }, tok.slice(1, -1)));
                last = re.lastIndex;
                key += 1;
            }
            if (last < text.length)
                parts.push(text.slice(last));
            return parts;
        }
        function renderMarkdown(md) {
            const lines = splitLines(md);
            const out = [];
            let inCode = false;
            let codeBuf = [];
            let tableBuf = [];
            let listBuf = [];
            let listType = null;
            let key = 0;
            const flushList = () => {
                if (listBuf.length === 0)
                    return;
                out.push(React.createElement(listType === 'ol' ? 'ol' : 'ul', { key: 'l' + key, style: { margin: '4px 0', paddingLeft: 22 } }, listBuf.map((li, idx) => React.createElement('li', { key: idx, style: { marginBottom: 2 } }, li))));
                listBuf = [];
                listType = null;
            };
            const flushTable = () => {
                if (tableBuf.length === 0)
                    return;
                const head = tableBuf[0];
                out.push(React.createElement('table', { key: 't' + key, style: { borderCollapse: 'collapse', fontSize: 12, margin: '6px 0' } }, React.createElement('thead', null, React.createElement('tr', null, head.map((c, i) => React.createElement('th', { key: i, style: { border: '1px solid rgba(128,128,128,.25)', padding: '3px 8px', textAlign: 'left' } }, c)))), React.createElement('tbody', null, tableBuf.slice(1).map((row, ri) => React.createElement('tr', { key: ri }, row.map((c, ci) => React.createElement('td', { key: ci, style: { border: '1px solid rgba(128,128,128,.25)', padding: '3px 8px' } }, c)))))));
                tableBuf = [];
            };
            for (const raw of lines) {
                const line = raw.replace(/\s+$/, '');
                key += 1;
                if (inCode) {
                    if (/^\s*(```|~~~)/.test(line)) {
                        inCode = false;
                        out.push(React.createElement('pre', { key: 'pc' + key, className: 'cw-code', style: { background: 'rgba(128,128,128,.07)', border: '1px solid rgba(128,128,128,.18)', borderRadius: 8, padding: 8, overflow: 'auto', fontSize: 12, lineHeight: '18px', margin: '4px 0' } }, React.createElement('code', { style: { fontFamily: 'inherit' } }, codeBuf.join('\n'))));
                        codeBuf = [];
                    }
                    else {
                        codeBuf.push(line);
                    }
                    continue;
                }
                const fence = line.match(/^\s*(```|~~~)\s*(\S*)/);
                if (fence) {
                    flushList();
                    flushTable();
                    inCode = true;
                    codeBuf = [];
                    continue;
                }
                const h = line.match(/^(#{1,6})\s+(.*)$/);
                if (h) {
                    flushList();
                    flushTable();
                    const lvl = h[1].length;
                    out.push(React.createElement('div', { key: 'h' + key, style: { fontWeight: 700, fontSize: lvl <= 2 ? 15 : lvl === 3 ? 13.5 : 12.5, margin: '8px 0 3px' } }, parseInline(h[2])));
                    continue;
                }
                const lm = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
                if (lm) {
                    flushTable();
                    const isOl = /^\d+[.)]/.test(lm[1]);
                    if (listType && listType !== (isOl ? 'ol' : 'ul'))
                        flushList();
                    listType = isOl ? 'ol' : 'ul';
                    listBuf.push(parseInline(lm[2]));
                    continue;
                }
                flushList();
                if (/^\s*\|.*\|\s*$/.test(line) && line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').includes('|')) {
                    const rawCells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
                    const isSepRow = rawCells.length > 1 && rawCells.every((c) => /^:?-{2,}:?$/.test(c));
                    if (isSepRow) {
                        flushTable();
                        continue;
                    }
                    tableBuf.push(rawCells.map((c) => parseInline(c)));
                    continue;
                }
                flushTable();
                if (/^\s*---+\s*$/.test(line)) {
                    out.push(React.createElement('hr', { key: 'hr' + key, style: { border: 'none', borderTop: '1px solid rgba(128,128,128,.25)', margin: '8px 0' } }));
                    continue;
                }
                if (/^\s*>\s?/.test(line)) {
                    out.push(React.createElement('div', { key: 'q' + key, style: { borderLeft: '3px solid rgba(37,99,235,.5)', paddingLeft: 10, margin: '4px 0', color: 'var(--dsw-alias-label-secondary, #5c6b85)' } }, parseInline(line.replace(/^\s*>\s?/, ''))));
                    continue;
                }
                if (line.trim() === '') {
                    out.push(React.createElement('div', { key: 'sp' + key, style: { height: 6 } }));
                    continue;
                }
                out.push(React.createElement('div', { key: 'p' + key, style: { margin: '2px 0' } }, parseInline(line)));
            }
            if (inCode) {
                out.push(React.createElement('pre', { key: 'pcx', className: 'cw-code', style: { background: 'rgba(128,128,128,.07)', border: '1px solid rgba(128,128,128,.18)', borderRadius: 8, padding: 8, overflow: 'auto', fontSize: 12, lineHeight: '18px', margin: '4px 0' } }, codeBuf.join('\n')));
            }
            flushList();
            flushTable();
            return out;
        }
        // ===== 内联 CSS =====
        const CSS_TEXT = [
            '.cw-keyword { color: #2563eb; font-weight: 600; }',
            '.cw-string { color: #16a34a; }',
            '.cw-comment { color: #9ca3af; font-style: italic; }',
            '.cw-number { color: #ea580c; }',
            '.cw-function { color: #ca8a04; }',
            '.cw-tag { color: #db2777; }',
            '.cw-code { font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }',
            '.cw-mdc { font-family: ui-monospace, Consolas, monospace; font-size: .92em; background: rgba(37,99,235,.1); color: #2563eb; padding: 0 3px; border-radius: 3px; }',
            '.cw-diff { font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 18px; }',
            '.cw-diff-ln { color: rgba(128,128,128,.7); display: inline-block; min-width: 2.2em; text-align: right; padding-right: 8px; user-select: none; }',
            '.cw-diff-fold { display: flex; align-items: center; gap: 8px; padding: 2px 14px; margin: 2px 0; }',
            '.cw-wdel { background: rgba(220,38,38,.16); border-radius: 3px; }',
            '.cw-wadd { background: rgba(22,163,74,.2); border-radius: 3px; }',
            '.cw-tag-lang { font-family: ui-monospace, Consolas, monospace; font-size: 9.5px; font-weight: 700; border-radius: 4px; padding: 0 5px; letter-spacing: .03em; background: rgba(37,99,235,.1); color: #2563eb; flex-shrink: 0; }',
            '.cw-scroll::-webkit-scrollbar { width: 8px; height: 8px; }',
            '.cw-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,.35); border-radius: 4px; }',
        ].join('\n');
        let stylesInjected = false;
        function ensureStyles() {
            if (stylesInjected || typeof document === 'undefined')
                return;
            stylesInjected = true;
            try {
                const el = document.createElement('style');
                el.setAttribute('data-cw', 'dsh-code-workbench');
                el.textContent = CSS_TEXT;
                document.head.appendChild(el);
            }
            catch { /* 忽略 */ }
        }
        // ===== 工具函数 =====
        function fmtSize(bytes) {
            if (bytes < 1024)
                return bytes + 'B';
            if (bytes < 1024 * 1024)
                return (bytes / 1024).toFixed(1) + 'KB';
            return (bytes / 1024 / 1024).toFixed(1) + 'MB';
        }
        function fmtTime(ts) {
            const d = new Date(ts);
            const p = (x) => String(x).padStart(2, '0');
            return p(d.getHours()) + ':' + p(d.getMinutes());
        }
        function downloadUrl(url, name) {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            catch { /* 忽略 */ }
        }
        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText)
                navigator.clipboard.writeText(text).catch(() => { });
        }
        const btn = (label, onClick, opts) => {
            opts = opts || {};
            return React.createElement('button', {
                type: 'button',
                onClick,
                disabled: !!opts.disabled,
                title: opts.title,
                style: Object.assign({ border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, lineHeight: '18px', whiteSpace: 'nowrap' }, opts.primary
                    ? { background: '#2563eb', color: '#fff', fontWeight: 600 }
                    : { background: 'transparent', border: '1px solid rgba(128,128,128,.35)', color: 'var(--dsw-alias-label-primary, #1e293b)' }, opts.active ? { background: 'rgba(37,99,235,.1)', borderColor: 'rgba(37,99,235,.45)', color: '#2563eb', fontWeight: 600 } : {}, opts.ghost ? { borderColor: 'transparent', background: 'transparent', color: 'var(--dsw-alias-label-secondary, #8493ab)' } : {}, opts.disabled ? { opacity: .5, cursor: 'not-allowed' } : {}, opts.style || {}),
            }, label);
        };
        const hint = (text) => React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary, #8493ab)', fontSize: 12, padding: '10px 4px' } }, text);
        // ===== 输入栏按钮 =====
        function CodeButton() {
            const isOpen = React.useSyncExternalStore(subscribe, getOpen);
            const toggle = (e) => { e.preventDefault(); e.stopPropagation(); setOpen(!isOpen); };
            return React.createElement('button', {
                type: 'button',
                title: '代码工作台（上传/粘贴/文件夹导入 → AI 修改 → 下载 + diff + 版本历史 + AI 直连）',
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
            }, '💻');
        }
        // ===== 行号高亮代码块 =====
        function LineCode(props) {
            const lines = splitLines(props.code);
            return React.createElement('div', { className: 'cw-scroll cw-code', style: { overflow: 'auto', maxHeight: props.maxHeight || 340, background: 'rgba(128,128,128,.05)', border: '1px solid rgba(128,128,128,.16)', borderRadius: 8, margin: '6px 0' } }, lines.map((line, i) => React.createElement('div', { key: i, style: { display: 'flex', padding: '0 10px', lineHeight: '18px' } }, React.createElement('span', { style: { color: 'rgba(128,128,128,.6)', minWidth: '2.4em', textAlign: 'right', paddingRight: 10, userSelect: 'none', flexShrink: 0 } }, String(i + 1)), React.createElement('span', { style: { whiteSpace: 'pre', flex: 1, minWidth: 0, overflow: 'hidden' } }, line === '' ? ' ' : renderHighlighted(line, props.lang)))));
        }
        // ===== 源码视图（行号 + 高亮 + 编辑态叠加） =====
        function CodeView(props) {
            const { file, editing, editText, onEditChange, onSave, onCancel, onCopy, onCopyLines, onDownload } = props;
            const preRef = React.useRef(null);
            const lnRef = React.useRef(null);
            const code = editing ? editText : (file.current > 1 ? file.modifiedContent : file.content);
            const lines = splitLines(code);
            const onScroll = (e) => {
                const ta = e.target;
                if (preRef.current) {
                    preRef.current.scrollTop = ta.scrollTop;
                    preRef.current.scrollLeft = ta.scrollLeft;
                }
                if (lnRef.current)
                    lnRef.current.scrollTop = ta.scrollTop;
            };
            const base = { fontFamily: 'inherit', fontSize: 12, lineHeight: '18px', whiteSpace: 'pre', margin: 0, padding: '8px 10px', tabSize: 2 };
            const header = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,.15)', fontSize: 11.5 } }, React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary, #8493ab)' } }, editing ? '编辑中…' : '源码'), React.createElement('span', { style: { flex: 1 } }), !editing && btn('⧉ 复制', onCopy, { ghost: true, style: { padding: '2px 8px' } }), !editing && btn('复制带行号', onCopyLines, { ghost: true, style: { padding: '2px 8px' } }), !editing && btn('⬇ 下载', onDownload, { style: { padding: '2px 8px' } }), editing
                ? React.createElement('span', { style: { display: 'flex', gap: 6 } }, btn('取消', onCancel, { style: { padding: '2px 8px' } }), btn('保存为新版本', onSave, { primary: true, style: { padding: '2px 8px' } }))
                : btn('编辑', () => props.onStartEdit(), { style: { padding: '2px 8px' } }));
            if (!editing) {
                return React.createElement('div', { style: { border: '1px solid rgba(128,128,128,.16)', borderRadius: 8, background: 'rgba(128,128,128,.05)', overflow: 'hidden' } }, header, React.createElement(LineCode, { code, lang: file.lang, maxHeight: props.maxHeight || 360 }));
            }
            return React.createElement('div', { style: { border: '1px solid rgba(128,128,128,.16)', borderRadius: 8, background: 'rgba(128,128,128,.05)', overflow: 'hidden' } }, header, React.createElement('div', { style: { display: 'flex', maxHeight: props.maxHeight || 360 } }, React.createElement('div', { ref: lnRef, className: 'cw-scroll', style: { width: 44, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.04)', borderRight: '1px solid rgba(128,128,128,.12)', padding: '8px 0', fontSize: 12, lineHeight: '18px', textAlign: 'right', color: 'rgba(128,128,128,.6)', userSelect: 'none' } }, lines.map((_, i) => React.createElement('div', { key: i, style: { paddingRight: 8 } }, String(i + 1)))), React.createElement('div', { style: { position: 'relative', flex: 1, minWidth: 0 } }, React.createElement('pre', { ref: preRef, className: 'cw-code', style: Object.assign({}, base, { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', color: 'var(--dsw-alias-label-primary, #1e293b)' }), 'aria-hidden': 'true' }, React.createElement('code', { style: { fontFamily: 'inherit' } }, lines.map((line, i) => React.createElement('span', { key: i }, line === '' ? ' ' : renderHighlighted(line, file.lang), '\n')))), React.createElement('textarea', {
                value: code,
                onChange: (e) => onEditChange(e.target.value),
                onScroll,
                spellCheck: false,
                className: 'cw-scroll cw-code',
                style: Object.assign({}, base, {
                    position: 'relative', width: '100%', height: props.maxHeight || 360, boxSizing: 'border-box',
                    border: 'none', outline: 'none', resize: 'none', background: 'transparent',
                    color: 'transparent', caretColor: 'var(--dsw-alias-label-primary, #1e293b)', overflow: 'auto',
                }),
            }))));
        }
        // ===== Diff 视图 =====
        const DIFF_BG = {
            same: 'transparent', mod: 'rgba(180, 83, 9, 0.12)', add: 'rgba(22, 163, 74, 0.10)', del: 'rgba(220, 38, 38, 0.09)',
        };
        function DiffView(props) {
            const { leftText, rightText, mode, showFold } = props;
            const [expanded, setExpanded] = React.useState(new Set());
            const rows = lineDiffRows(leftText, rightText);
            const folded = showFold ? foldSame(rows) : rows;
            const stats = diffStats(rows);
            const foldKeyOf = (idx) => { let key = 0; for (let i = 0; i < idx; i++)
                if (folded[i].type === 'folded')
                    key += 1; return key; };
            const rowBg = (type) => DIFF_BG[type] || 'transparent';
            const wordCache = {};
            const getWordSpans = (l, r) => {
                const k = l + '\u0001' + r;
                if (!wordCache[k])
                    wordCache[k] = wordDiffSpans(l, r);
                return wordCache[k];
            };
            const lnStyle = { color: 'rgba(128,128,128,.6)', display: 'inline-block', minWidth: '2.2em', textAlign: 'right', paddingRight: 8, userSelect: 'none' };
            const foldRow = (r, i) => {
                const k = foldKeyOf(i);
                return React.createElement('div', { key: 'f' + i, className: 'cw-diff-fold' }, React.createElement('span', { style: { flex: 1, borderTop: '1px dashed rgba(128,128,128,.35)' } }), React.createElement('button', {
                    type: 'button',
                    onClick: () => setExpanded((prev) => { const s = new Set(prev); if (s.has(k))
                        s.delete(k);
                    else
                        s.add(k); return s; }),
                    style: { border: 'none', background: 'rgba(128,128,128,.08)', borderRadius: 999, padding: '1px 12px', fontSize: 10.5, color: 'var(--dsw-alias-label-secondary, #8493ab)', cursor: 'pointer', whiteSpace: 'nowrap' },
                }, expanded.has(k) ? '收起' : ('⋯ ' + r.count + ' 行未变更 · 点击展开 ⋯')), React.createElement('span', { style: { flex: 1, borderTop: '1px dashed rgba(128,128,128,.35)' } }));
            };
            const modSpans = (r, side) => {
                const spans = getWordSpans(r.left, r.right);
                const arr = side === 'left' ? spans.left : spans.right;
                return arr.map((s, si) => s.type === 'same' ? s.text : React.createElement('span', { key: si, className: side === 'left' ? 'cw-wdel' : 'cw-wadd' }, s.text));
            };
            const simpleCell = (text, ln, type) => React.createElement('span', null, React.createElement('span', { style: lnStyle }, ln || ''), React.createElement('span', null, (type === 'del' ? '− ' : type === 'add' ? '+ ' : '') + text));
            if (mode === 'split') {
                return React.createElement('div', { className: 'cw-diff', style: { border: '1px solid rgba(128,128,128,.16)', borderRadius: 8, overflow: 'hidden' } }, React.createElement('div', { style: { display: 'flex', background: 'rgba(128,128,128,.05)', borderBottom: '1px solid rgba(128,128,128,.15)', fontSize: 11.5, fontWeight: 600, color: 'var(--dsw-alias-label-secondary, #8493ab)' } }, React.createElement('div', { style: { flex: 1, padding: '4px 12px' } }, '原始代码'), React.createElement('div', { style: { flex: 1, padding: '4px 12px', borderLeft: '1px solid rgba(128,128,128,.15)' } }, '修改后代码')), React.createElement('div', { className: 'cw-scroll', style: { maxHeight: props.maxHeight || 380, overflow: 'auto' } }, folded.map((r, i) => {
                    if (r.type === 'folded')
                        return foldRow(r, i);
                    const left = r.type === 'add' ? '' : (r.type === 'mod' ? modSpans(r, 'left') : simpleCell(r.left || '', r.lnL, r.type));
                    const right = r.type === 'del' ? '' : (r.type === 'mod' ? modSpans(r, 'right') : simpleCell(r.right || '', r.lnR, r.type));
                    return React.createElement('div', { key: i, style: { display: 'flex', background: rowBg(r.type) } }, React.createElement('div', { style: { flex: 1, minWidth: 0, padding: '1px 6px 1px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, left), React.createElement('div', { style: { flex: 1, minWidth: 0, padding: '1px 6px 1px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', borderLeft: '1px solid rgba(128,128,128,.12)' } }, right));
                })));
            }
            return React.createElement('div', { className: 'cw-diff', style: { border: '1px solid rgba(128,128,128,.16)', borderRadius: 8, overflow: 'hidden' } }, React.createElement('div', { className: 'cw-scroll', style: { maxHeight: props.maxHeight || 380, overflow: 'auto', padding: '4px 0' } }, folded.map((r, i) => {
                if (r.type === 'folded')
                    return foldRow(r, i);
                if (r.type === 'mod') {
                    return React.createElement('div', { key: i }, React.createElement('div', { style: { display: 'flex', padding: '1px 12px', background: rowBg('del'), whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, React.createElement('span', { style: lnStyle }, r.lnL || ''), React.createElement('span', { style: { color: '#dc2626', fontWeight: 700, paddingRight: 6 } }, '−'), React.createElement('span', { style: { flex: 1 } }, modSpans(r, 'left'))), React.createElement('div', { style: { display: 'flex', padding: '1px 12px', background: rowBg('add'), whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, React.createElement('span', { style: lnStyle }, r.lnR || ''), React.createElement('span', { style: { color: '#16a34a', fontWeight: 700, paddingRight: 6 } }, '+'), React.createElement('span', { style: { flex: 1 } }, modSpans(r, 'right'))));
                }
                const prefix = r.type === 'del'
                    ? React.createElement('span', { style: { color: '#dc2626', fontWeight: 700, paddingRight: 6 } }, '−')
                    : r.type === 'add'
                        ? React.createElement('span', { style: { color: '#16a34a', fontWeight: 700, paddingRight: 6 } }, '+')
                        : null;
                const ln = r.type === 'same' ? r.lnL : (r.lnL || r.lnR || '');
                const content = r.type === 'same' ? r.left : (r.left != null ? r.left : (r.right != null ? r.right : ''));
                return React.createElement('div', { key: i, style: { display: 'flex', padding: '1px 12px', background: rowBg(r.type), whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, React.createElement('span', { style: lnStyle }, ln || ''), prefix, React.createElement('span', { style: { flex: 1 } }, content));
            })));
        }
        // ===== 历史视图 =====
        function HistoryView(props) {
            const { file, onViewVersion, onCompare, onRollback, onDownload, preview } = props;
            const versions = file.versions || [];
            const current = file.current;
            return React.createElement('div', { style: { fontSize: 12 } }, React.createElement('div', { style: { fontWeight: 700, fontSize: 13, marginBottom: 8 } }, file.name + ' · 版本历史'), React.createElement('div', { style: { position: 'relative', paddingLeft: 26 } }, React.createElement('div', { style: { position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, background: 'rgba(128,128,128,.2)' } }), versions.map((v) => {
                const isCur = v.v === current;
                return React.createElement('div', { key: v.v, style: { position: 'relative', padding: '8px 0 8px 8px' } }, React.createElement('div', { style: { position: 'absolute', left: -25, top: 14, width: 12, height: 12, borderRadius: '50%', background: isCur ? '#2563eb' : '#fff', border: isCur ? 'none' : '3px solid rgba(128,128,128,.5)', boxSizing: 'border-box' } }), React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } }, React.createElement('span', { style: { fontWeight: 700, fontSize: 12.5 } }, 'v' + v.v + ' · ' + (SOURCE_LABEL[v.source] || v.source)), React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #8493ab)' } }, fmtTime(v.at) + ' · ' + v.lines + ' 行'), isCur && React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: '#2563eb', background: 'rgba(37,99,235,.1)', borderRadius: 4, padding: '1px 6px' } }, '当前')), React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' } }, btn('查看', () => onViewVersion(v.v), { ghost: true, style: { padding: '2px 8px' } }), !isCur && btn('对比当前↔v' + v.v, () => onCompare(v.v), { style: { padding: '2px 8px' } }), !isCur && btn('回滚到此', () => onRollback(v.v), { style: { padding: '2px 8px' } }), btn('下载', () => onDownload(v.v), { ghost: true, style: { padding: '2px 8px' } })));
            })), preview && React.createElement('div', { style: { marginTop: 8 } }, preview));
        }
        // ===== 粘贴对话框 =====
        function PasteDialog(props) {
            const { onConfirm, onCancel, name, onName, code, onCode } = props;
            return React.createElement('div', { style: { border: '1px solid rgba(37,99,235,.35)', borderRadius: 10, padding: 12, margin: '8px 0', background: 'rgba(37,99,235,.04)' } }, React.createElement('div', { style: { fontWeight: 700, fontSize: 12.5, marginBottom: 6 } }, '+ 粘贴代码'), React.createElement('input', { value: name, onChange: (e) => onName(e.target.value), placeholder: '文件名（如 snippet-1.py，留空自动命名）', style: { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(128,128,128,.3)', marginBottom: 6, background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit' } }), React.createElement('textarea', { value: code, onChange: (e) => onCode(e.target.value), placeholder: '在此粘贴代码…', rows: 6, spellCheck: false, style: { width: '100%', boxSizing: 'border-box', fontSize: 12, lineHeight: '18px', fontFamily: 'ui-monospace, Consolas, monospace', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(128,128,128,.3)', marginBottom: 8, resize: 'vertical', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit' } }), React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } }, btn('取消', onCancel, { style: { padding: '3px 10px' } }), btn('创建文件', onConfirm, { primary: true, style: { padding: '3px 10px' }, disabled: code.trim() === '' })));
        }
        function AiAssistant(props) {
            const { providers, aiKey, onKey, input, onInput, busy, onChat, onApply, messages, expanded, onToggle, attach, onAttach, notice } = props;
            const split = aiKey ? aiKey.split('|') : ['', ''];
            const providerId = split[0];
            const provider = providers.find((p) => p.id === providerId);
            const keyOk = provider?.keyAvailable || false;
            return React.createElement('div', { style: { borderTop: '1px solid rgba(128,128,128,.15)', background: 'rgba(128,128,128,.04)', flexShrink: 0 } }, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', flexWrap: 'wrap' } }, React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--dsw-alias-label-secondary, #8493ab)', flexShrink: 0 } }, '🤖 AI'), providers.length === 0
                ? React.createElement('span', { style: { fontSize: 11, color: '#b45309' } }, '未检测到可用 API Key')
                : React.createElement('select', {
                    value: aiKey,
                    onChange: (e) => onKey(e.target.value),
                    style: { fontSize: 11, padding: '2px 5px', borderRadius: 6, border: '1px solid rgba(128,128,128,.3)', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit', maxWidth: 200 },
                    title: '选择 AI 接口（来自 DSH 已配置的 provider）',
                }, providers.map((p) => React.createElement('optgroup', { key: p.id, label: p.displayName + (p.keyAvailable ? '' : '（未配置 Key）') }, (p.models.length > 0 ? p.models : [{ id: '' }]).map((m) => React.createElement('option', { key: p.id + '|' + m.id, value: p.id + '|' + m.id, disabled: !p.keyAvailable }, m.name || m.id))))), React.createElement('input', {
                value: input,
                onChange: (e) => onInput(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey && keyOk && !busy)
                    onChat(); },
                placeholder: '直接提问，或描述要做的修改…（Enter 发送）',
                style: { flex: 1, minWidth: 140, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(128,128,128,.3)', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit', outline: 'none' },
                disabled: !keyOk,
            }), btn(busy ? '…' : '对话', onChat, { primary: true, disabled: !keyOk || busy || input.trim() === '', style: { padding: '3px 10px' } }), btn('修改选中(' + props.selectedCount + ')', onApply, { disabled: !keyOk || busy || input.trim() === '' || props.selectedCount === 0, style: { padding: '3px 10px' } }), React.createElement('label', { style: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary, #8493ab)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 } }, React.createElement('input', { type: 'checkbox', checked: attach, onChange: (e) => onAttach(e.target.checked), style: { margin: 0 } }), '附文件'), btn(expanded ? '▾ 收起' : '▸ 记录', onToggle, { ghost: true, style: { padding: '2px 8px' } })), (notice || expanded) && React.createElement('div', { className: 'cw-scroll', style: { maxHeight: 170, overflow: 'auto', padding: '0 10px 6px', fontSize: 12, lineHeight: '18px' } }, notice && React.createElement('div', { style: { color: '#16a34a', marginBottom: 4, whiteSpace: 'pre-wrap' } }, notice), expanded && messages.length === 0 && React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary, #8493ab)' } }, '对话记录会显示在这里（勾选「附文件」可把选中文件作为上下文）。'), expanded && messages.map((m, i) => React.createElement('div', { key: i, style: { margin: '3px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, React.createElement('span', { style: { fontWeight: 700, color: m.role === 'user' ? '#2563eb' : '#16a34a', marginRight: 6 } }, m.role === 'user' ? '你' : 'AI'), m.content.slice(0, 4000) + (m.content.length > 4000 ? '…' : '')))));
        }
        // ===== 主面板 =====
        function WorkbenchPanel(props) {
            const isOpen = React.useSyncExternalStore(subscribe, getOpen);
            const inputActions = props && props.inputActions;
            const [files, setFiles] = React.useState([]);
            const [selected, setSelected] = React.useState(new Set());
            const [tabs, setTabs] = React.useState([]);
            const [activeId, setActiveId] = React.useState(null);
            const [view, setView] = React.useState('source');
            const [diffMode, setDiffMode] = React.useState('unified');
            const [editing, setEditing] = React.useState(false);
            const [editText, setEditText] = React.useState('');
            const [search, setSearch] = React.useState('');
            const [langFilter, setLangFilter] = React.useState('all');
            const [action, setAction] = React.useState('');
            const [targetLang, setTargetLang] = React.useState('TypeScript');
            const [extra, setExtra] = React.useState('');
            const [loading, setLoading] = React.useState(false);
            const [busy, setBusy] = React.useState(0);
            const [error, setError] = React.useState(null);
            const [maximized, setMaximized] = React.useState(false);
            const [pasteOpen, setPasteOpen] = React.useState(false);
            const [pasteName, setPasteName] = React.useState('');
            const [pasteCode, setPasteCode] = React.useState('');
            const [verCache, setVerCache] = React.useState({});
            const [compare, setCompare] = React.useState(null);
            const [verPreview, setVerPreview] = React.useState(null);
            const searchRef = React.useRef(null);
            const [sidebarWidth, setSidebarWidth] = React.useState(214);
            const dragRef = React.useRef(null);
            // AI 助手状态
            const [aiProviders, setAiProviders] = React.useState([]);
            const [aiKey, setAiKey] = React.useState('');
            const [aiInput, setAiInput] = React.useState('');
            const [aiBusy, setAiBusy] = React.useState(false);
            const [aiMessages, setAiMessages] = React.useState([]);
            const [aiExpanded, setAiExpanded] = React.useState(false);
            const [aiAttach, setAiAttach] = React.useState(false);
            const [aiNotice, setAiNotice] = React.useState('');
            const activeFile = files.find((f) => f.id === activeId) || null;
            const modifiedCount = files.filter((f) => f.current > 1).length;
            const selectedFiles = files.filter((f) => selected.has(f.id));
            const langCounts = {};
            for (const f of files)
                langCounts[f.lang] = (langCounts[f.lang] || 0) + 1;
            // ---- 数据拉取 ----
            const refreshFull = React.useCallback(async () => {
                try {
                    const res = await fetch('/dsh-code-workbench/list');
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        return false;
                    const list = Array.isArray(data.files) ? data.files : [];
                    setFiles(list);
                    setSelected((prev) => {
                        const ids = new Set(list.map((f) => f.id));
                        const next = new Set();
                        for (const id of prev)
                            if (ids.has(id))
                                next.add(id);
                        return next;
                    });
                    setTabs((prev) => {
                        const ids = new Set(list.map((f) => f.id));
                        return prev.filter((id) => ids.has(id));
                    });
                    setActiveId((prev) => (prev && list.some((f) => f.id === prev) ? prev : (list[0]?.id ?? null)));
                    return true;
                }
                catch {
                    return false;
                }
            }, []);
            const refreshMeta = React.useCallback(async () => {
                try {
                    const res = await fetch('/dsh-code-workbench/list?meta=1');
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        return null;
                    return data.files || [];
                }
                catch {
                    return null;
                }
            }, []);
            React.useEffect(() => {
                if (!isOpen)
                    return;
                refreshFull();
                fetch('/dsh-code-workbench/ai/providers')
                    .then((r) => r.json().catch(() => null))
                    .then((data) => {
                    if (data && data.ok && Array.isArray(data.providers)) {
                        setAiProviders(data.providers);
                        const first = data.providers.find((p) => p.keyAvailable && p.models.length > 0);
                        if (first) {
                            setAiKey((prev) => {
                                if (prev && data.providers.some((p) => prev.startsWith(p.id + '|')))
                                    return prev;
                                return first.id + '|' + first.models[0].id;
                            });
                        }
                        else {
                            setAiKey('');
                        }
                    }
                })
                    .catch(() => { });
            }, [isOpen, refreshFull]);
            // 提交后轻量轮询
            React.useEffect(() => {
                if (!loading || !isOpen)
                    return;
                let stop = false;
                const timer = setInterval(async () => {
                    if (stop)
                        return;
                    const meta = await refreshMeta();
                    if (!meta)
                        return;
                    const pendingIds = [...selected];
                    const allDone = pendingIds.length > 0 && pendingIds.every((id) => {
                        const m = meta.find((x) => x.id === id);
                        return m && m.hasModified;
                    });
                    if (allDone) {
                        stop = true;
                        clearInterval(timer);
                        await refreshFull();
                        setLoading(false);
                    }
                }, 2000);
                return () => { stop = true; clearInterval(timer); };
            }, [loading, isOpen, selected, refreshFull, refreshMeta]);
            // 快捷键
            React.useEffect(() => {
                if (!isOpen)
                    return;
                const onKey = (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        if (canSubmit()) {
                            e.preventDefault();
                            submit();
                        }
                    }
                    else if (e.key === 'Escape') {
                        setOpen(false);
                    }
                    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                        e.preventDefault();
                        if (searchRef.current)
                            searchRef.current.focus();
                    }
                };
                window.addEventListener('keydown', onKey);
                return () => window.removeEventListener('keydown', onKey);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [isOpen, files, selected, action, loading]);
            // ---- 文件栏拖拽 ----
            const onResizeStart = (e) => {
                e.preventDefault();
                dragRef.current = { startX: e.clientX, startW: sidebarWidth };
                const move = (ev) => {
                    if (!dragRef.current)
                        return;
                    const w = Math.min(340, Math.max(170, dragRef.current.startW + (ev.clientX - dragRef.current.startX)));
                    setSidebarWidth(w);
                };
                const up = () => {
                    dragRef.current = null;
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
            };
            // ---- 上传 / 文件夹 ----
            const uploadFile = React.useCallback(async (file, relPath) => {
                setBusy((n) => n + 1);
                try {
                    const body = await file.arrayBuffer();
                    const res = await fetch('/dsh-code-workbench/upload', {
                        method: 'POST',
                        headers: { 'x-file-name': encodeURIComponent(relPath || file.name), 'content-type': 'application/octet-stream' },
                        body,
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || `上传失败 HTTP ${res.status}`);
                    return { ok: true, file: data.file };
                }
                catch (e) {
                    return { ok: false, name: file.name, error: e instanceof Error ? e.message : String(e) };
                }
                finally {
                    setBusy((n) => n - 1);
                }
            }, []);
            const uploadAll = React.useCallback(async (fileList, relPaths) => {
                const list = Array.from(fileList || []);
                if (list.length === 0)
                    return;
                setError(null);
                const outcomes = await Promise.all(list.map((f, i) => uploadFile(f, relPaths && relPaths[i])));
                const failed = outcomes.filter((o) => !o.ok);
                if (failed.length > 0)
                    setError(failed.map((e) => e.name + ': ' + e.error).join('；'));
                const added = outcomes.filter((o) => o.ok && o.file);
                if (added.length > 0) {
                    await refreshFull();
                    setSelected((prev) => new Set([...prev, ...added.map((o) => o.file.id)]));
                    setTabs((prev) => [...prev, ...added.map((o) => o.file.id)]);
                    setActiveId(added[0].file.id);
                }
            }, [uploadFile, refreshFull]);
            const onPick = (e) => {
                const fl = e.target && e.target.files;
                if (fl && fl.length > 0)
                    uploadAll(fl);
                if (e.target)
                    e.target.value = '';
            };
            const onDrop = (e) => {
                e.preventDefault();
                const fl = e.dataTransfer && e.dataTransfer.files;
                if (fl && fl.length > 0)
                    uploadAll(fl);
            };
            // 文件夹：递归列举 + 过滤隐藏目录/二进制扩展名
            const onPickDir = (e) => {
                const fl = e.target && e.target.files;
                if (fl && fl.length > 0) {
                    const list = Array.from(fl);
                    const keep = [];
                    const rels = [];
                    for (const f of list) {
                        const rp = f.webkitRelativePath || '';
                        const idx = rp.indexOf('/');
                        const rel = idx >= 0 ? rp.slice(idx + 1) : f.name;
                        const segs = rel.split('/');
                        if (segs.some((s) => s.startsWith('.') || SKIP_DIR_PARTS.includes(s)))
                            continue;
                        const ext = (f.name.match(/\.[^./]+$/) || [''])[0].toLowerCase();
                        if (SKIP_EXTS.has(ext))
                            continue;
                        keep.push(f);
                        rels.push(rel);
                    }
                    if (keep.length > MAX_FOLDER_FILES) {
                        setError(`文件夹有效文件过多（${keep.length} 个，已过滤 .git/二进制 等），仅取前 ${MAX_FOLDER_FILES} 个`);
                        uploadAll(keep.slice(0, MAX_FOLDER_FILES), rels.slice(0, MAX_FOLDER_FILES));
                    }
                    else {
                        uploadAll(keep, rels);
                    }
                }
                if (e.target)
                    e.target.value = '';
            };
            // ---- 粘贴 ----
            const doPaste = async () => {
                if (pasteCode.trim() === '')
                    return;
                setError(null);
                try {
                    const res = await fetch('/dsh-code-workbench/paste', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ name: pasteName.trim() || undefined, content: pasteCode }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || '粘贴失败');
                    setPasteOpen(false);
                    setPasteName('');
                    setPasteCode('');
                    await refreshFull();
                    setSelected((prev) => new Set([...prev, data.file.id]));
                    setTabs((prev) => [...prev, data.file.id]);
                    setActiveId(data.file.id);
                    setView('source');
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            };
            // ---- 勾选 / Tab ----
            const toggleSelect = (id) => {
                setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id))
                        next.delete(id);
                    else
                        next.add(id);
                    return next;
                });
            };
            const toggleSelectAll = () => {
                setSelected((prev) => prev.size === files.length && files.length > 0 ? new Set() : new Set(files.map((f) => f.id)));
            };
            const openTab = (id) => {
                setTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setActiveId(id);
                setEditing(false);
                setView('source');
            };
            const closeTab = (id, e) => {
                if (e)
                    e.stopPropagation();
                setTabs((prev) => {
                    const next = prev.filter((x) => x !== id);
                    if (activeId === id) {
                        const idx = prev.indexOf(id);
                        const fallback = next[idx] || next[idx - 1] || null;
                        setActiveId(fallback);
                        setEditing(false);
                        setView('source');
                    }
                    return next;
                });
            };
            // ---- 提交（宿主 agent 流程） ----
            const canSubmit = () => selectedFiles.length > 0 && !!action && !loading;
            const buildNote = () => {
                const actionLabel = action === 'convert' ? `转换语言（目标：${targetLang || '未指定'}）` : ACTION_LABEL[action];
                const lines = selectedFiles.map((f) => `- ${f.name}（${f.lang}，${f.lines} 行，fileId: ${f.id}）`).join('\n');
                return [
                    `我已通过「💻 代码」面板上传 ${selectedFiles.length} 个代码文件（勾选参与）：`,
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
                ].filter((s) => s !== '').join('\n');
            };
            const submit = () => {
                if (!canSubmit())
                    return;
                if (!inputActions) {
                    setError('未连接到输入框（inputActions 不可用）');
                    return;
                }
                try {
                    inputActions.setDraft(buildNote());
                    inputActions.submit();
                    setLoading(true);
                    setView('source');
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            };
            const insertAndSend = () => {
                if (!inputActions)
                    return;
                const note = `代码工作台处理完成：勾选 ${selectedFiles.length} 个文件，${selectedFiles.filter((f) => f.current > 1).length} 个已生成修改结果（可在面板查看 diff / 版本历史 / 下载）。请继续。`;
                try {
                    inputActions.setDraft(note);
                    inputActions.submit();
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            };
            // ---- 编辑保存 ----
            const saveEdit = async () => {
                if (!activeFile)
                    return;
                try {
                    const res = await fetch('/dsh-code-workbench/file/' + encodeURIComponent(activeFile.id), {
                        method: 'PUT',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ content: editText }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || '保存失败');
                    setEditing(false);
                    await refreshFull();
                    setView('source');
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            };
            // ---- 历史 ----
            const fetchVersion = async (id, v) => {
                const key = id + ':' + v;
                if (verCache[key])
                    return verCache[key];
                try {
                    const res = await fetch('/dsh-code-workbench/version/' + encodeURIComponent(id) + '/' + v);
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || '读取版本失败');
                    setVerCache((prev) => ({ ...prev, [key]: data.version.content }));
                    return data.version.content;
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                    return null;
                }
            };
            const viewVersion = async (v) => {
                if (!activeFile)
                    return;
                const content = await fetchVersion(activeFile.id, v);
                if (content != null)
                    setVerPreview({ v, content });
            };
            const compareWithCurrent = async (v) => {
                if (!activeFile)
                    return;
                const target = await fetchVersion(activeFile.id, v);
                if (target == null)
                    return;
                const current = activeFile.current > 1 ? activeFile.modifiedContent : activeFile.content;
                setCompare({ leftText: target, rightText: current, leftLabel: 'v' + v, rightLabel: 'v' + activeFile.current + '（当前）' });
                setView('diff');
            };
            const doRollback = async (v) => {
                if (!activeFile)
                    return;
                if (!window.confirm(`回滚 ${activeFile.name} 到 v${v}？将追加一条 rollback 记录（历史不销毁）。`))
                    return;
                try {
                    const res = await fetch('/dsh-code-workbench/rollback/' + encodeURIComponent(activeFile.id), {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ to: v }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || '回滚失败');
                    await refreshFull();
                    setView('history');
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            };
            const downloadVersion = (v) => {
                if (!activeFile)
                    return;
                downloadUrl('/dsh-code-workbench/download/' + encodeURIComponent(activeFile.id) + '?version=' + v, activeFile.name);
            };
            const copyWithLines = () => {
                if (!activeFile)
                    return;
                const content = activeFile.current > 1 ? activeFile.modifiedContent : activeFile.content;
                const withLn = splitLines(content).map((l, i) => String(i + 1).padStart(4) + '  ' + l).join('\n');
                copyText(withLn);
            };
            // ---- AI 直连 ----
            const currentAi = (() => {
                const split = aiKey ? aiKey.split('|') : ['', ''];
                const p = aiProviders.find((x) => x.id === split[0]);
                return p ? { provider: p, model: split[1] || '' } : null;
            })();
            const aiContextSystem = () => {
                if (!aiAttach || selectedFiles.length === 0)
                    return '你是代码工作台的内置 AI 助手。用户可能附带代码上下文。';
                const block = selectedFiles.slice(0, 8).map((f) => {
                    const content = (f.current > 1 ? f.modifiedContent : f.content) || '';
                    return `===== ${f.name}（${f.lang}，${f.lines} 行，fileId: ${f.id}） =====\n${content.slice(0, 8000)}`;
                }).join('\n\n');
                return `你是代码工作台的内置 AI 助手。以下是用户勾选的代码文件（作为上下文，fileId 可引用）：\n${block}`;
            };
            const aiChat = async () => {
                if (!currentAi || aiInput.trim() === '')
                    return;
                const text = aiInput.trim();
                setAiInput('');
                setAiBusy(true);
                setAiNotice('');
                setAiMessages((prev) => [...prev, { role: 'user', content: text }]);
                try {
                    const res = await fetch('/dsh-code-workbench/ai/chat', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            provider: currentAi.provider.id,
                            model: currentAi.model,
                            messages: [
                                { role: 'system', content: aiContextSystem() },
                                ...aiMessages.map((m) => ({ role: m.role, content: m.content })),
                                { role: 'user', content: text },
                            ],
                        }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || 'AI 调用失败');
                    setAiMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
                    setAiExpanded(true);
                }
                catch (e) {
                    setAiNotice('❌ ' + (e instanceof Error ? e.message : String(e)));
                }
                finally {
                    setAiBusy(false);
                }
            };
            const aiApply = async () => {
                if (!currentAi || aiInput.trim() === '' || selectedFiles.length === 0)
                    return;
                const instruction = aiInput.trim();
                setAiInput('');
                setAiBusy(true);
                setAiNotice('');
                try {
                    const res = await fetch('/dsh-code-workbench/ai/apply', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            provider: currentAi.provider.id,
                            model: currentAi.model,
                            fileIds: selectedFiles.map((f) => f.id),
                            instruction,
                        }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true)
                        throw new Error((data && data.error) || 'AI 修改失败');
                    await refreshFull();
                    const okList = (data.applied || []).filter((a) => a.ok);
                    setAiNotice(`✅ 已修改 ${okList.length} 个文件，生成新版本：\n${okList.map((a) => '· ' + a.name + (a.summary ? ' — ' + a.summary : '')).join('\n')}\n${data.overview ? '\n' + data.overview : ''}`);
                    setAiExpanded(true);
                }
                catch (e) {
                    setAiNotice('❌ ' + (e instanceof Error ? e.message : String(e)));
                }
                finally {
                    setAiBusy(false);
                }
            };
            if (!isOpen)
                return null;
            const langs = ['all', ...Object.keys(langCounts)];
            const shownFiles = files.filter((f) => (langFilter === 'all' || f.lang === langFilter) &&
                (search === '' || f.name.toLowerCase().includes(search.toLowerCase())));
            const currentDiffStats = activeFile && activeFile.current > 1
                ? diffStats(lineDiffRows(activeFile.content, activeFile.modifiedContent))
                : { add: 0, del: 0 };
            const renderEditor = () => {
                if (!activeFile)
                    return hint('在左侧选择或打开一个文件');
                if (compare && view === 'diff') {
                    return React.createElement('div', null, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6 } }, React.createElement('span', { style: { fontWeight: 700 } }, compare.leftLabel + ' ↔ ' + compare.rightLabel), React.createElement('span', { style: { flex: 1 } }), btn('退出对比', () => setCompare(null), { ghost: true, style: { padding: '2px 8px' } })), React.createElement(DiffView, { leftText: compare.leftText, rightText: compare.rightText, mode: diffMode, showFold: true }));
                }
                if (view === 'source') {
                    return React.createElement(CodeView, {
                        file: activeFile,
                        editing,
                        editText: editing ? editText : undefined,
                        onEditChange: setEditText,
                        onSave: saveEdit,
                        onCancel: () => { setEditing(false); setEditText(activeFile.current > 1 ? activeFile.modifiedContent : activeFile.content); },
                        onStartEdit: () => { setEditText(activeFile.current > 1 ? activeFile.modifiedContent : activeFile.content); setEditing(true); },
                        onCopy: () => copyText(activeFile.current > 1 ? activeFile.modifiedContent : activeFile.content),
                        onCopyLines: copyWithLines,
                        onDownload: () => downloadUrl('/dsh-code-workbench/download/' + encodeURIComponent(activeFile.id), activeFile.name),
                    });
                }
                if (view === 'diff') {
                    if (compare)
                        return React.createElement(DiffView, { leftText: compare.leftText, rightText: compare.rightText, mode: diffMode, showFold: true });
                    if (activeFile.current <= 1)
                        return hint('该文件尚无修改（提交 AI 处理、面板 AI「修改选中」、或手动编辑保存后，即可在此对比 Diff）');
                    return React.createElement(DiffView, { leftText: activeFile.content, rightText: activeFile.modifiedContent, mode: diffMode, showFold: true });
                }
                if (view === 'report') {
                    return activeFile.report && activeFile.report.trim() !== ''
                        ? React.createElement('div', { className: 'cw-scroll', style: { maxHeight: 420, overflow: 'auto', fontSize: 12.5, lineHeight: 1.7 } }, renderMarkdown(activeFile.report))
                        : hint('暂无评测报告（AI 处理后显示在这里）');
                }
                if (view === 'history') {
                    return React.createElement(HistoryView, {
                        file: activeFile,
                        onViewVersion: viewVersion,
                        onCompare: compareWithCurrent,
                        onRollback: doRollback,
                        onDownload: downloadVersion,
                        preview: verPreview ? React.createElement('div', null, React.createElement('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary, #8493ab)', marginBottom: 4 } }, 'v' + verPreview.v + ' 内容预览'), React.createElement(LineCode, { code: verPreview.content, lang: activeFile.lang, maxHeight: 240 })) : null,
                    });
                }
                return null;
            };
            const panelStyle = maximized
                ? { width: '90vw', height: '85vh', maxHeight: '85vh' }
                : { width: 'min(900px, 94vw)', maxHeight: '78vh' };
            return React.createElement('div', {
                onDragOver: (e) => e.preventDefault(),
                onDrop,
                style: Object.assign({
                    position: 'absolute',
                    bottom: 'calc(100% + 10px)',
                    left: 0,
                    boxSizing: 'border-box',
                    background: 'var(--dsw-specific-input-major, #ffffff)',
                    border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
                    borderRadius: 12,
                    boxShadow: '0 10px 34px rgba(0,0,0,.28)',
                    zIndex: 60,
                    fontSize: 13,
                    lineHeight: '20px',
                    color: 'var(--dsw-alias-label-primary, #1e293b)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }, panelStyle),
            }, 
            // ===== 顶栏 =====
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid rgba(128,128,128,.15)', background: 'rgba(128,128,128,.04)', flexShrink: 0 } }, React.createElement('span', { style: { fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' } }, '💻 代码工作台'), React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #8493ab)', background: 'var(--dsw-specific-input-major, #fff)', border: '1px solid rgba(128,128,128,.2)', borderRadius: 999, padding: '0 9px', whiteSpace: 'nowrap' } }, files.length + ' 文件 · ' + modifiedCount + ' 已改'), loading && React.createElement('span', { style: { fontSize: 11, color: '#b45309', background: 'rgba(180,83,9,.1)', borderRadius: 999, padding: '0 9px', whiteSpace: 'nowrap' } }, '⏳ 处理中'), React.createElement('span', { style: { flex: 1 } }), selectedFiles.length > 0 && btn('⬇ 下载(' + selectedFiles.length + ')', () => downloadUrl('/dsh-code-workbench/download-all?ids=' + selectedFiles.map((f) => f.id).join(','), 'code-workbench.zip'), { style: { padding: '2px 9px', fontSize: 11 } }), btn(maximized ? '⤡' : '⤢', () => setMaximized(!maximized), { ghost: true, style: { padding: '2px 7px', fontSize: 13 }, title: maximized ? '还原' : '最大化' }), React.createElement('button', { type: 'button', onClick: () => setOpen(false), title: '关闭 (Esc)', style: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: 'var(--dsw-alias-label-secondary, #8493ab)', padding: '2px 6px' } }, '×')), 
            // ===== 主区 =====
            React.createElement('div', { style: { display: 'flex', flex: 1, minHeight: 0 } }, 
            // 文件栏
            React.createElement('div', { style: { width: sidebarWidth, flexShrink: 0, borderRight: '1px solid rgba(128,128,128,.15)', display: 'flex', flexDirection: 'column', minHeight: 0 } }, React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px 3px' } }, React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--dsw-alias-label-secondary, #8493ab)', letterSpacing: '.08em' } }, '文件'), React.createElement('span', { style: { display: 'flex', gap: 4, alignItems: 'center' } }, React.createElement('span', { onClick: toggleSelectAll, title: '全选/全不选', style: { fontSize: 10, color: 'var(--dsw-alias-label-secondary, #8493ab)', cursor: 'pointer', background: 'rgba(128,128,128,.07)', borderRadius: 4, padding: '0 6px' } }, '全选'), React.createElement('span', { style: { fontSize: 10, color: 'var(--dsw-alias-label-secondary, #8493ab)', background: 'rgba(128,128,128,.07)', borderRadius: 4, padding: '0 6px' } }, '已选 ' + selected.size + '/' + files.length))), React.createElement('input', {
                ref: searchRef,
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: '搜索文件… (⌘F)',
                style: { margin: '3px 10px 5px', padding: '3px 8px', fontSize: 11.5, borderRadius: 6, border: '1px solid rgba(128,128,128,.25)', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit', outline: 'none' },
            }), React.createElement('div', { style: { display: 'flex', gap: 3, padding: '0 10px', marginBottom: 5, flexWrap: 'wrap' } }, langs.map((l) => React.createElement('span', {
                key: l,
                onClick: () => setLangFilter(l),
                style: {
                    fontSize: 10, borderRadius: 4, padding: '0 5px', cursor: 'pointer',
                    background: langFilter === l ? '#2563eb' : 'rgba(128,128,128,.08)',
                    color: langFilter === l ? '#fff' : 'var(--dsw-alias-label-secondary, #8493ab)',
                },
            }, l === 'all' ? '全部' : (l + ' ' + langCounts[l])))), React.createElement('div', { className: 'cw-scroll', style: { flex: 1, overflow: 'auto', padding: '0 6px' } }, shownFiles.length === 0 && hint(files.length === 0 ? '拖入 / 选择文件 / 📁 文件夹' : '无匹配文件'), shownFiles.map((f) => {
                const checked = selected.has(f.id);
                const isActive = activeId === f.id;
                const base = f.name.split('/').pop() || f.name;
                const dir = f.name.includes('/') ? f.name.slice(0, f.name.lastIndexOf('/')) : '';
                const badge = f.current > 1
                    ? React.createElement('span', { style: { fontSize: 10, fontWeight: 700, color: f.current > 2 ? '#2563eb' : '#16a34a', background: f.current > 2 ? 'rgba(37,99,235,.1)' : 'rgba(22,163,74,.1)', borderRadius: 4, padding: '0 5px', flexShrink: 0 } }, 'v' + f.current)
                    : React.createElement('span', { style: { fontSize: 10, color: 'var(--dsw-alias-label-secondary, #8493ab)', flexShrink: 0 } }, '未处理');
                return React.createElement('div', { key: f.id, onClick: () => openTab(f.id), title: f.name, style: Object.assign({ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, cursor: 'pointer' }, isActive ? { background: 'rgba(37,99,235,.09)' } : {}) }, React.createElement('span', {
                    onClick: (e) => { e.stopPropagation(); toggleSelect(f.id); },
                    style: {
                        width: 13, height: 13, borderRadius: 4, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9.5, fontWeight: 700, color: '#fff',
                        background: checked ? '#2563eb' : 'transparent',
                        border: checked ? 'none' : '1.5px solid rgba(128,128,128,.55)',
                        boxSizing: 'border-box',
                    },
                }, checked ? '✓' : ''), React.createElement('span', { className: 'cw-tag-lang' }, LANG_TAG[f.lang] || f.lang.slice(0, 2)), React.createElement('div', { style: { flex: 1, minWidth: 0 } }, React.createElement('div', { style: { fontSize: 12, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, base), React.createElement('div', { style: { fontSize: 9.5, color: 'var(--dsw-alias-label-secondary, #8493ab)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, dir ? (dir + ' · ' + f.lines + ' 行') : (f.lang + ' · ' + f.lines + ' 行'))), badge);
            })), React.createElement('div', { style: { padding: '7px 8px 8px', display: 'flex', gap: 5, borderTop: '1px solid rgba(128,128,128,.15)', flexShrink: 0 } }, btn('＋粘贴', () => setPasteOpen(!pasteOpen), { style: { flex: 1, justifyContent: 'center', padding: '4px 2px', fontSize: 11 }, active: pasteOpen }), React.createElement('label', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(128,128,128,.35)', borderRadius: 7, padding: '4px 2px', cursor: busy > 0 ? 'wait' : 'pointer', fontSize: 11, color: 'var(--dsw-alias-label-primary, #1e293b)', whiteSpace: 'nowrap' } }, busy > 0 ? '上传中…' : '＋文件', React.createElement('input', { type: 'file', multiple: true, accept: ACCEPT, onChange: onPick, style: { display: 'none' } })), React.createElement('label', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(128,128,128,.35)', borderRadius: 7, padding: '4px 2px', cursor: 'pointer', fontSize: 11, color: 'var(--dsw-alias-label-primary, #1e293b)', whiteSpace: 'nowrap' }, title: '选择文件夹（自动过滤 .git/node_modules/二进制 等）' }, '📁 文件夹', React.createElement('input', { type: 'file', webkitdirectory: '', directory: '', multiple: true, onChange: onPickDir, style: { display: 'none' } }))), pasteOpen && React.createElement(PasteDialog, {
                onConfirm: doPaste,
                onCancel: () => { setPasteOpen(false); setPasteName(''); setPasteCode(''); },
                name: pasteName, onName: setPasteName, code: pasteCode, onCode: setPasteCode,
            })), React.createElement('div', { onMouseDown: onResizeStart, title: '拖拽调整宽度', style: { width: 5, flexShrink: 0, cursor: 'col-resize', background: 'transparent', alignSelf: 'stretch', borderRight: '1px solid rgba(128,128,128,.15)' } }), 
            // 编辑区 + AI 助手
            React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 } }, React.createElement('div', { style: { display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,.15)', background: 'rgba(128,128,128,.04)', flexShrink: 0, overflowX: 'auto', maxWidth: '100%' } }, tabs.length === 0 && React.createElement('span', { style: { padding: '6px 12px', fontSize: 11.5, color: 'var(--dsw-alias-label-secondary, #8493ab)' } }, '未打开文件'), tabs.map((id) => {
                const f = files.find((x) => x.id === id);
                if (!f)
                    return null;
                const isActive = activeId === id;
                const dirty = isActive && editing;
                return React.createElement('div', {
                    key: id,
                    onClick: () => { setActiveId(id); setEditing(false); setCompare(null); setView('source'); },
                    style: {
                        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer',
                        borderRight: '1px solid rgba(128,128,128,.15)',
                        color: isActive ? '#2563eb' : 'var(--dsw-alias-label-secondary, #8493ab)',
                        fontWeight: isActive ? 600 : 400,
                        borderBottom: isActive ? '2px solid #2563eb' : 'none',
                        background: isActive ? 'var(--dsw-specific-input-major, #fff)' : 'transparent',
                    },
                }, dirty ? React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: '#b45309', display: 'inline-block' } }) : null, (f.name.split('/').pop() || f.name), React.createElement('span', { onClick: (e) => closeTab(id, e), style: { color: 'var(--dsw-alias-label-secondary, #8493ab)', padding: '0 2px', cursor: 'pointer', fontSize: 12 }, title: '关闭' }, '✕'));
            })), React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderBottom: '1px solid rgba(128,128,128,.15)', flexShrink: 0, flexWrap: 'wrap' } }, btn('源码', () => { setView('source'); setCompare(null); }, { ghost: !(view === 'source'), active: view === 'source' && !compare, style: { padding: '3px 10px' } }), btn(activeFile && activeFile.current > 1 ? ('Diff +' + currentDiffStats.add + ' −' + currentDiffStats.del) : 'Diff', () => { setView('diff'); setCompare(null); }, { ghost: !(view === 'diff' && !compare), active: view === 'diff' && !compare, style: { padding: '3px 10px' } }), btn('报告', () => { setView('report'); setCompare(null); }, { ghost: !(view === 'report'), active: view === 'report', style: { padding: '3px 10px' } }), btn('历史', () => { setView('history'); setCompare(null); }, { ghost: !(view === 'history'), active: view === 'history', style: { padding: '3px 10px' } }), activeFile && activeFile.current > 1 && view === 'diff' && !compare && React.createElement('span', { style: { display: 'inline-flex', overflow: 'hidden', border: '1px solid rgba(128,128,128,.3)', borderRadius: 6, marginLeft: 4 } }, React.createElement('span', { onClick: () => setDiffMode('split'), style: { padding: '2px 9px', fontSize: 10.5, cursor: 'pointer', background: diffMode === 'split' ? 'rgba(128,128,128,.1)' : 'transparent', color: 'var(--dsw-alias-label-primary, #1e293b)' } }, '并排'), React.createElement('span', { onClick: () => setDiffMode('unified'), style: { padding: '2px 9px', fontSize: 10.5, cursor: 'pointer', background: diffMode === 'unified' ? 'rgba(128,128,128,.1)' : 'transparent', color: 'var(--dsw-alias-label-primary, #1e293b)' } }, '统一'))), React.createElement('div', { className: 'cw-scroll', style: { flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 10px' } }, error && React.createElement('div', { style: { color: '#dc2626', marginBottom: 8, fontSize: 12 } }, '操作失败：' + error), renderEditor()), React.createElement(AiAssistant, {
                providers: aiProviders,
                aiKey, onKey: setAiKey,
                input: aiInput, onInput: setAiInput,
                busy: aiBusy, onChat: aiChat, onApply: aiApply,
                messages: aiMessages,
                expanded: aiExpanded, onToggle: () => setAiExpanded(!aiExpanded),
                attach: aiAttach, onAttach: setAiAttach,
                notice: aiNotice,
                selectedCount: selectedFiles.length,
            }))), 
            // ===== 命令栏（宿主 agent 流程） =====
            React.createElement('div', { style: { borderTop: '1px solid rgba(128,128,128,.15)', background: 'rgba(128,128,128,.04)', flexShrink: 0, padding: '6px 10px' } }, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' } }, React.createElement('span', { style: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary, #8493ab)', marginRight: 2, flexShrink: 0 } }, '操作:'), ACTIONS.map((a) => btn(a.label, () => setAction(a.id), { active: action === a.id, style: { padding: '2px 8px', fontSize: 11 } })), action === 'convert' && React.createElement('select', { value: targetLang, onChange: (e) => setTargetLang(e.target.value), style: { fontSize: 11, padding: '2px 5px', borderRadius: 6, border: '1px solid rgba(128,128,128,.3)', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit' } }, TARGET_LANGS.map((l) => React.createElement('option', { key: l, value: l }, l)))), React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 } }, React.createElement('input', {
                value: extra,
                onChange: (e) => setExtra(e.target.value),
                placeholder: '要求（可选）：如"把同步改成 async/await"…',
                style: { flex: 1, minWidth: 120, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(128,128,128,.3)', background: 'var(--dsw-specific-input-major, #fff)', color: 'inherit', outline: 'none' },
            }), btn(selectedFiles.length > 0 && action ? ('⌘⏎ 提交 · ' + selectedFiles.length + ' 个') : '⌘⏎ 提交', submit, { primary: true, disabled: !canSubmit(), style: { padding: '4px 12px' } }), btn('插入对话', insertAndSend, { ghost: true, style: { padding: '2px 8px' }, disabled: !inputActions || selectedFiles.length === 0 }))));
        }
        const apply = (ctx) => {
            ensureStyles();
            ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
                name: 'conversation.input.left',
                id: 'code-workbench',
                order: 31,
                label: () => '代码',
            }, CodeButton)), 'dsh-code-workbench: composer left button');
            ctx.effect(() => ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
                name: 'conversation.input.overlay',
                id: 'code-workbench',
                order: 31,
                label: () => '代码工作台',
            }, WorkbenchPanel)), 'dsh-code-workbench: composer overlay panel');
        };
        exports.apply = apply;
        exports.inject = ['slots'];
        return module.exports;
    },
});
export {};
