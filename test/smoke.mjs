import { buildZip, detectLang, countLines, looksBinaryDecoded } from '../lib/host/parse.js'
import { saveFile, listFiles, setModified, setReport, addManualVersion, rollbackTo, getVersion, _clearForTest } from '../lib/host/store.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

_clearForTest()
console.log('detectLang .ts =', detectLang('x.ts'), '| .go =', detectLang('x.go'), '| unknown =', detectLang('x.zzz'))

const zip = buildZip([
  { name: 'app.py', data: 'def hello():\n    print("hi")\n' },
  { name: 'notes/中文.js', data: 'const x = 1;\n' },
])
const outDir = join(process.env.TEMP || '.', 'cw-zip-test')
mkdirSync(outDir, { recursive: true })
const zipPath = join(outDir, 'test.zip')
writeFileSync(zipPath, zip)
console.log('zip bytes =', zip.length, '->', zipPath)

console.log('binary sniff (NUL) =', looksBinaryDecoded('a\u0000b'), '| text =', looksBinaryDecoded('print(1)'))

const a = saveFile({ name: 'app.py', lang: detectLang('app.py'), size: 10, lines: 2, content: 'a\nb' })
saveFile({ name: 'u.js', lang: detectLang('u.js'), size: 3, lines: 1, content: 'x' })
setModified(a.id, 'A\nB\nC')
setReport(a.id, '# report')
addManualVersion(a.id, 'A\nB\nC\nD')
rollbackTo(a.id, 1)
const fa = listFiles().find((f) => f.id === a.id)
console.log('versions =', fa.versions.map((v) => v.v + ':' + v.source).join(', '))
console.log('current =', fa.current, '| modifiedContent =', JSON.stringify(fa.modifiedContent))
console.log('getVersion(2) =', JSON.stringify(getVersion(a.id, 2)?.content))
console.log('listFiles =', listFiles().length)
console.log('SMOKE OK')
