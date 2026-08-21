import { writeFileSync } from 'node:fs'
const base = 'http://127.0.0.1:4000'
const enc = encodeURIComponent

// 1) client.js（TS 构建产物，含 AI 助手）
const c = await (await fetch(base + '/plugins/dsh-code-workbench/client.js')).text()
console.log('1) client.js bytes =', c.length, '| has ai/providers =', c.includes('/ai/providers'), '| has 修改选中 =', c.includes('修改选中'))

// 2) 二进制文件被拒绝（模拟 .git/objects 内容：压缩数据含 NUL/乱码）
const bin = Buffer.from([0x78, 0x9c, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
const r2 = await fetch(base + '/dsh-code-workbench/upload', {
  method: 'POST',
  headers: { 'x-file-name': enc('f6/21033468'), 'content-type': 'application/octet-stream' },
  body: bin,
})
const j2 = await r2.json()
console.log('2) binary upload -> status =', r2.status, '|', j2.error)

// 3) 正常文本 + 相对路径
const code = 'def hello():\n    return 1\n'
const r3 = await fetch(base + '/dsh-code-workbench/upload', {
  method: 'POST',
  headers: { 'x-file-name': enc('src/utils/helper.py'), 'content-type': 'application/octet-stream' },
  body: new TextEncoder().encode(code),
})
const j3 = await r3.json()
console.log('3) rel-path upload -> name =', JSON.stringify(j3.file.name), '| lang =', j3.file.lang)
const id = j3.file.id

// 4) AI providers（继承 host settings：应列出 deepseek-official + pi-ai 中转；key 未注入沙盒 → keyAvailable=false）
const j4 = await (await fetch(base + '/dsh-code-workbench/ai/providers')).json()
console.log('4) providers =', j4.providers.map((p) => `${p.id}(${p.models.length}模型,key=${p.keyAvailable})`).join(', '))

// 5) list / download / download-all 仍正常
const j5 = await (await fetch(base + '/dsh-code-workbench/list')).json()
console.log('5) list files =', j5.files.length, '| has versions meta =', Array.isArray(j5.files[0].versions))
const r6 = await fetch(base + '/dsh-code-workbench/download/' + id)
console.log('6) download disposition =', r6.headers.get('content-disposition'))
const r7 = await fetch(base + '/dsh-code-workbench/download-all?ids=' + id)
const buf = Buffer.from(await r7.arrayBuffer())
writeFileSync(process.env.TEMP + '/cw-ts.zip', buf)
console.log('7) zip bytes =', buf.length, '| type =', r7.headers.get('content-type'))

// 8) AI chat/apply 在无 key 时应给出明确错误（不崩溃）
const r8 = await fetch(base + '/dsh-code-workbench/ai/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ provider: 'deepseek-official', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }),
})
const j8 = await r8.json()
console.log('8) ai/chat no-key -> status =', r8.status, '|', j8.error?.slice(0, 60))
