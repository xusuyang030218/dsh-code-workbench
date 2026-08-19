/**
 * dsh-code-workbench 内存存储：本次会话（进程）内的代码文件 + 修改结果。
 *
 * 不落盘、不持久化（进程重启即清空），符合规格「存内存即可」。
 * 工具半（index.mjs）与 web 半（web.mjs）在同一 cordis 进程内共享本模块单例。
 */
import { randomUUID } from 'node:crypto'
import { MAX_FILES } from './parse.mjs'

/** fileId -> 文件记录。 */
const files = new Map()

/**
 * 文件记录结构：
 * {
 *   id,               // fileId（uuid）
 *   name,             // 文件名（basename，已清洗控制字符）
 *   lang,             // 检测到的语言 key
 *   size,             // 字节数
 *   lines,            // 行数
 *   content,          // 原始代码文本
 *   modifiedContent,  // null | string（AI 修改后代码）
 *   report,           // null | string（AI 评测报告 Markdown）
 *   uploadedAt,       // ISO 时间
 *   modifiedAt,       // ISO 时间 | null
 * }
 */

/** 保存一份上传的代码文件，返回记录（含 id）。 */
export function saveFile({ name, lang, size, lines, content }) {
  const id = randomUUID()
  const record = {
    id,
    name,
    lang,
    size,
    lines,
    content,
    modifiedContent: null,
    report: null,
    uploadedAt: new Date().toISOString(),
    modifiedAt: null,
  }
  files.set(id, record)
  // 超出上限时按上传时间淘汰最旧条目。
  while (files.size > MAX_FILES) {
    const oldest = [...files.values()].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))[0]
    if (!oldest) break
    files.delete(oldest.id)
  }
  return record
}

/** 读取记录；不存在返回 null。 */
export function getFile(id) {
  return files.get(id) ?? null
}

/** 列出所有记录（按上传时间正序）。 */
export function listFiles() {
  return [...files.values()].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
}

/** 存储某文件的修改结果；文件不存在则抛错。返回更新后的记录。 */
export function setModified(id, modifiedContent) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}（请先通过 web 面板「💻 代码」上传）`)
  record.modifiedContent = String(modifiedContent ?? '')
  record.modifiedAt = new Date().toISOString()
  return record
}

/** 存储某文件的评测报告；文件不存在则抛错。返回更新后的记录。 */
export function setReport(id, report) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}（请先通过 web 面板「💻 代码」上传）`)
  record.report = String(report ?? '')
  return record
}
