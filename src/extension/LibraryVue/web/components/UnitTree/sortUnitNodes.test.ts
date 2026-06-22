import type { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"
import { sortUnitNodes } from "./sortUnitNodes"

function createUnitNode(partial: Partial<CodeUnitJSON>): CodeUnitJSON {
    return {
        id: partial.id ?? "unit",
        dirName: partial.dirName ?? partial.id ?? "unit",
        dirPath: partial.dirPath ?? partial.id ?? "unit",
        readmePath: partial.readmePath ?? "readme.md",
        parentId: partial.parentId ?? null,
        metadata: {
            sort: 0,
            ...(partial.metadata ?? {}),
        },
        children: partial.children,
    }
}

describe("sortUnitNodes", () => {
    test("应该根据 metadata.sort 对同层节点重新排序", () => {
        const nodes = [
            createUnitNode({ id: "unit-b", metadata: { sort: 20 } }),
            createUnitNode({ id: "unit-a", metadata: { sort: 10 } }),
        ]

        const sortedNodes = sortUnitNodes(nodes)

        expect(sortedNodes.map((node) => node.id)).toEqual(["unit-a", "unit-b"])
        expect(nodes.map((node) => node.id)).toEqual(["unit-b", "unit-a"])
    })

    test("应该始终将项目根节点排在最前面", () => {
        const nodes = [
            createUnitNode({ id: "unit-b", metadata: { sort: -100 } }),
            createUnitNode({ id: "starmap-project-root", metadata: { sort: 999 } }),
            createUnitNode({ id: "unit-a", metadata: { sort: -200 } }),
        ]

        const sortedNodes = sortUnitNodes(nodes)

        expect(sortedNodes.map((node) => node.id)).toEqual(["starmap-project-root", "unit-a", "unit-b"])
    })
})