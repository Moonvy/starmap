import { createUnitTree } from "../createUnitTree"
import { CodeUnit } from "../../CodeUnit"

describe("createUnitTree 单元测试", () => {
    test("应该能够将 root 节点列表中 ID 为 starmap-project-root 的节点置顶", () => {
        // 模拟三个 CodeUnit 实例，其中一个 ID 为 starmap-project-root，且都无父级（为根节点）
        const mockUnit1 = {
            id: "unit-a",
            dirPath: "packages/a",
            children: [],
            parent: null,
            toJSON() { return this },
        } as unknown as CodeUnit

        const mockUnit2 = {
            id: "starmap-project-root",
            dirPath: ".",
            children: [],
            parent: null,
            toJSON() { return this },
        } as unknown as CodeUnit

        const mockUnit3 = {
            id: "unit-b",
            dirPath: "packages/b",
            children: [],
            parent: null,
            toJSON() { return this },
        } as unknown as CodeUnit

        const flatUnits = [mockUnit1, mockUnit2, mockUnit3]

        const roots = createUnitTree(flatUnits)

        // 验证 starmap-project-root 节点是否成功排在第一位
        expect(roots[0].id).toBe("starmap-project-root")
    })
})
