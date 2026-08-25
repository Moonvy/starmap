import path from "node:path"
import { FsNode } from "./FsNode"
import { RawEvents, defineEvents } from "fzz"
import { subscribe } from "@parcel/watcher"
import { globSync } from "tinyglobby"
import fs from "node:fs/promises"
import fsSync from "node:fs"
import type { Stats } from "node:fs"
import { log } from "fzz"

/** scanFiles 默认忽略的目录（扫描阶段直接跳过，避免进入 node_modules 等大目录） */
const DEFAULT_SCAN_IGNORE = [
    "**/node_modules/**",
    "**/dist/**",
    "**/out/**",
    "**/.starmap/**",
    // Rust / Cargo 构建与依赖缓存（真实 monorepo 常把 cargo-home 放在 vendor 下，含大量 crate readme）
    "**/cargo-home/**",
    "**/target/**",
    "**/.cargo/**",
    "**/registry/src/**",
    "**/registry/cache/**",
    "**/index.crates.io*/**",
    // 点开头目录/文件（保留 .starmap-skip 由业务逻辑处理，不在此扫描）
    "**/.*",
    "**/.*/**",
]

/** 路径段级忽略名（相对 root 的二次过滤，与 glob ignore 互补） */
const IGNORE_PATH_SEGMENTS = new Set([
    "node_modules",
    "dist",
    "out",
    ".starmap",
    "cargo-home",
    "target",
    ".cargo",
])

export interface IFsTreeOptions {
    watch?: boolean
    /** 项目根路径（） */
    rootPath?: string
    /** ignored 规则，支持 glob 或函数 */
    ignored?: string | string[] | ((path: string) => boolean)
    /** 扫描结果磁盘缓存文件路径（可选）：跨进程复用扫描结果，避免每次启动都全量 glob 扫描 */
    scanCacheFile?: string
}

/** 扫描结果磁盘缓存格式（scanFiles 结果的跨进程持久化） */
interface IScanDiskCache {
    /** 缓存格式版本，扫描逻辑 / ignore 规则变化时递增 */
    v: number
    /** 绑定的根路径（绝对路径） */
    rootPath: string
    /** 绑定的 pattern 列表 */
    patterns: string[]
    /** 绑定的 ignore 列表 */
    ignore: string[]
    /** 匹配到的文件（相对 rootPath，/ 分隔）与 mtime */
    entries: { rel: string; mtime: number }[]
    /** 所有匹配文件所在目录 + root 本身（相对 rootPath，/ 分隔）与 mtime */
    dirs: { rel: string; mtime: number }[]
}

/**
 * 监视的文件系统树，用于监视文件和目录的变化，并提供带内存缓存的访问文件内容的接口
 *
 */
export class FsTree {
    /** 扫描结果磁盘缓存版本号（扫描逻辑 / ignore 规则变化时递增） */
    private static readonly SCAN_CACHE_VERSION = 1
    /** 文件系统事件
     *  事件名是 fileRelativePath ，根据 fileRelativePath 就可以监听一个文件的变化，再通过
     *  事件数据获取事件类型
     */
    fsEvent = new RawEvents<typeof FsEventDefine>()
    /** 文件节点映射表，key 为文件绝对路径 */
    private nodeMap: Map<string, FsNode> = new Map()
    /** 扫描结果缓存：pattern 集合 → 匹配的 FsNode 列表（仅 watch 模式启用，由 watcher 的增删事件失效） */
    private scanCache = new Map<string, FsNode[]>()
    /** 扫描结果磁盘缓存路径（跨进程复用，避免每次启动都全量 glob） */
    private scanCacheFilePath?: string
    /** 选项 */
    options: IFsTreeOptions
    constructor(
        /** 项目根路径 */
        rootPath: string,
        /** 选项 */
        options?: IFsTreeOptions,
    ) {
        this.options = Object.assign({ rootPath }, options)
        this.scanCacheFilePath = this.options.scanCacheFile
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
        const rootPath = this.options.rootPath!
        // watch 模式下复用扫描结果：由 watcher 的 新增/删除 事件失效，避免每次全量生成都重扫整棵目录树
        // （update 事件不影响扫描结果，无需失效）
        if (this.options.watch) {
            const cacheKey = patterns.join("\u0000")
            const cached = this.scanCache.get(cacheKey)
            if (cached) return cached
        }
        // 磁盘缓存（跨进程复用）：目录与文件 mtime 全部一致则直接复用，避免冷启动全量 glob
        if (this.scanCacheFilePath) {
            const cachedNodes = this._loadScanDiskCache(patterns, rootPath)
            if (cachedNodes) {
                // 同时填充内存缓存，避免 watch 模式下后续全量重生成重复做磁盘校验
                if (this.options.watch) {
                    this.scanCache.set(patterns.join("\u0000"), cachedNodes)
                }
                return cachedNodes
            }
        }
        // 使用 tinyglobby：扫描时就 ignore 大目录，避免先扫全树再过滤（Bun.Glob 不支持 ignore，会慢一个数量级）
        const matchedFiles = globSync(patterns, {
            cwd: rootPath,
            absolute: true,
            onlyFiles: true,
            ignore: DEFAULT_SCAN_IGNORE,
        })

        // 二次过滤：只根据「相对 rootPath」的路径段判断，避免 root 目录名本身叫 dist 时误杀
        const shouldIgnoreRelativePath = (relativePath: string) => {
            const parts = relativePath.split(/[/\\]/).filter(Boolean)
            for (const part of parts) {
                if (IGNORE_PATH_SEGMENTS.has(part)) return true
                // crates.io registry 源码目录名形如 index.crates.io-xxxxx
                if (part.startsWith("index.crates.io")) return true
                if (part.startsWith(".")) return true
            }
            // registry/src 与 registry/cache 整段跳过
            if (parts.includes("registry") && (parts.includes("src") || parts.includes("cache"))) return true
            return false
        }

        const nodes = matchedFiles
            .map((filePath) => path.resolve(rootPath, filePath))
            .filter((fullPath) => {
                const relativePath = path.relative(rootPath, fullPath)
                return relativePath !== "" && !relativePath.startsWith("..") && !shouldIgnoreRelativePath(relativePath)
            })
            .map((fullPath) => this.getOrCreateNode(fullPath))

        // 写入磁盘缓存（失败不影响主流程）
        if (this.scanCacheFilePath) {
            this._saveScanDiskCache(patterns, nodes)
        }
        // watch 模式下缓存扫描结果
        if (this.options.watch) {
            this.scanCache.set(patterns.join("\u0000"), nodes)
        }
        return nodes
    }

    // ----------------------------
    // 扫描结果磁盘缓存（跨进程复用）
    // ----------------------------

    /**
     * 从磁盘缓存恢复扫描结果
     *
     * 校验策略（全部一致才算命中）：
     * - 根路径 / pattern / ignore 绑定一致
     * - 所有缓存目录的 mtime 一致（新增/删除文件会使所在目录 mtime 变化，任何新目录的创建都会
     *   最终反映在某个已缓存目录或 root 的 mtime 上）
     * - 所有缓存文件的 mtime 一致（内容更新会使文件 mtime 变化）
     *
     * @param patterns 扫描 pattern 列表
     * @param rootPath 项目根路径
     * @returns 命中时返回 FsNode 列表，否则 null
     */
    private _loadScanDiskCache(patterns: string[], rootPath: string): FsNode[] | null {
        try {
            const raw = fsSync.readFileSync(this.scanCacheFilePath!, "utf-8")
            const cache = JSON.parse(raw) as IScanDiskCache

            if (cache.v !== FsTree.SCAN_CACHE_VERSION) return null
            if (path.resolve(cache.rootPath) !== path.resolve(rootPath)) return null
            if (JSON.stringify(cache.patterns) !== JSON.stringify(patterns)) return null
            if (JSON.stringify(cache.ignore) !== JSON.stringify(DEFAULT_SCAN_IGNORE)) return null

            // 校验目录 mtime（新增/删除会使目录 mtime 变化）
            for (const dir of cache.dirs) {
                const stat = this._safeStatSync(path.join(rootPath, dir.rel.split("/").join(path.sep)))
                if (!stat || !stat.isDirectory() || stat.mtimeMs !== dir.mtime) return null
            }
            // 校验文件 mtime（内容更新会使文件 mtime 变化）
            for (const entry of cache.entries) {
                const stat = this._safeStatSync(path.join(rootPath, entry.rel.split("/").join(path.sep)))
                if (!stat || !stat.isFile() || stat.mtimeMs !== entry.mtime) return null
            }

            return cache.entries.map((entry) =>
                this.getOrCreateNode(path.join(rootPath, entry.rel.split("/").join(path.sep))),
            )
        } catch {
            return null
        }
    }

    /** 把扫描结果写入磁盘缓存（写入失败静默，不影响主流程）
     * @param patterns 扫描 pattern 列表
     * @param nodes 扫描到的 FsNode 列表
     */
    private _saveScanDiskCache(patterns: string[], nodes: FsNode[]) {
        try {
            const rootPath = this.options.rootPath!
            const toPosix = (input: string) => input.split(path.sep).join("/")

            const dirSet = new Set<string>(["."])
            const entries = nodes.map((node) => {
                const rel = toPosix(path.relative(rootPath, node.fileFullPath))
                dirSet.add(toPosix(path.dirname(node.fileFullPath)))
                const stat = this._safeStatSync(node.fileFullPath)
                return { rel, mtime: stat?.mtimeMs ?? 0 }
            })

            const dirs = Array.from(dirSet).map((dirFullPath) => {
                const rel = toPosix(path.relative(rootPath, dirFullPath)) || "."
                const stat = this._safeStatSync(dirFullPath)
                return { rel, mtime: stat?.mtimeMs ?? 0 }
            })

            const cache: IScanDiskCache = {
                v: FsTree.SCAN_CACHE_VERSION,
                rootPath: path.resolve(rootPath),
                patterns,
                ignore: [...DEFAULT_SCAN_IGNORE],
                entries,
                dirs,
            }

            fsSync.mkdirSync(path.dirname(this.scanCacheFilePath!), { recursive: true })
            fsSync.writeFileSync(this.scanCacheFilePath!, JSON.stringify(cache))
        } catch {
            // 写入失败静默
        }
    }

    /** 安全读取文件信息（同步），读取失败时返回 null */
    private _safeStatSync(filePath: string): Stats | null {
        try {
            return fsSync.statSync(filePath)
        } catch {
            return null
        }
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

                // 过滤被忽略的事件
                const filteredEvents = events.filter((event) => !ignoreMatcher(event.path))
                if (filteredEvents.length === 0) return

                // 新增/删除属于目录结构变化，会使扫描缓存失效（update 不影响扫描结果）
                const hasStructuralChange = filteredEvents.some(
                    (event) => event.type === "create" || event.type === "delete",
                )
                if (hasStructuralChange) {
                    this.scanCache.clear()
                }

                // 分类事件：update（含 createAsUpdate）/ add / delete / deleteDir
                const updateItems: { fullPath: string; relativePath: string; node: FsNode | undefined; isCreate: boolean }[] =
                    []
                const addItems: { fullPath: string; relativePath: string }[] = []
                const deleteItems: { fullPath: string; relativePath: string }[] = []
                const deleteDirItems: { fullPath: string; relativePath: string }[] = []

                for (const event of filteredEvents) {
                    const fullPath = event.path
                    const relativePath = path.relative(rootPath, fullPath).split(path.sep).join("/")

                    if (event.type === "update") {
                        log("<FsTree|watch|fileChanged>", relativePath)
                        updateItems.push({ fullPath, relativePath, node: this.nodeMap.get(fullPath), isCreate: false })
                        continue
                    }

                    if (event.type === "create") {
                        const node = this.nodeMap.get(fullPath)
                        if (node) {
                            // 如果已经存在，说明是覆盖或者快速重建，按 update 处理
                            log("<FsTree|watch|fileChanged|createAsUpdate>", relativePath)
                            updateItems.push({ fullPath, relativePath, node, isCreate: true })
                        } else {
                            console.log("<FsTree|_watch> file added:", relativePath)
                            addItems.push({ fullPath, relativePath })
                        }
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
                            deleteDirItems.push({ fullPath, relativePath })
                        } else {
                            console.log("<FsTree|_watch> file delete:", relativePath)
                            deleteItems.push({ fullPath, relativePath })
                        }
                    }
                }

                // 批量 stat（并行）再统一失效缓存 + 发事件，避免大批次变更时逐个串行等待
                // 注意：即使 nodeMap 中尚无节点，也要通过 getOrCreateNode 拿到与 CodeUnit 共用的 FsNode 并失效缓存
                // （CodeUnit.readmeFsNode 与 nodeMap 共享同一实例，必须在此清掉，否则热更新会读到旧 readme）
                const stats = await Promise.all(updateItems.map((item) => this._safeStat(item.fullPath)))
                for (let i = 0; i < updateItems.length; i++) {
                    const item = updateItems[i]
                    const itemStats = stats[i]
                    const node = item.node ?? this.getOrCreateNode(item.fullPath)
                    // 信任 watcher：有变更事件就失效缓存（mtime 仅作参考；stat 失败也失效）
                    node.changeCache(itemStats?.mtimeMs ?? Date.now())
                    this.fsEvent.emit(FsEvents.update, { fullPath: item.fullPath, relativePath: item.relativePath })
                }
                for (const item of addItems) {
                    this.fsEvent.emit(FsEvents.add, item)
                }
                for (const item of deleteItems) {
                    this.fsEvent.emit(FsEvents.delete, item)
                }
                for (const item of deleteDirItems) {
                    this.fsEvent.emit(FsEvents.deleteDir, item)
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
        // 默认忽略 node_modules / 构建产物 / cargo 缓存，以及 VCS 等大体积点目录
        // 注意：不能用 **/.* 一刀切，否则 .starmap-skip（触发全量重新生成的功能）的事件会被原生层过滤掉
        const defaultIgnorePatterns = [
            "**/node_modules/**",
            "**/dist/**",
            "**/out/**",
            "**/.starmap/**",
            "**/cargo-home/**",
            "**/target/**",
            "**/.cargo/**",
            "**/registry/src/**",
            "**/registry/cache/**",
            "**/index.crates.io*/**",
            // VCS / 系统文件（其余点开头目录/文件由 defaultIgnoreMatcher 在 JS 层过滤）
            "**/.git/**",
            "**/.hg/**",
            "**/.svn/**",
            "**/.DS_Store",
        ]

        const ignoreNames = new Set(["node_modules", "dist", "out", ".starmap", "cargo-home", "target", ".cargo"])
        const defaultIgnoreMatcher = (inputPath: string) => {
            const normalizedPath = inputPath.split(path.sep).join("/")
            const parts = normalizedPath.split("/").filter(Boolean)
            for (const part of parts) {
                if (ignoreNames.has(part)) return true
                if (part.startsWith("index.crates.io")) return true
                if (part.startsWith(".") && part !== ".starmap-skip") return true
            }
            if (parts.includes("registry") && (parts.includes("src") || parts.includes("cache"))) return true
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
