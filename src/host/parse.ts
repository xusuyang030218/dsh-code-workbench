/**
 * 代码解析/工具半：语言检测 + 行数统计 + 文本解码 + 二进制嗅探 + ZIP 打包。
 * 零运行时依赖：node:zlib + 手写中央目录 + 自带 CRC32。
 */
import { deflateRawSync } from 'node:zlib'

/** 单个文件大小上限（字节）。 */
export const MAX_FILE_BYTES = 1024 * 1024
/** 单次会话最多保留的文件数。 */
export const MAX_FILES = 60
/** code_workbench read / ai apply 的单文件字符上限。 */
export const MAX_READ_CHARS = 200000

/** 按扩展名映射语言 key。 */
export const LANG_MAP: Record<string, string> = {
  '.py': 'python', '.pyw': 'python',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.html': 'html', '.htm': 'html', '.xhtml': 'html',
  '.css': 'css',
  '.scss': 'scss', '.less': 'css',
  '.sql': 'sql',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.vue': 'vue', '.svelte': 'html',
  '.json': 'json',
  '.xml': 'xml', '.svg': 'xml',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown', '.markdown': 'markdown', '.mdown': 'markdown',
  '.txt': 'text', '.log': 'text', '.conf': 'text', '.env': 'text', '.ini': 'text', '.cfg': 'text',
  '.toml': 'text', '.csv': 'text', '.tsv': 'text',
}

/** 无扩展名 / 特殊文件名推断。 */
const SPECIAL_FILES: Record<string, string> = {
  dockerfile: 'bash',
  makefile: 'bash',
  gemfile: 'ruby',
  rakefile: 'ruby',
}

/** 按文件名推断语言 key；未知回退 text。 */
export function detectLang(fileName: string): string {
  const base = String(fileName ?? '').toLowerCase()
  const plain = base.split(/[\\/]/).pop() ?? base
  const dot = plain.lastIndexOf('.')
  const ext = dot >= 0 ? plain.slice(dot) : ''
  if (LANG_MAP[ext]) return LANG_MAP[ext]
  const noExt = dot >= 0 ? plain.slice(0, dot) : plain
  if (SPECIAL_FILES[noExt]) return SPECIAL_FILES[noExt]
  return 'text'
}

/** 统计文本行数。 */
export function countLines(text: string): number {
  const s = String(text ?? '')
  if (s === '') return 0
  return s.split(/\r\n|\r|\n/).length
}

/** 带 BOM/编码检测的文本解码：utf-8（默认）→ utf-16 → gbk 回退。 */
export function decodeText(buf: Buffer): string {
  if (buf.length >= 2) {
    if (buf[0] === 0xff && buf[1] === 0xfe) {
      try { return new TextDecoder('utf-16le').decode(buf.subarray(2)) } catch { /* fall through */ }
    }
    if (buf[0] === 0xfe && buf[1] === 0xff) {
      try { return new TextDecoder('utf-16be').decode(buf.subarray(2)) } catch { /* fall through */ }
    }
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  const utf8 = buf.toString('utf8')
  if (utf8.includes('\uFFFD')) {
    try { return new TextDecoder('gbk').decode(buf) } catch { /* 无 gbk 支持则保持 utf-8 */ }
  }
  return utf8
}

/** 二进制嗅探：解码后含 NUL 或高比例 U+FFFD 视为非文本（上传/文件夹过滤兜底）。 */
export function looksBinaryDecoded(s: string): boolean {
  if (s.length === 0) return false
  if (s.includes('\u0000')) return true
  let bad = 0
  const sample = Math.min(s.length, 4096)
  for (let i = 0; i < sample; i += 1) if (s[i] === '\uFFFD') bad += 1
  return bad / sample > 0.2
}

// --- CRC32（查表法） ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** DOS 日期/时间（ZIP 头需要）。 */
function dosDateTime(d = new Date()) {
  const year = d.getFullYear()
  const y = year >= 1980 ? year - 1980 : 0
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = (y << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

export interface ZipEntry {
  name: string
  data: Buffer | string
}

/** 把一组文件打包为 ZIP（deflate，UTF-8 文件名，保留相对路径子目录）。 */
export function buildZip(entries: ZipEntry[]): Buffer {
  const now = dosDateTime()
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const nameBuf = Buffer.from(String(entry.name), 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const compressed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(now.time, 10)
    local.writeUInt16LE(now.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBuf, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(now.time, 12)
    central.writeUInt16LE(now.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuf)

    offset += local.length + nameBuf.length + compressed.length
  }

  const centralBuf = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, centralBuf, eocd])
}
