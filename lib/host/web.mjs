/**
 * dsh-code-workbench web 半：同源路由，供浏览器面板上传/粘贴/编辑/版本/下载。
 *
 * 独立成行（而非并入 host 工具半）是因为 cordis 的 inject 是强依赖：
 * webServer 只在 web profile 存在，headless 下挂载本行会永远 PENDING。
 *
 * 路由（前缀 /dsh-code-workbench）：
 *   POST /upload                       原始字节 body + header x-file-name → v1(upload)
 *   POST /paste                        body JSON { name, content } → v1(paste)
 *   GET  /list?meta=1                  全量记录（版本 meta 不含大字段）/ 轻量轮询元数据
 *   PUT  /file/<id>                    body JSON { content } → 追加 manual 版本
 *   POST /rollback/<id>                body JSON { to: v } → 追加 rollback 版本
 *   GET  /version/<id>/<v>             读取指定版本内容（历史查看/对比用）
 *   GET  /download/<fileId>?version=N  单文件下载（指定版本，缺省当前）
 *   GET  /download-all?ids=a,b         zip 打包（按勾选 id，缺省全部）
 */
import { MAX_FILE_BYTES, detectLang, countLines, decodeText, buildZip } from './parse.mjs'
import { getFile, listFiles, saveFile, addManualVersion, rollbackTo, getVersion } from './store.mjs'

export const name = 'dsh-code-workbench-web'
export const inject = ['webServer']

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 记录 → 全量 JSON 视图（versions 只带 meta，content 按需 /version 拉取）。 */
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
    current: r.current,
    versionCount: r.versions.length,
    versions: r.versions.map(({ v, source, at, lines }) => ({ v, source, at, lines })),
  }
}

/** 记录 → 轻量轮询视图（不含 content/report 大字段）。 */
function metaView(r) {
  return {
    id: r.id,
    name: r.name,
    lang: r.lang,
    lines: r.lines,
    current: r.current,
    versionCount: r.versions.length,
    hasReport: r.report != null && r.report !== '',
    hasModified: r.current > 1,
  }
}

/** 清洗文件名/相对路径：统一 / 分隔、去控制字符、防目录穿越（..）。 */
function cleanName(rawName) {
  const cleaned = String(rawName)
    .replace(/\\/g, '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((seg) => seg !== '' && seg !== '.' && seg !== '..')
    .join('/')
  return cleaned || 'code.txt'
}

/** 读取 JSON body（限 1MB）。 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_FILE_BYTES) throw new Error('请求体超过大小上限')
    chunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('请求体不是有效 JSON')
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/dsh-code-workbench',
    async handler(req, res) {
      const url = new URL(req.url ?? '', 'http://localhost')
      const pathname = url.pathname
      try {
        // --- 上传（原始字节） ---
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
            source: 'upload',
          })
          json(res, 200, { ok: true, file: recordView(record) })
          return
        }

        // --- 粘贴代码建文件 ---
        if (pathname === '/dsh-code-workbench/paste' && (req.method === 'POST' || req.method === 'PUT')) {
          const body = await readJsonBody(req)
          const name = cleanName(String(body?.name ?? 'snippet.txt'))
          const content = String(body?.content ?? '')
          if (content.trim() === '') {
            json(res, 400, { ok: false, error: '内容不能为空' })
            return
          }
          const record = saveFile({
            name,
            lang: detectLang(name),
            size: Buffer.byteLength(content, 'utf8'),
            lines: countLines(content),
            content,
            source: 'paste',
          })
          json(res, 200, { ok: true, file: recordView(record) })
          return
        }

        // --- 手动编辑保存（追加 manual 版本） ---
        const fileMatch = pathname.match(/^\/dsh-code-workbench\/file\/([^/]+)$/)
        if (fileMatch && (req.method === 'PUT' || req.method === 'POST')) {
          const fileId = decodeURIComponent(fileMatch[1])
          const body = await readJsonBody(req)
          if (typeof body?.content !== 'string') {
            json(res, 400, { ok: false, error: '缺少 content 字段' })
            return
          }
          const record = addManualVersion(fileId, body.content)
          json(res, 200, { ok: true, file: recordView(record) })
          return
        }

        // --- 回滚 ---
        const rbMatch = pathname.match(/^\/dsh-code-workbench\/rollback\/([^/]+)$/)
        if (rbMatch && (req.method === 'POST' || req.method === 'PUT')) {
          const fileId = decodeURIComponent(rbMatch[1])
          const body = await readJsonBody(req)
          const record = rollbackTo(fileId, body?.to)
          json(res, 200, { ok: true, file: recordView(record) })
          return
        }

        // --- 版本内容 ---
        const verMatch = pathname.match(/^\/dsh-code-workbench\/version\/([^/]+)\/(\d+)$/)
        if (verMatch && (req.method === 'GET' || req.method === 'HEAD')) {
          const fileId = decodeURIComponent(verMatch[1])
          const v = Number(verMatch[2])
          const ver = getVersion(fileId, v)
          if (!ver) {
            json(res, 404, { ok: false, error: `文件或版本 v${v} 不存在` })
            return
          }
          json(res, 200, { ok: true, version: { v: ver.v, source: ver.source, at: ver.at, lines: ver.lines, content: ver.content } })
          return
        }

        // --- 列表（全量 / 轻量轮询） ---
        if (pathname === '/dsh-code-workbench/list' && (req.method === 'GET' || req.method === 'HEAD')) {
          const records = listFiles()
          if (url.searchParams.get('meta') === '1') {
            json(res, 200, { ok: true, meta: true, files: records.map(metaView) })
          } else {
            json(res, 200, { ok: true, files: records.map(recordView) })
          }
          return
        }

        // --- 打包下载（按 ids 勾选，缺省全部） ---
        if (pathname === '/dsh-code-workbench/download-all' && req.method === 'GET') {
          const idsParam = url.searchParams.get('ids')
          const wanted = idsParam ? new Set(idsParam.split(',').filter(Boolean)) : null
          const records = listFiles().filter((r) => !wanted || wanted.has(r.id))
          if (records.length === 0) {
            json(res, 404, { ok: false, error: '没有可下载的文件（勾选为空或未上传）' })
            return
          }
          const entries = records.map((r) => ({
            name: r.name,
            data: r.current > 1 ? r.versions[r.versions.length - 1].content : r.content,
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

        // --- 单文件下载（?version=N 指定版本，缺省当前） ---
        const dlMatch = pathname.match(/^\/dsh-code-workbench\/download\/([^/]+)$/)
        if (dlMatch && req.method === 'GET') {
          const fileId = decodeURIComponent(dlMatch[1])
          const record = getFile(fileId)
          if (!record) {
            json(res, 404, { ok: false, error: '文件不存在' })
            return
          }
          const vParam = url.searchParams.get('version')
          let bodyStr
          let isModified
          if (vParam != null) {
            const ver = getVersion(fileId, Number(vParam))
            if (!ver) {
              json(res, 404, { ok: false, error: `版本 v${vParam} 不存在` })
              return
            }
            bodyStr = ver.content
            isModified = ver.v > 1
          } else {
            bodyStr = record.current > 1 ? record.versions[record.versions.length - 1].content : record.content
            isModified = record.current > 1
          }
          const body = Buffer.from(bodyStr, 'utf8')
          const dlName = record.name.split('/').pop() || record.name
          const fileName = vParam != null ? dlName.replace(/(\.\w+)?$/, `.v${vParam}$1`) : dlName
          res.writeHead(200, {
            'content-type': 'application/octet-stream; charset=utf-8',
            'content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
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
  }), 'dsh-code-workbench: upload/paste/file/rollback/version/list/download routes')
}
