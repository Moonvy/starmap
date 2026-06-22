import type { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"

type UnitNode = CodeUnitJSON

const ROOT_UNIT_IDS = new Set(["starmap-project-root", "startmap-project-root"])

/**
 * 对同一层级的节点列表进行排序
 * @param nodes 待排序的节点列表
 */
export function sortUnitNodes(nodes: UnitNode[] | undefined): UnitNode[] {
    return [...(nodes ?? [])].sort(compareUnitNodes)
}

/**
 * 比较两个节点的显示顺序
 * @param a 节点 A
 * @param b 节点 B
 */
function compareUnitNodes(a: UnitNode, b: UnitNode): number {
    if (isRootUnit(a)) return -1
    if (isRootUnit(b)) return 1

    let sortIndexA = a.metadata.sort ?? 0
    let sortIndexB = b.metadata.sort ?? 0

    return sortIndexA - sortIndexB
}

/**
 * 判断是否为项目根节点
 * @param node 待判断节点
 */
function isRootUnit(node: UnitNode): boolean {
    return ROOT_UNIT_IDS.has(node.id)
}