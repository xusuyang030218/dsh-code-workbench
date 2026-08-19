/**
 * dsh-code-workbench web 半：同源路由，供浏览器面板上传代码 / 拉取结果 / 下载。
 *
 * 独立成行（而非并入 host 工具半）是因为 cordis 的 inject 是强依赖：
 * webServer 只在 web profile 存在，headless 下挂载本行会永远 PENDING。
 *
 * 路由（前缀 /dsh-code-workbench）：
 *   POST /upload                   原始字节 body + header x-file-name → 存内存 → 返回文件记录
 *   GET  /list                     当前会话全部文件（含原始内容 / 修改结果 / 评测报告）
 *   GET  /download/<fileId>        单个文件下载（有修改结果则下载修改后代码，否则原始代码）
 *   GET  /download-all             全部文件打包 .zip 下载
 */
import { basename } from 'node:path'
import { MAX_FILE_BYTES, detectLang, countLines, decodeText, buildZip } from './parse.mjs'
import { getFile, listFiles, saveFile } from './store.mjs'

export const name = 'dsh-code-workbench-web'
export const inject = ['webServer']

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 记录去内部字段后的 JSON 友好视图（供 /list 返回）。 */
function recordView(r) {
  return {
    id: r.id,
    name: r.name,
    lang: r.lang,
    size: r.size,
    lines: r.lines,
    content: r.content,
    modifiedContent: r.modifiedContent,
    report: r.report,
    uploadedAt: r.uploadedAt,
    modifiedAt: r.modifiedAt,
  }
}

/** 去掉文件名的路径与目录穿越，保留 basename，并清洗控制字符。 */
function cleanName(rawName) {
  return basename(rawName).replace(/[\u0000-\u001f\u007f]/g, '').replace(/^\.+$/, '') || 'code.txt'
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/dsh-code-workbench',
    async handler(req, res) {
      const url = new URL(req.url ?? '', 'http://localhost')
      const pathname = url.pathname
      try {
        // --- 上传 ---
        if (pathname === '/dsh-code-workbench/upload' && (req.method === 'POST' || req.method === 'PUT')) {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > MAX_FILE_BYTES) {
              json(res, 413, { ok: false, error: `文件超过大小上限（${Math.round(MAX_FILE_BYTES / 1024)}KB）` })
              return
            }
            chunks.push(Buffer.from(chunk))
          }
          const data = Buffer.concat(chunks)
          let rawName = String(req.headers['x-file-name'] ?? 'code.txt')
          try { rawName = decodeURIComponent(rawName) } catch { /* 保留原文 */ }
          const name = cleanName(rawName)
          const content = decodeText(data)
          const record = saveFile({
            name,
            lang: detectLang(name),
            size: data.byteLength,
            lines: countLines(content),
            content,
          })
          json(res, 200, { ok: true, file: recordView(record) })
          return
        }

        // --- 列表 ---
        if (pathname === '/dsh-code-workbench/list' && (req.method === 'GET' || req.method === 'HEAD')) {
          json(res, 200, { ok: true, files: listFiles().map(recordView) })
          return
        }

        // --- 打包下载 ---
        if (pathname === '/dsh-code-workbench/download-all' && req.method === 'GET') {
          const records = listFiles()
          if (records.length === 0) {
            json(res, 404, { ok: false, error: '当前没有可下载的文件（请先上传代码）' })
            return
          }
          const entries = records.map((r) => ({
            name: r.name,
            data: r.modifiedContent != null ? r.modifiedContent : r.content,
          }))
          const zip = buildZip(entries)
          res.writeHead(200, {
            'content-type': 'application/zip',
            'content-disposition': 'attachment; filename="code-workbench.zip"',
            'content-length': zip.length,
          })
          res.end(zip)
          return
        }

        // --- 单文件下载 ---
        const dlMatch = pathname.match(/^\/dsh-code-workbench\/download\/([^/]+)$/)
        if (dlMatch && req.method === 'GET') {
          const fileId = decodeURIComponent(dlMatch[1])
          const record = getFile(fileId)
          if (!record) {
            json(res, 404, { ok: false, error: '文件不存在' })
            return
          }
          const isModified = record.modifiedContent != null
          const body = Buffer.from(isModified ? record.modifiedContent : record.content, 'utf8')
          const downloadName = isModified ? record.name : record.name
          res.writeHead(200, {
            'content-type': 'application/octet-stream; charset=utf-8',
            'content-disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
            'content-length': body.length,
          })
          res.end(body)
          return
        }

        json(res, 404, { ok: false, error: '未知路由' })
      } catch (error) {
        json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-code-workbench: upload/list/download routes')
}
