import { FsTree } from "../../FsTree"
import { CodeUnit } from "../CodeUnit"
import { Gen } from "../Gen"

/**
 * 查找所有 CodeUnit 文件
 * @param fsTree 文件树
 */
export async function findAllUnits(fsTree: FsTree, gen: Gen): Promise<CodeUnit[]> {
    const readmeNodes = fsTree.scanFiles(["**/readme.md", "**/README.md"])

    const docNodes = gen.docFsTree ? gen.docFsTree.scanFiles(["**/readme.md"]) : []

    const uniqueMap = new Map<string, (typeof readmeNodes)[number]>()
    for (const node of readmeNodes) {
        uniqueMap.set(node.fileRelativePath, node)
    }
    for (const node of docNodes) {
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
