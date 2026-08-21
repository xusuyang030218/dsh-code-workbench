/**
 * 内存存储：本次会话（进程）内的代码文件 + 版本历史 + 评测报告。
 * 不落盘；工具半与 web 半在同一 cordis 进程内共享本模块单例。
 *
 * v3 版本化：每次修改追加 versions 记录（upload/paste/ai/manual/rollback），
 * current 指向当前版本；modifiedContent 为派生兼容字段。
 */
import { randomUUID } from 'node:crypto';
import { countLines, MAX_FILES } from './parse.js';
const files = new Map();
const now = () => Date.now();
function derive(record) {
    record.modifiedContent = record.current > 1 ? record.versions[record.versions.length - 1].content : null;
    return record;
}
function pushVersion(record, source, content) {
    const contentStr = String(content ?? '');
    const v = record.versions.length + 1;
    record.versions.push({ v, source, at: now(), lines: countLines(contentStr), content: contentStr });
    record.current = v;
    record.modifiedAt = new Date().toISOString();
    return derive(record);
}
/** 保存一份上传/粘贴的代码文件（source: upload|paste）。 */
export function saveFile(input) {
    const contentStr = String(input.content ?? '');
    const record = {
        id: randomUUID(),
        name: input.name,
        lang: input.lang,
        size: input.size,
        lines: input.lines,
        content: contentStr,
        versions: [{ v: 1, source: input.source ?? 'upload', at: now(), lines: countLines(contentStr), content: contentStr }],
        current: 1,
        modifiedContent: null,
        report: null,
        uploadedAt: new Date().toISOString(),
        modifiedAt: null,
    };
    files.set(record.id, record);
    while (files.size > MAX_FILES) {
        const oldest = [...files.values()].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))[0];
        if (!oldest)
            break;
        files.delete(oldest.id);
    }
    return derive(record);
}
/** 读取记录；不存在返回 null。 */
export function getFile(id) {
    return files.get(id) ?? null;
}
/** 列出所有记录（按上传时间正序）。 */
export function listFiles() {
    return [...files.values()].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}
function requireFile(id) {
    const record = files.get(id);
    if (!record)
        throw new Error(`找不到代码文件 ${id}（请先通过 web 面板「💻 代码」上传）`);
    return record;
}
/** 存储 AI 修改结果（追加 ai 版本）。 */
export function setModified(id, modifiedContent) {
    return pushVersion(requireFile(id), 'ai', modifiedContent);
}
/** 面板手动编辑保存（追加 manual 版本）。 */
export function addManualVersion(id, content) {
    return pushVersion(requireFile(id), 'manual', content);
}
/** 回滚：追加一条 rollback 版本（历史不销毁）。 */
export function rollbackTo(id, v) {
    const record = requireFile(id);
    const target = record.versions.find((x) => x.v === Number(v));
    if (!target)
        throw new Error(`版本 v${v} 不存在（当前共 ${record.versions.length} 个版本）`);
    return pushVersion(record, 'rollback', target.content);
}
/** 存储评测报告。 */
export function setReport(id, report) {
    const record = requireFile(id);
    record.report = String(report ?? '');
    return record;
}
/** 读取指定版本；文件或版本不存在返回 null。 */
export function getVersion(id, v) {
    const record = files.get(id);
    if (!record)
        return null;
    const ver = record.versions.find((x) => x.v === Number(v));
    return ver ? { id: record.id, name: record.name, ...ver } : null;
}
/** 测试用：清空存储。 */
export function _clearForTest() {
    files.clear();
}
