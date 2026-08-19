/**
 * dsh-code-workbench host 半（main）：code_workbench 工具 + 系统提示宣告。
 *
 * 契约：ctx.tools.register（与 dsh-doc-import 同款手写工具定义，零裸导入）。
 * 存储：进程内内存 Map（lib/host/store.mjs），工具半与 web 半共享。
 * 本行只依赖 tools（headless 可用）；web 上传/下载路由在 ./web 单独一行。
 */
import { MAX_READ_CHARS } from './parse.mjs'
import { getFile, listFiles, setModified, setReport } from './store.mjs'

export const name = 'dsh-code-workbench'
export const inject = ['tools']

export function apply(ctx) {
  // 系统提示：宣告代码工作台能力（web 面板按钮 + 工具配合）。
  ctx.get('systemPrompt')?.section({
    name: 'dsh-code-workbench',
    order: 160,
    text: '代码工作台：用户可通过对话输入栏的「💻 代码」按钮上传代码文件并选择操作类型（优化/重构/审查/修Bug/加注释/加测试/转语言）。当用户上传代码后，先用 code_workbench(action="list") 查看文件列表，再用 code_workbench(action="read", fileId=...) 读取具体文件内容；按用户选择的操作类型处理后，对每个被修改的文件调用 code_workbench(action="modify", fileId=..., modification=该文件修改后的完整代码) 存储结果；若用户需要评测，调用 code_workbench(action="review", fileId=..., report=Markdown评测报告，含质量评分/问题列表/改进建议)。用户可在面板中下载修改后的代码、查看 diff 差异、阅读评测报告。',
  })

  // 与 @deepseek-ai/dsh-tools 的 defineTool 产物等价的手写工具定义。
  const tool = {
    name: 'code_workbench',
    description: '读取/修改/评测用户通过「💻 代码」按钮上传的代码文件。read=读取代码内容；modify=存储修改后的完整代码；review=存储Markdown评测报告；list=列出已上传文件。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'modify', 'review', 'list'],
          description: 'read=读取代码内容；modify=存储修改后代码；review=存储评测报告；list=列出已上传文件',
        },
        fileId: {
          type: 'string',
          description: '文件ID（read/modify/review 时必传；可用 list 获取）',
        },
        modification: {
          type: 'string',
          description: 'modify 时必传：修改后的完整代码内容',
        },
        report: {
          type: 'string',
          description: 'review 时必传：Markdown 格式的评测报告（含质量评分/问题列表/改进建议）',
        },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          fileId: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          name: { type: 'string' },
          lang: { type: 'string' },
          lines: { type: 'number' },
          content: { type: 'string' },
          ok: { type: 'boolean' },
          downloadUrl: { type: 'string' },
          report: { type: 'string' },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => {
        let text
        if (value.content) {
          text = `===== ${value.name}（${value.lang}，${value.lines} 行，fileId: ${value.fileId}） =====\n${value.content}`
        } else if (value.message) {
          text = value.message
        } else if (value.ok) {
          text = value.downloadUrl
            ? `已存储 ${value.name} 的修改结果（fileId: ${value.fileId}）。下载地址：${value.downloadUrl}`
            : `已存储 ${value.name} 的评测报告（fileId: ${value.fileId}）。`
        } else {
          text = '（code_workbench 完成）'
        }
        return [{ type: 'text', text }]
      },
    },
    async execute(args) {
      const action = args?.action
      if (action === 'read') {
        if (!args?.fileId) throw new Error('code_workbench read 需要 fileId 参数（可先用 action="list" 查看）')
        const record = getFile(args.fileId)
        if (!record) throw new Error(`找不到代码文件 ${args.fileId}（请先通过 web 面板「💻 代码」上传，或用 action="list" 查看）`)
        const truncated = record.content.length > MAX_READ_CHARS
        const content = truncated
          ? `${record.content.slice(0, MAX_READ_CHARS)}\n\n[内容已截断：全文 ${record.content.length} 字符，已保留前 ${MAX_READ_CHARS}]`
          : record.content
        return { fileId: record.id, name: record.name, lang: record.lang, lines: record.lines, content, ok: true, downloadUrl: '', report: '', message: '' }
      }
      if (action === 'modify') {
        if (!args?.fileId) throw new Error('code_workbench modify 需要 fileId 参数')
        if (typeof args?.modification !== 'string' || args.modification.trim() === '') throw new Error('code_workbench modify 需要 modification 参数（修改后的完整代码）')
        const record = setModified(args.fileId, args.modification)
        return { fileId: record.id, name: record.name, lang: record.lang, lines: record.lines, content: '', ok: true, downloadUrl: `/dsh-code-workbench/download/${record.id}`, report: '', message: '' }
      }
      if (action === 'review') {
        if (!args?.fileId) throw new Error('code_workbench review 需要 fileId 参数')
        if (typeof args?.report !== 'string' || args.report.trim() === '') throw new Error('code_workbench review 需要 report 参数（Markdown 评测报告）')
        const record = setReport(args.fileId, args.report)
        return { fileId: record.id, name: record.name, lang: record.lang, lines: record.lines, content: '', ok: true, downloadUrl: '', report: record.report, message: '' }
      }
      if (action === 'list') {
        const records = listFiles()
        if (records.length === 0) {
          return { fileId: null, name: '', lang: '', lines: 0, content: '', ok: false, downloadUrl: '', report: '', message: '（暂无已上传代码文件。用户可通过 web 输入栏「💻 代码」按钮上传）' }
        }
        const listing = records.map((r) => `- ${r.name}（${r.lang}，${r.lines} 行，v${r.current}/${r.versions.length}${r.modifiedContent != null ? '，已修改' : ''}${r.report != null ? '，已评测' : ''}）fileId=${r.id}`).join('\n')
        return { fileId: null, name: '', lang: '', lines: 0, content: '', ok: true, downloadUrl: '', report: '', message: `已上传代码文件列表（用 code_workbench(action="read", fileId=...) 读取全文）：\n${listing}` }
      }
      throw new Error(`code_workbench 未知 action：${action}（可选 read/modify/review/list）`)
    },
  }
  ctx.tools.register(tool)
}
