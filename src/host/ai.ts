/**
 * AI 直连：读取 DSH 已配置的 LLM provider（DeepSeek 官方 + llm-pi-ai 中转），
 * 面板内直接对话 / 修改代码，无需经过宿主 agent 对话流。
 *
 * - API Key：经 DSH credentials 服务读取（进程环境变量 + $DSH_HOME/.credentials.yaml）
 * - provider 配置：经 settings 服务读取 llm-pi-ai namespace（baseURL / models / apiKeyEnv）
 * - 协议：OpenAI 兼容 chat/completions
 */
export interface AiModel {
  id: string
  name?: string
}

export interface AiProvider {
  id: string
  displayName: string
  baseURL: string
  apiKeyEnv: string
  models: AiModel[]
  keyAvailable: boolean
}

/** DSH ctx 的最小形态（避免引入 cordis 类型）。 */
export interface CtxLike {
  get(name: string): any
}

const DEEPSEEK_OFFICIAL_BASE = {
  id: 'deepseek-official',
  displayName: 'DeepSeek 官方',
  baseURL: 'https://api.deepseek.com',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  models: [
    { id: 'deepseek-chat', name: 'DeepSeek-V3（对话）' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-R1（推理）' },
  ],
}

/** 经 credentials 服务读取 API Key（环境变量优先，其次 .credentials.yaml）。 */
export async function getApiKey(ctx: CtxLike, ref: string): Promise<string | null> {
  try {
    const credentials = ctx.get('credentials')
    if (!credentials || typeof credentials.resolve !== 'function') return null
    const resolved = await credentials.resolve(ref)
    return resolved?.value ? String(resolved.value) : null
  } catch {
    return null
  }
}

/** 解析全部可用 provider（含 key 可用性，脱敏——key 只留在 host 端）。 */
export async function resolveProviders(ctx: CtxLike): Promise<AiProvider[]> {
  const out: AiProvider[] = [
    { ...DEEPSEEK_OFFICIAL_BASE, keyAvailable: false },
  ]
  try {
    const settings = ctx.get('settings')
    const pi = typeof settings?.get === 'function' ? settings.get('llm-pi-ai') : undefined
    const providers = (pi && typeof pi === 'object' && (pi as any).providers) ?? {}
    for (const [id, raw] of Object.entries(providers as Record<string, any>)) {
      if (!raw || typeof raw !== 'object') continue
      const apiKeyEnv = raw.apiKeyEnv
      if (typeof apiKeyEnv !== 'string' || !apiKeyEnv) continue
      const models: AiModel[] = Array.isArray(raw.models)
        ? raw.models
            .map((m: any) => ({ id: String(m?.id ?? ''), name: m?.name ?? m?.id }))
            .filter((m: AiModel) => m.id)
        : []
      out.push({
        id,
        displayName: raw.displayName || id,
        baseURL: String(raw.baseURL ?? ''),
        apiKeyEnv,
        models,
        keyAvailable: false,
      })
    }
  } catch {
    /* settings 不可用时只保留 deepseek 官方 */
  }
  for (const p of out) {
    const key = await getApiKey(ctx, p.apiKeyEnv)
    p.keyAvailable = !!key
  }
  return out
}

export interface ChatMessage {
  role: string
  content: string
}

/** OpenAI 兼容 chat/completions 调用。 */
export async function chatCompletions(opts: {
  baseURL: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}): Promise<{ content: string; model: string }> {
  const base = opts.baseURL.replace(/\/+$/, '')
  const url = /\/v1$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  }
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI API ${res.status}: ${text.slice(0, 300) || res.statusText}`)
  }
  const data = await res.json().catch(() => null)
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('AI API 返回格式异常（缺少 choices[0].message.content）')
  return { content, model: data?.model ?? opts.model }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…[已截断，全文 ${s.length} 字符]` : s
}

export interface ApplyFile {
  id: string
  name: string
  lang: string
  lines: number
  content: string
}

export interface ApplyModification {
  fileId: string
  content: string
  summary?: string
}

export interface ApplyResult {
  applied: ApplyModification[]
  overview: string
}

/** 修改模式：组装上下文 → 调 AI → 解析 JSON 修改清单。 */
export async function applyModifications(ctx: CtxLike, opts: {
  provider: AiProvider
  model: string
  files: ApplyFile[]
  instruction: string
}): Promise<ApplyResult> {
  const apiKey = await getApiKey(ctx, opts.provider.apiKeyEnv)
  if (!apiKey) throw new Error(`API Key 不可用（${opts.provider.apiKeyEnv}），请在 DSH 设置中配置后重试`)
  const fileBlock = opts.files
    .map((f) => `===== ${f.name}（${f.lang}，${f.lines} 行，fileId: ${f.id}） =====\n${truncate(f.content, 20000)}`)
    .join('\n\n')
  const system = [
    '你是代码工作台的内置 AI 助手。用户给出若干代码文件与一个修改指令，请按要求修改。',
    '只输出一个 JSON 对象（不要输出任何其他文字、解释或 markdown 围栏）：',
    '{"overview":"修改总览（简短中文）","modifications":[{"fileId":"文件的fileId","summary":"本文件修改要点","content":"修改后的完整代码"}]}',
    'modifications 必须覆盖每个需要修改的文件；content 必须是该文件的完整新内容（不是 diff、不是片段）。',
  ].join('\n')
  const user = `修改指令：${opts.instruction}\n\n以下是要处理的文件（fileId 必须原样回填）：\n${fileBlock}`
  const { content } = await chatCompletions({
    baseURL: opts.provider.baseURL,
    apiKey,
    model: opts.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    maxTokens: 16000,
  })
  return parseApplyJson(content)
}

/** 把 JSON 字符串值内的裸控制字符（换行/制表/回车）转义为合法转义序列。 */
function escapeRawControls(s: string): string {
  let out = ''
  let inStr = false
  let escaped = false
  for (const ch of s) {
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === '\\') { out += ch; escaped = true; continue }
    if (ch === '"') { inStr = !inStr; out += ch; continue }
    if (inStr && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t'
      continue
    }
    out += ch
  }
  return out
}

/** 解析 AI 返回的 JSON 修改清单（容忍 markdown 围栏/前后杂文/字符串内裸换行）。 */
export function parseApplyJson(text: string): ApplyResult {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 未返回 JSON 修改清单，请重试')
  const slice = cleaned.slice(start, end + 1)
  let obj: any
  try {
    obj = JSON.parse(slice)
  } catch {
    try {
      obj = JSON.parse(escapeRawControls(slice))
    } catch (e) {
      throw new Error(`AI 返回的 JSON 无法解析：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const mods = Array.isArray(obj?.modifications) ? obj.modifications : []
  if (mods.length === 0) throw new Error('AI 返回的修改清单为空（modifications 缺省）')
  const applied: ApplyModification[] = mods
    .filter((m: any) => m && typeof m.fileId === 'string' && typeof m.content === 'string')
    .map((m: any) => ({
      fileId: m.fileId,
      content: m.content,
      summary: typeof m.summary === 'string' ? m.summary : undefined,
    }))
  if (applied.length === 0) throw new Error('AI 返回的修改清单缺少 fileId/content 字段')
  return { applied, overview: typeof obj?.overview === 'string' ? obj.overview : '' }
}
