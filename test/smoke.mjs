import { buildZip, detectLang, countLines } from '../lib/host/parse.mjs'
import { saveFile, listFiles, setModified, setReport } from '../lib/host/store.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// --- detectLang / countLines ---
console.log('detectLang .ts =', detectLang('x.ts'), '| .go =', detectLang('x.go'), '| unknown =', detectLang('x.zzz'))

// --- buildZip ---
const zip = buildZip([
  { name: 'app.py', data: 'def hello():\n    print("hi")\n' },
  { name: 'notes/中文.js', data: 'const x = 1;\n' },
])
const outDir = join(process.env.TEMP || '.', 'cw-zip-test')
mkdirSync(outDir, { recursive: true })
const zipPath = join(outDir, 'test.zip')
writeFileSync(zipPath, zip)
console.log('zip bytes =', zip.length, '->', zipPath)

// --- store ---
const a = saveFile({ name: 'app.py', lang: detectLang('app.py'), size: 10, lines: countLines('a\nb'), content: 'a\nb' })
const b = saveFile({ name: 'u.js', lang: detectLang('u.js'), size: 3, lines: 1, content: 'x' })
setModified(a.id, 'A\nB\nC')
setReport(a.id, '# report')
console.log('store files =', listFiles().length, '| a.modified =', JSON.stringify(listFiles()[0].modifiedContent))
console.log('SMOKE OK')
