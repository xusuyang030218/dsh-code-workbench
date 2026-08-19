import { writeFileSync } from 'node:fs'
const base = 'http://127.0.0.1:4000'
const enc = encodeURIComponent

// 1) 相对路径上传（模拟文件夹：src/utils/helper.js）
const code = 'export function helper() { return 1 }\n'
const r1 = await fetch(base + '/dsh-code-workbench/upload', {
  method: 'POST',
  headers: { 'x-file-name': enc('src/utils/helper.js'), 'content-type': 'application/octet-stream' },
  body: new TextEncoder().encode(code),
})
const j1 = await r1.json()
console.log('1) upload rel-path -> name =', JSON.stringify(j1.file.name), '| lang =', j1.file.lang)

// 2) 目录穿越清洗
const r2 = await fetch(base + '/dsh-code-workbench/upload', {
  method: 'POST',
  headers: { 'x-file-name': enc('../evil/../../x.txt'), 'content-type': 'application/octet-stream' },
  body: new TextEncoder().encode('hi'),
})
const j2 = await r2.json()
console.log('2) traversal clean -> name =', JSON.stringify(j2.file.name))

// 3) 单文件下载 Content-Disposition 用 basename
const id = j1.file.id
const r3 = await fetch(base + '/dsh-code-workbench/download/' + id)
console.log('3) download disposition =', r3.headers.get('content-disposition'))

// 4) zip 打包保留子目录
const r4 = await fetch(base + '/dsh-code-workbench/download-all?ids=' + id)
const buf = Buffer.from(await r4.arrayBuffer())
writeFileSync(process.env.TEMP + '/cw-folder.zip', buf)
console.log('4) zip bytes =', buf.length, '| type =', r4.headers.get('content-type'))

// 5) client.js 新布局代码可访问
const r5 = await fetch(base + '/plugins/dsh-code-workbench/client.js')
const t5 = await r5.text()
console.log('5) client.js status =', r5.status, '| bytes =', t5.length, '| has 文件夹 =', t5.includes('文件夹'))
