import { CodeUnit } from "../../../core/Gen/CodeUnit"
import { resolveUnitComponents } from "./resolveUnitComponents"

/**
 * 生成全局组件导入列表
 *
 * 全局组件规则：
 *
 * - unit 文件夹下与 unit 文件夹同名的 vue 组件
 *   如 `button/button.vue`，组件名是文件名字
 *
 * - unit 下如果有 index.vue，作为全局组件，组件名是文件夹名字
 *
 * - unit 下如果有 index.ts，分析它的导出（使用 es-module-lexer），每个 vue 文件的导出都作为一个全局组件
 *   组件名遵照导出文件的名字
 *
 *
 *
 * @param units 所有 CodeUnit 列表
 * @returns 拼接好的全局组件注册代码字符串，用于注入到 global-components.ts 模板中
 */
export async function createGlobalComponentsCode(units: CodeUnit[]) {
    // 并行解析各 unit 组件（内部有缓存，全量生成时多数会命中 unit 阶段结果）
    const perUnitEntries = await Promise.all(units.map((unit) => resolveUnitComponents(unit)))
    const allEntries: string[] = []

    for (const entries of perUnitEntries) {
        for (const entry of entries) {
            allEntries.push(
                `    {\n        name: "${entry.name}",\n        component: () => import("${entry.importPath}"),\n    }`,
            )
        }
    }

    return allEntries.join(",\n")
}
