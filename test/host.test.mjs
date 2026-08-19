/**
 * host 半验证：加载 index.mjs 的 apply()，用真实 dsh-tools 校验 schema，
 * 并跑通 code_workbench 全部 action 的 execute。
 */
import { assertSupportedJsonSchema, validateJsonSchemaValue } from 'file:///D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js'
import { apply as applyIndex } from '../lib/host/index.mjs'
import { saveFile } from '../lib/host/store.mjs'

const registered = []
const ctx = {
  get: () => null,
  tools: {
    register: (tool) => { registered.push(tool) },
  },
}
applyIndex(ctx)
if (registered.length !== 1) throw new Error(`expected 1 tool, got ${registered.length}`)
const tool = registered[0]
console.log('tool name =', tool.name, '| actions =', tool.parameters.properties.action.enum.join(','))

// schema 校验（真实 dsh-tools）
assertSupportedJsonSchema(tool.output.schema)
console.log('output.schema 通过 assertSupportedJsonSchema')

// execute 冒烟
const rec = saveFile({ name: 'app.py', lang: 'python', size: 20, lines: 2, content: 'def hello():\n    return 1\n' })
const listOut = await tool.execute({ action: 'list' })
console.log('list ->', listOut.message.split('\n')[0])
const readOut = await tool.execute({ action: 'read', fileId: rec.id })
console.log('read ->', readOut.name, '| content lines =', readOut.content.split('\n').length)
const modOut = await tool.execute({ action: 'modify', fileId: rec.id, modification: 'def hello():\n    return 2\n' })
console.log('modify -> ok =', modOut.ok, '| url =', modOut.downloadUrl)
const revOut = await tool.execute({ action: 'review', fileId: rec.id, report: '# 评测\n- 8/10' })
console.log('review -> ok =', revOut.ok)
// 返回值校验
const violations = validateJsonSchemaValue(tool.output.schema, readOut, 'value')
if (violations.length) throw new Error('read 返回值违反 schema: ' + violations.join('; '))
const v2 = validateJsonSchemaValue(tool.output.schema, modOut, 'value')
if (v2.length) throw new Error('modify 返回值违反 schema: ' + v2.join('; '))
// 错误路径
let threw = false
try { await tool.execute({ action: 'read', fileId: 'nope' }) } catch (e) { threw = true }
if (!threw) throw new Error('read 不存在 fileId 应抛错')
console.log('错误路径正常抛错')
console.log('HOST TOOL OK')
