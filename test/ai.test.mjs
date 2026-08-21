/**
 * AI 直连逻辑验证：本地 mock OpenAI 兼容端点，验证 chatCompletions / applyModifications /
 * parseApplyJson / resolveProviders（含 credentials/settings 读取）。
 */
import { createServer } from 'node:http'
import { chatCompletions, applyModifications, parseApplyJson, resolveProviders, getApiKey } from '../lib/host/ai.js'

// --- mock OpenAI 兼容服务 ---
const seen = { body: null, auth: null }
const server = createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    seen.body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    seen.auth = req.headers.authorization || null
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      model: seen.body.model,
      choices: [{ message: { role: 'assistant', content: '{"overview":"完成","modifications":[{"fileId":"f1","summary":"加错误处理","content":"def f():\n    try:\n        return 1\n    except Exception:\n        return 0"}]}' } }],
    }))
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const baseURL = `http://127.0.0.1:${port}`

// --- mock ctx：credentials + settings ---
const mockCtx = {
  get(name) {
    if (name === 'credentials') return { resolve: async (ref) => (ref === 'DEEPSEEK_API_KEY' ? { value: 'sk-test' } : undefined) }
    if (name === 'settings') return { get: () => ({ providers: { codex: { displayName: 'codex', apiKeyEnv: 'CODEX_API_KEY', baseURL: 'https://codex.example/v1', models: [{ id: 'gpt-5.2' }] } } }) }
    return undefined
  },
}

const providers = await resolveProviders(mockCtx)
console.log('providers =', providers.map((p) => `${p.id}:${p.keyAvailable}`).join(', '))
if (providers.find((p) => p.id === 'deepseek-official')?.keyAvailable !== true) throw new Error('deepseek-official 应 keyAvailable')

const key = await getApiKey(mockCtx, 'DEEPSEEK_API_KEY')
if (key !== 'sk-test') throw new Error('getApiKey 读取失败')

// --- chatCompletions：验证请求形状 ---
const provider = providers.find((p) => p.id === 'deepseek-official')
const chat = await chatCompletions({ baseURL, apiKey: 'sk-test', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] })
console.log('chat -> model =', chat.model, '| auth =', seen.auth, '| body.model =', seen.body.model)
if (seen.auth !== 'Bearer sk-test') throw new Error('Authorization 头错误')
if (seen.body.messages[0].content !== 'hi') throw new Error('messages 转发错误')

// --- applyModifications：JSON 解析 + 上下文组装 ---
const result = await applyModifications(mockCtx, {
  provider: { ...provider, baseURL },
  model: 'deepseek-chat',
  files: [{ id: 'f1', name: 'f.py', lang: 'python', lines: 2, content: 'def f():\n    return 1\n' }],
  instruction: '加错误处理',
})
console.log('apply -> overview =', result.overview, '| applied =', result.applied.length)
if (result.applied[0].fileId !== 'f1') throw new Error('fileId 回填错误')
if (!result.applied[0].content.includes('try:')) throw new Error('content 解析错误')

// --- parseApplyJson：容忍 markdown 围栏 ---
const parsed = parseApplyJson('```json\n{"overview":"o","modifications":[{"fileId":"a","content":"x"}]}\n```')
if (parsed.applied.length !== 1) throw new Error('markdown 围栏解析失败')

server.close()
console.log('AI TEST OK')
