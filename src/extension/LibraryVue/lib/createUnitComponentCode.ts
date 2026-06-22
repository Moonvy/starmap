import { CodeUnit } from "../../../core/Gen/CodeUnit"
import { resolveUnitComponents } from "./resolveUnitComponents"

import { normalizeID } from "../../../core/Gen/lib/normalizeID"

/**
 * 解析一个 CodeUnit 涉及的组件
 * 生成 vue 代码片段，包括组件 import 和 components 定义
 *
 *
 * @param unit
 */
export async function createUnitComponentCode(unit: CodeUnit) {
    let unitComponents = await resolveUnitComponents(unit)

    const nameMap = new Map<string, number>()
    const getUniqueName = (name: string) => {
        let baseName = `vue_${normalizeID(name).replace(/-/g, "_")}`
        let uniqueName = baseName
        let count = nameMap.get(baseName) || 0
        if (count > 0) {
            uniqueName = `${baseName}_${count}`
        }
        nameMap.set(baseName, count + 1)
        return uniqueName
    }

    const mappedComponents = unitComponents.map((c) => ({
        ...c,
        safeName: getUniqueName(c.name),
    }))

    let importCode = mappedComponents
        .map((c) => `import ${c.safeName} from "${c.importPath.replace(/\\/g, "/")}"`)
        .join("\n")

    let componentsCode = mappedComponents.map((c) => `        "${c.name}": ${c.safeName},`).join("\n")

    return {
        importCode,
        componentsCode,
    }
}
