import path from "node:path"
import { FsNode } from "./FsNode"
import { RawEvents, defineEvents } from "fzz"
import { subscribe } from "@parcel/watcher"
import { globSync } from "local-glob"
import fs from "node:fs/promises"
import type { Stats } from "node:fs"
import { log } from "fzz"

export interface IFsTreeOptions {
    watch?: boolean
    /** 项目根路径（） */
    rootPath?: string
    /** ignored 规则，支持 glob 或函数 */
    ignored?: string | string[] | ((path: string) => boolean)
}

/**
 * 监视的文件系统树，用于监视文件和目录的变化，并提供带内存缓存的访问文件内容的接口
 *
 */
export class FsTree {
    /** 文件系统事件
     *  事件名是 fileRelativePath ，根据 fileRelativePath 就可以监听一个文件的变化，再通过
     *  事件数据获取事件类型
     */
    fsEvent = new RawEvents<typeof FsEventDefine>()
    /** 文件节点映射表，key 为文件绝对路径 */
    private nodeMap: Map<string, FsNode> = new Map()
    /** 选项 */
    options: IFsTreeOptions
    constructor(
        /** 项目根路径 */
        rootPath: string,
        /** 选项 */
        options?: IFsTreeOptions,
    ) {
        this.options = Object.assign({ rootPath }, options)
        if (this.options.watch) {
            this._watch()
        }
    }

    /**  扫描文件路径，返回匹配的 FsNode 列表
     * @example
     *
     * ```ts
     * scanFiles(["src/readme.md?", "src/utils/*.ts"])
     *
     * ```
     */
    scanFiles(patterns: string[] | string): FsNode[] {
        if (typeof patterns === "string") {
            patterns = [patterns]
        }
        // 通配符模式：递归扫描文件系统，用 local-glob 匹配
        const rootPath = this.options.rootPath!
        let matchedFiles: string[] = globSync(patterns, { cwd: rootPath, absolute: true })

        // 过滤 . 开头与 node_modules 目录
        const shouldIgnorePath = (inputPath: string) => {
            const normalizedPath = inputPath.split(path.sep).join("/")
            const parts = normalizedPath.split("/").filter(Boolean)
            for (const part of parts) {
                if (part === "node_modules" || part.startsWith(".")) return true
            }
            return false
        }

        matchedFiles = matchedFiles.filter((filePath) => !shouldIgnorePath(filePath))

        return matchedFiles.map((relativePath) => {
            const fullPath = path.resolve(rootPath, relativePath)
            return this.getOrCreateNode(fullPath)
        })
    }

    /** 解析文件路径，返回绝对路径
     *  会根据 FsTree 的 rootPath 进行解析
     */
    resolvePath(filePath: string): string {
        if (path.isAbsolute(filePath)) return filePath
        return path.resolve(this.options.rootPath!, filePath)
    }

    //---------------------------

    /** 获取或创建 FsNode，优先从 nodeMap 缓存中获取
     * @param fullPath 文件绝对路径
     */
    getOrCreateNode(fullPath: string): FsNode {
        let node = this.nodeMap.get(fullPath)
        if (!node) {
            node = new FsNode(fullPath, this)
            this.nodeMap.set(fullPath, node)
        }
        return node
    }

    /** 监控文件变化
     *
     * - 维护 nodeMap 中 FsNode 的缓存状态
     * - 如果文件被删除，则从 nodeMap 中移除对应的 FsNode
     * - 触发 fsEvent 事件，通知监听者文件变化
     */
    private _watch() {
        const rootPath = this.options.rootPath!

        const { ignorePatterns, ignoreMatcher } = this._buildIgnoreMatcher()

        log("<FsTree|watch|rootPath>", rootPath)

        void subscribe(
            rootPath,
            async (err, events) => {
                if (err) {
                    log("<FsTree|watch|error>", err)
                    return
                }

                for (const event of events) {
                    const fullPath = event.path
                    if (ignoreMatcher(fullPath)) continue

                    const relativePath = path.relative(rootPath, fullPath).split(path.sep).join("/")

                    if (event.type === "update") {
                        log("<FsTree|watch|fileChanged>", relativePath)
                        const node = this.nodeMap.get(fullPath)
                        if (node) {
                            const stats = await this._safeStat(fullPath)
                            if (stats) {
                                node.changeCache(stats.mtimeMs)
                            }
                        }
                        this.fsEvent.emit(FsEvents.update, { fullPath, relativePath })
                        continue
                    }

                    if (event.type === "create") {
                        if (this.nodeMap.has(fullPath)) {
                            // 如果已经存在，说明是覆盖或者快速重建，按 update 处理
                            log("<FsTree|watch|fileChanged|createAsUpdate>", relativePath)
                            const node = this.nodeMap.get(fullPath)
                            if (node) {
                                const stats = await this._safeStat(fullPath)
                                if (stats) {
                                    node.changeCache(stats.mtimeMs)
                                }
                            }
                            this.fsEvent.emit(FsEvents.update, { fullPath, relativePath })
                            continue
                        }

                        console.log("<FsTree|_watch> file added:", relativePath)
                        this.fsEvent.emit(FsEvents.add, { fullPath, relativePath })
                        continue
                    }

                    if (event.type === "delete") {
                        const directNode = this.nodeMap.has(fullPath)
                        let isDir = false

                        if (directNode) {
                            this.nodeMap.delete(fullPath)
                        } else {
                            // 检查是否有以该路径开头的缓存节点，如果有，说明这是一个被删除的目录
                            const dirPrefix = fullPath + path.sep
                            for (const key of this.nodeMap.keys()) {
                                if (key.startsWith(dirPrefix)) {
                                    isDir = true
                                    this.nodeMap.delete(key)
                                }
                            }
                        }

                        if (isDir) {
                            console.log("<FsTree|_watch> dir delete:", relativePath)
                            this.fsEvent.emit(FsEvents.deleteDir, { fullPath, relativePath })
                        } else {
                            console.log("<FsTree|_watch> file delete:", relativePath)
                            this.fsEvent.emit(FsEvents.delete, { fullPath, relativePath })
                        }
                    }
                }
            },
            { ignore: ignorePatterns },
        )
    }

    /**
     * 合并默认忽略规则与用户忽略规则
     */
    private _buildIgnoreMatcher(): {
        ignorePatterns: string[]
        ignoreMatcher: (path: string) => boolean
    } {
        // 默认忽略 node_modules, dist, out, .starmap，以及 . 开头的目录/文件
        const defaultIgnorePatterns = [
            "**/node_modules/**",
            "**/dist/**",
            "**/out/**",
            "**/.starmap/**",
            "**/.*",
            "**/.*/**",
        ]

        const ignoreNames = new Set(["node_modules", "dist", "out", ".starmap"])
        const defaultIgnoreMatcher = (inputPath: string) => {
            const normalizedPath = inputPath.split(path.sep).join("/")
            const parts = normalizedPath.split("/").filter(Boolean)
            for (const part of parts) {
                if (ignoreNames.has(part)) return true
                if (part.startsWith(".")) return true
            }
            return false
        }

        const userIgnore = this.options.ignored
        const extraPatterns: string[] = []
        const extraMatchers: Array<(path: string) => boolean> = []

        if (userIgnore) {
            if (Array.isArray(userIgnore)) {
                for (const item of userIgnore) {
                    if (typeof item === "string") extraPatterns.push(item)
                    else extraMatchers.push(item)
                }
            } else if (typeof userIgnore === "string") {
                extraPatterns.push(userIgnore)
            } else {
                extraMatchers.push(userIgnore)
            }
        }

        return {
            ignorePatterns: [...defaultIgnorePatterns, ...extraPatterns],
            ignoreMatcher: (inputPath: string) =>
                defaultIgnoreMatcher(inputPath) || extraMatchers.some((matcher) => matcher(inputPath)),
        }
    }

    /** 安全读取文件信息，读取失败时返回 null */
    private async _safeStat(filePath: string): Promise<Stats | null> {
        try {
            return await fs.stat(filePath)
        } catch {
            return null
        }
    }
}

export const [FsEvents, FsEventDefine] = defineEvents({
    update: <{ fullPath: string; relativePath: string }>{},
    add: <{ fullPath: string; relativePath: string }>{},
    delete: <{ fullPath: string; relativePath: string }>{},
    deleteDir: <{ fullPath: string; relativePath: string }>{},
})
