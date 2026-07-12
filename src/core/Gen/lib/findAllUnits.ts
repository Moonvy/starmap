import { FsTree } from "../../FsTree"
import { CodeUnit } from "../CodeUnit"
import { Gen } from "../Gen"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * 判断一个绝对路径所在的目录或祖先目录中是否存在 .starmap-skip 文件
 *
 * skipCache 会缓存「该目录本身或其祖先是否导致跳过」：
 * - true：该目录在某个 skip 作用域内
 * - false：从该目录向上到 root 均无 .starmap-skip
 * 一次向上遍历会把途经的目录一并写入缓存，避免重复 stat
 */
async function isPathSkipped(
    fileFullPath: string,
    rootPath: string,
    skipCache: Map<string, boolean>
): Promise<boolean> {
    let currentDir = path.dirname(fileFullPath)
    const rootAbs = path.resolve(rootPath)
    /** 本次遍历中尚未命中缓存的目录（从文件侧向 root 方向） */
    const walked: string[] = []

    while (true) {
        if (skipCache.has(currentDir)) {
            const cached = skipCache.get(currentDir)!
            // 缓存命中：途经目录与该结果一致
            // - true：祖先有 skip，子孙都在 skip 作用域内
            // - false：该目录到 root 无 skip，且途经目录本次也未发现 skip 文件
            for (const dir of walked) {
                skipCache.set(dir, cached)
            }
            return cached
        }

        walked.push(currentDir)

        const skipFilePath = path.join(currentDir, ".starmap-skip")
        try {
            const stat = await fs.stat(skipFilePath)
            if (stat.isFile()) {
                for (const dir of walked) {
                    skipCache.set(dir, true)
                }
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

    for (const dir of walked) {
        skipCache.set(dir, false)
    }
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

    // 并行检查 skip，减少大量 readme 时的串行 IO 等待
    const readmeSkipFlags = await Promise.all(
        readmeNodes.map((node) => isPathSkipped(node.fileFullPath, rootPath, skipCache)),
    )
    const filteredReadmeNodes = readmeNodes.filter((_, i) => !readmeSkipFlags[i])

    const docRootPath = gen.docFsTree?.options.rootPath
    const filteredDocNodes = docRootPath
        ? (
              await Promise.all(
                  docNodes.map(async (node) =>
                      (await isPathSkipped(node.fileFullPath, docRootPath, skipCache)) ? null : node,
                  ),
              )
          ).filter((node): node is (typeof docNodes)[number] => node !== null)
        : docNodes

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
