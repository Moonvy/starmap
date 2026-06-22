import path from "node:path"
import { CodeUnit } from "../CodeUnit"

/**
 * 把无结构的 CodeUnit 数组组织成树形结构（根据 dirPath 生成 __parent 和 __children）
 * @param flatUnits 扁平化的 CodeUnit 列表
 */
export function createUnitTree(flatUnits: CodeUnit[]): CodeUnit[] {
    const normalizePath = (input: string) => input.split(path.sep).join("/")
    const unitMap = new Map<string, CodeUnit>()

    for (const unit of flatUnits) {
        unit.children = []
        unit.parent = null
        unitMap.set(normalizePath(unit.dirPath), unit)
    }

    const roots: CodeUnit[] = []

    for (const unit of flatUnits) {
        const currentDir = normalizePath(unit.dirPath)
        let parentDir = path.posix.dirname(currentDir)
        let parent: CodeUnit | null = null

        while (parentDir && parentDir !== "." && parentDir !== "/") {
            const found = unitMap.get(parentDir)
            if (found) {
                parent = found
                break
            }
            const nextParent = path.posix.dirname(parentDir)
            if (nextParent === parentDir) break
            parentDir = nextParent
        }

        if (parent) {
            unit.parent = parent
            parent.children!.push(unit)
        } else {
            roots.push(unit)
        }
    }

    return roots
}
