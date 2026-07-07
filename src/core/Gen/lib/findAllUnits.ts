import { FsTree } from "../../FsTree"
import { CodeUnit } from "../CodeUnit"
import { Gen } from "../Gen"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * 判断一个绝对路径所在的目录或祖先目录中是否存在 .starmap-skip 文件
 */
async function isPathSkipped(
    fileFullPath: string,
    rootPath: string,
    skipCache: Map<string, boolean>
): Promise<boolean> {
    let currentDir = path.dirname(fileFullPath)
    const rootAbs = path.resolve(rootPath)

    while (true) {
        if (skipCache.has(currentDir)) {
            return skipCache.get(currentDir)!
        }

        const skipFilePath = path.join(currentDir, ".starmap-skip")
        try {
            const stat = await fs.stat(skipFilePath)
            if (stat.isFile()) {
                skipCache.set(currentDir, true)
                return true
            }
        } catch {
            // 文件不存在
        }

        if (path.resolve(currentDir) === rootAbs) {
            break
        }

        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) {
            break
        }
        currentDir = parentDir
    }

    skipCache.set(path.dirname(fileFullPath), false)
    return false
}

/**
 * 查找所有 CodeUnit 文件
 * @param fsTree 文件树
 */
export async function findAllUnits(fsTree: FsTree, gen: Gen): Promise<CodeUnit[]> {
    const readmeNodes = fsTree.scanFiles(["**/readme.md", "**/README.md"])
    const docNodes = gen.docFsTree ? gen.docFsTree.scanFiles(["**/readme.md"]) : []

    const skipCache = new Map<string, boolean>()
    const rootPath = fsTree.options.rootPath!

    const filteredReadmeNodes = []
    for (const node of readmeNodes) {
        if (!(await isPathSkipped(node.fileFullPath, rootPath, skipCache))) {
            filteredReadmeNodes.push(node)
        }
    }

    const filteredDocNodes = []
    const docRootPath = gen.docFsTree?.options.rootPath
    for (const node of docNodes) {
        if (docRootPath) {
            if (!(await isPathSkipped(node.fileFullPath, docRootPath, skipCache))) {
                filteredDocNodes.push(node)
            }
        } else {
            filteredDocNodes.push(node)
        }
    }

    const uniqueMap = new Map<string, (typeof readmeNodes)[number]>()
    for (const node of filteredReadmeNodes) {
        uniqueMap.set(node.fileRelativePath, node)
    }
    for (const node of filteredDocNodes) {
        uniqueMap.set(`@doc/${node.fileRelativePath}`, node)
    }

    return Promise.all(
        Array.from(uniqueMap.values()).map(async (readmeNode) => {
            const unit = new CodeUnit(readmeNode, gen)
            await unit.ready
            return unit
        }),
    )
}
