/**
 * dsh-code-workbench 内存存储：本次会话（进程）内的代码文件 + 版本历史 + 评测报告。
 *
 * 不落盘、不持久化（进程重启即清空）。工具半（index.mjs）与 web 半（web.mjs）
 * 在同一 cordis 进程内共享本模块单例。
 *
 * v3 版本化（设计文档 §6.1）：每次修改追加一条 versions 记录（upload / paste /
 * ai / manual / rollback），current 指向当前版本；modifiedContent 为派生兼容字段
 * （= 当前版本内容），旧面板/工具语义不破。
 */
import { randomUUID } from 'node:crypto'
import { countLines, MAX_FILES } from './parse.mjs'

/** fileId -> 文件记录。 */
const files = new Map()

const now = () => Date.now()

/**
 * 文件记录结构：
 * {
 *   id, name, lang, size, lines,
 *   content,               // v1 原始内容（兼容保留）
 *   versions: [            // 追加式版本历史
 *     { v, source, at, lines, content },   // source: upload|paste|ai|manual|rollback
 *   ],
 *   current,               // 当前版本号（1-based，= 最后一个版本的 v）
 *   modifiedContent,       // 派生：current > 1 ? 当前版本内容 : null
 *   report, uploadedAt, modifiedAt,
 * }
 */

function derive(record) {
  record.modifiedContent = record.current > 1 ? record.versions[record.versions.length - 1].content : null
  return record
}

function pushVersion(record, source, content) {
  const contentStr = String(content ?? '')
  const v = record.versions.length + 1
  record.versions.push({ v, source, at: now(), lines: countLines(contentStr), content: contentStr })
  record.current = v
  record.modifiedAt = new Date().toISOString()
  return derive(record)
}

/** 保存一份上传/粘贴的代码文件（source: upload|paste），返回记录（含 id）。 */
export function saveFile({ name, lang, size, lines, content, source = 'upload' }) {
  const id = randomUUID()
  const contentStr = String(content ?? '')
  const record = {
    id,
    name,
    lang,
    size,
    lines,
    content: contentStr,
    versions: [{ v: 1, source, at: now(), lines: countLines(contentStr), content: contentStr }],
    current: 1,
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
  return derive(record)
}

/** 读取记录；不存在返回 null。 */
export function getFile(id) {
  return files.get(id) ?? null
}

/** 列出所有记录（按上传时间正序）。 */
export function listFiles() {
  return [...files.values()].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
}

/** 存储某文件的 AI 修改结果（追加 ai 版本）；文件不存在则抛错。 */
export function setModified(id, modifiedContent) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}（请先通过 web 面板「💻 代码」上传）`)
  return pushVersion(record, 'ai', modifiedContent)
}

/** 面板手动编辑保存（追加 manual 版本）。 */
export function addManualVersion(id, content) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}`)
  return pushVersion(record, 'manual', content)
}

/** 回滚到指定版本：追加一条 rollback 版本（内容取自目标版本，历史不销毁）。 */
export function rollbackTo(id, v) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}`)
  const target = record.versions.find((x) => x.v === Number(v))
  if (!target) throw new Error(`版本 v${v} 不存在（当前共 ${record.versions.length} 个版本）`)
  return pushVersion(record, 'rollback', target.content)
}

/** 存储某文件的评测报告；文件不存在则抛错。 */
export function setReport(id, report) {
  const record = files.get(id)
  if (!record) throw new Error(`找不到代码文件 ${id}（请先通过 web 面板「💻 代码」上传）`)
  record.report = String(report ?? '')
  return record
}

/** 读取指定版本；文件或版本不存在返回 null。 */
export function getVersion(id, v) {
  const record = files.get(id)
  if (!record) return null
  const ver = record.versions.find((x) => x.v === Number(v))
  return ver ? { id: record.id, name: record.name, ...ver } : null
}
