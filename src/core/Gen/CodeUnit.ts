import { FsNode } from "../FsTree"
import { Gen } from "./Gen"

import path from "node:path"
import fs from "node:fs/promises"

import { normalizeID } from "./lib/normalizeID"
import { CodeUnitMetadata } from "./CodeUnit.type"
import { getStarmapDocPath } from "../../utils/getStarmapDocPath"

export class CodeUnit {
    // 代码单元 ID 根据代码文件夹路径生成
    id!: string
    /** 代码文件夹路径，相对项目路径 */
    dirPath!: string
    /** readme 文件对应的 FsNode 对象 */
    readmeFsNode!: FsNode
    /** 是否为内部文档 */
    isInternalDoc: boolean = false

    /** 代码单元目录下的 index.ts 文件节点（如果存在） */
    indexCodeFsNode?: FsNode
    /** 代码单元目录下的主组件文件节点（如果存在） */
    mainComponentFsNode?: FsNode
    /** readme 中通过 @import 引用的文件绝对路径 */
    readmeImportDependencyPaths: string[] = []

    /** readme 文件路径 */
    get readmePath() {
        return this.readmeFsNode.fileRelativePath
    }
    get readmeFullPath() {
        return this.readmeFsNode.fileFullPath
    }
    /** 代码单元目录绝对路径 */
    get dirFullPath() {
        return path.resolve(this.gen.starmapCore.config.rootPath!, this.dirPath)
    }
    /** 文件夹名称 */
    get dirName() {
        return path.basename(this.dirPath)
    }

    /** 代码单元元数据 */
    metadata: CodeUnitMetadata = {}

    /** 生成的输出目录 `.starmap/units/{id}` ，绝对路径 */
    get unitPath() {
        return path.join(this.gen.starmapCore.config.outputDir!, "units", this.id)
    }

    /** 子代码单元 */
    children?: CodeUnit[]
    /** 父代码单元 */
    parent?: CodeUnit | null

    gen!: Gen

    ready: Promise<void>
    constructor(readmeFsNode: FsNode, gen: Gen) {
        this.readmeFsNode = readmeFsNode
        this.gen = gen
        this.ready = this.init()
    }

    async init() {
        let dirPath = path.dirname(this.readmeFsNode.fileRelativePath)
        this.dirPath = dirPath

        let readmeData = await this.readmeFsNode.readMarkdown()

        // 读取 readme 头部的元数据 (front-matter)
        let headMetadata = await readmeData.metadata
        // 解析 readme 内容中的元数据（如 headTitle 等）
        let contentMetadata = resolveReadmeContentMetadata(readmeData.content)
        this.metadata = { ...contentMetadata, ...headMetadata }

        // 判断是否为内部文档
        const docPath = getStarmapDocPath()
        if (docPath && this.readmeFsNode.fileFullPath.startsWith(docPath)) {
            this.isInternalDoc = true
        }

        // 生成 ID
        let idBase = getIDFromDirPath(dirPath, this.gen.starmapCore.config.rootPath!)
        let id = this.metadata?.id ?? normalizeID(idBase)

        this.id = id

        // 解析 index.ts
        const indexTsPath = path.join(this.dirFullPath, "index.ts")
        try {
            await fs.access(indexTsPath)
            this.indexCodeFsNode = this.gen.starmapCore.fsTree.getOrCreateNode(indexTsPath)
        } catch {}

        // 解析主组件
        this.mainComponentFsNode = await this._resolveMainComponent()
    }

    /** 解析代码单元目录下的主组件文件节点
     *
     * 解析顺序：
     * 1. 若存在 index.ts 且其中有 `export { default } from "xxx.vue"`，则取该 xxx.vue
     * 2. 与文件夹同名的 vue 文件，如 button/button.vue
     * 3. index.vue
     */
    private async _resolveMainComponent(): Promise<FsNode | undefined> {
        const fsTree = this.gen.starmapCore.fsTree

        // 1. 从 index.ts 中查找 export { default } from "xxx.vue"
        if (this.indexCodeFsNode) {
            try {
                const text = await this.indexCodeFsNode.readText()
                const match = text.match(/export\s*\{[^}]*\bdefault\b[^}]*\}\s*from\s*["']([^"']+\.vue)["']/)
                if (match) {
                    const vuePath = path.resolve(this.dirFullPath, match[1])
                    await fs.access(vuePath)
                    return fsTree.getOrCreateNode(vuePath)
                }
            } catch {}
        }

        // 2. 与文件夹同名的 vue 文件
        const sameNameVuePath = path.join(this.dirFullPath, `${this.dirName}.vue`)
        try {
            await fs.access(sameNameVuePath)
            return fsTree.getOrCreateNode(sameNameVuePath)
        } catch {}

        // 3. index.vue
        const indexVuePath = path.join(this.dirFullPath, "index.vue")
        try {
            await fs.access(indexVuePath)
            return fsTree.getOrCreateNode(indexVuePath)
        } catch {}

        return undefined
    }

    toJSON() {
        const res: {
            id: string
            dirPath: string
            dirName: string
            readmePath: string
            metadata: CodeUnitMetadata
            parentId: string | null
            isInternalDoc?: boolean
        } = {
            id: this.id,
            dirPath: this.dirPath,
            dirName: this.dirName,
            readmePath: this.readmePath,
            metadata: this.metadata,
            parentId: this.parent?.id || null,
        }
        if (this.isInternalDoc) {
            res.isInternalDoc = true
        }
        return res
    }
}

/**
 * 获取文件 dirPath 路径最后 2 级作为 ID 的基础
 * 注意如果 dirPath 两级超过类 rootPath ，则需要截断
 * @param dirPath 代码单元目录路径（可能是相对或绝对路径）
 * @param rootPath 项目根路径
 */
function getIDFromDirPath(dirPath: string, rootPath: string): string {
    const normalizePath = (input: string) => input.replace(/\\/g, "/")
    const absoluteRoot = path.resolve(rootPath)
    const absoluteDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(absoluteRoot, dirPath)
    let relative = normalizePath(path.relative(absoluteRoot, absoluteDir))

    if (relative === "" || relative === ".") return "starmap-project-root"

    if (relative.startsWith("..")) {
        const absoluteParts = normalizePath(absoluteDir).split("/").filter(Boolean)
        return absoluteParts.length === 0 ? "starmap-project-root" : absoluteParts.slice(-2).join("/")
    }

    const parts = relative.split("/").filter(Boolean)
    if (parts.length === 0) return "starmap-project-root"
    if (parts.length <= 2) return parts.join("/")

    return parts.slice(-2).join("/")
}

/** 从 markdown 内容中解析元数据
 *
 *  - headTitle: 取 markdown 第一个一级标题作为 headTitle
 *  - headMainTitle: headTitle 用 `|` 分割，取第一个部分作为 headMainTitle
 *  - headSubTitle:  headTitle 用 `|` 分割，取剩下的部分作为 headSubTitle
 
 * @returns 解析出的元数据对象，可以包含 headTitle、description 和 front-matter 中的其他字段
 */
function resolveReadmeContentMetadata(markdownContent: string): Partial<CodeUnitMetadata> {
    let lines = markdownContent.replace(/^\uFEFF/, "").split(/\r?\n/)
    let inFence = false
    let prevTextLine = ""

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i]

        // 跳过 fenced code block，避免把代码中的 # 误判为标题
        if (/^\s*(```|~~~)/.test(rawLine)) {
            inFence = !inFence
            continue
        }
        if (inFence) continue

        // 解析 ATX 一级标题：# Title
        let atxMatch = rawLine.match(/^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/)
        if (atxMatch) {
            let headTitle = atxMatch[1].trim()
            if (headTitle) {
                return splitHeadTitle(headTitle)
            }
        }

        // 解析 Setext 一级标题：Title + ===
        if (/^\s{0,3}=+\s*$/.test(rawLine)) {
            let headTitle = prevTextLine.trim()
            if (headTitle) {
                return splitHeadTitle(headTitle)
            }
        }

        if (rawLine.trim()) {
            prevTextLine = rawLine
        }
    }

    return {}
}

/** 拆分标题文本，生成主标题和副标题 */
function splitHeadTitle(headTitle: string): Partial<CodeUnitMetadata> {
    let titleParts = headTitle
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)

    let headMainTitle = titleParts[0] ?? headTitle.trim()
    let headSubTitle = titleParts.length > 1 ? titleParts.slice(1).join(" | ") : undefined

    return {
        headTitle: headTitle.trim(),
        headMainTitle,
        headSubTitle,
    }
}
