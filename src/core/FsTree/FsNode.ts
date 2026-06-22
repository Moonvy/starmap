import path from "node:path"
import fs from "node:fs/promises"
import { globSync } from "local-glob"
import { FsTree } from "."
import { preloadMarkdown } from "../../utils/markdown/preloadMarkdown"

const CacheDurationMs = 5 * 60 * 1000 // 缓存有效期，5 分钟

/**
 * 表示文件系统中的一个节点，可以是文件或目录，提供读取文件内容的接口
 *
 * 缓存读取机制：\
 * 通过 `readBuffer` 和 `readText` 方法读取文件内容时，首次读取会将内容缓存到内存中，
 * 后续读取将直接返回缓存内容，提升读取性能。读取实际文件时会检查文件的修改时间，连同
 * 读取时间一并存储在节点中。
 *
 * 缓存失效条件：\
 * - 根据 contentCachedTime 计算缓存存在时间，如果超过 CacheDurationMs 则认为缓存失效
 * - FsTree 会监视文件系统的变化事件，再根据比较 MTime 来判断缓存是否失效，此机制由
 * FsTree 触发
 */
export class FsNode {
    fsTree: FsTree
    /** 文件绝对路径 */
    fileFullPath: string
    /** 文件相对路径（相对于 FsTree 的 rootPath） */
    get fileRelativePath(): string {
        return path.relative(this.fsTree.options.rootPath!, this.fileFullPath)
    }

    private _contentBuffer: ArrayBuffer | null = null
    private _contentMTime: number | null = null
    private _contentCachedTime: number | null = null

    private _contentText: string | null = null
    private _contentTextMTime: number | null = null
    private _contentTextCachedTime: number | null = null

    private _contentMarkdown: { metadata: any; content: string } | null = null
    private _contentMarkdownMTime: number | null = null
    private _contentMarkdownCachedTime: number | null = null

    constructor(fileFullPath: string, fsTree: FsTree) {
        this.fileFullPath = fileFullPath
        this.fsTree = fsTree
    }

    /** 读取文件内容，返回 ArrayBuffer，会缓存内容以提升性能 */
    async readBuffer(): Promise<ArrayBuffer> {
        // 检查缓存是否仍在有效期内
        if (this._contentBuffer && this._contentCachedTime) {
            const elapsed = Date.now() - this._contentCachedTime
            if (elapsed < CacheDurationMs) {
                return this._contentBuffer
            }
        }

        // 从磁盘读取文件内容和修改时间
        const [uint8, stats] = await Promise.all([fs.readFile(this.fileFullPath), fs.stat(this.fileFullPath)])

        // 将 Uint8Array 的底层 buffer 提取为独立的 ArrayBuffer
        this._contentBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength)
        this._contentMTime = stats.mtimeMs
        this._contentCachedTime = Date.now()

        return this._contentBuffer
    }

    /** 读取文件内容，返回文本内容，会缓存内容以提升性能 */
    async readText(): Promise<string> {
        // 检查缓存是否仍在有效期内
        if (this._contentText !== null && this._contentTextCachedTime) {
            const elapsed = Date.now() - this._contentTextCachedTime
            if (elapsed < CacheDurationMs) {
                return this._contentText
            }
        }

        // 从磁盘读取文本内容和修改时间
        const [text, stats] = await Promise.all([fs.readFile(this.fileFullPath, "utf-8"), fs.stat(this.fileFullPath)])

        this._contentText = text
        this._contentTextMTime = stats.mtimeMs
        this._contentTextCachedTime = Date.now()

        return this._contentText
    }

    /** 读取 Markdown 元数据和内容 */
    async readMarkdown(): Promise<{ metadata: any; content: string }> {
        // 检查缓存是否仍在有效期内
        if (this._contentMarkdown !== null && this._contentMarkdownCachedTime) {
            const elapsed = Date.now() - this._contentMarkdownCachedTime
            if (elapsed < CacheDurationMs) {
                return this._contentMarkdown
            }
        }

        let text = await this.readText()
        let re = preloadMarkdown(text)
        this._contentMarkdown = re
        this._contentMarkdownMTime = this._contentTextMTime
        this._contentMarkdownCachedTime = Date.now()
        return re
    }

    /** 根据给定的新 Mtime 判断缓存的内容是否失效，如果失效则清除缓存
     *  由 FsTree 触发
     *  @param newMtime 文件的新修改时间戳
     */
    changeCache(newMtime: number) {
        // 检查 Buffer 缓存：mtime 不同则失效
        if (this._contentMTime !== null && this._contentMTime !== newMtime) {
            this._contentBuffer = null
            this._contentMTime = null
            this._contentCachedTime = null
        }

        // 检查 Text 缓存：mtime 不同则失效
        if (this._contentTextMTime !== null && this._contentTextMTime !== newMtime) {
            this._contentText = null
            this._contentTextMTime = null
            this._contentTextCachedTime = null
        }

        // 检查 Markdown 缓存：mtime 不同则失效
        if (this._contentMarkdownMTime !== null && this._contentMarkdownMTime !== newMtime) {
            this._contentMarkdown = null
            this._contentMarkdownMTime = null
            this._contentMarkdownCachedTime = null
        }
    }

    /** 父节点 */
    get parent() {
        let parentPath = path.dirname(this.fileFullPath)
        return this.fsTree.getOrCreateNode(parentPath)
    }

    /** 获取子文件夹中匹配 glob 模式的 FsNode 列表
     *  @param pattern glob 模式，如 `*.ts` 或 `**\/*.vue`
     *  @returns 匹配的 FsNode 数组
     */
    globChildren(pattern: string): FsNode[] {
        // 以当前节点的目录为基准进行 glob 匹配
        const matchedFiles = globSync(pattern, { cwd: this.fileFullPath, absolute: true })
        return matchedFiles.map((filePath) => this.fsTree.getOrCreateNode(filePath))
    }

    /** 根据文件名获取子级下的 FsNode
     *  @param fileName 子文件或目录名称
     */
    getChildrenByName(fileName: string): FsNode | undefined {
        const childPath = path.join(this.fileFullPath, fileName)
        return this.fsTree.getOrCreateNode(childPath)
    }

    /** 根据文件名获取同级下的 FsNode
     *  @param fileName 同级文件或目录名称
     */
    getNeighborByName(fileName: string): FsNode | undefined {
        const parentDir = path.dirname(this.fileFullPath)
        const neighborPath = path.join(parentDir, fileName)
        return this.fsTree.getOrCreateNode(neighborPath)
    }
}
