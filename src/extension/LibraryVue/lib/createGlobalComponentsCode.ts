import { CodeUnit } from "../../../core/Gen/CodeUnit"
import path from "node:path"
import { findNearestPackageRoot, resolveUnitComponents } from "./resolveUnitComponents"
import type { GlobalComponentEntry } from "./resolveUnitComponents"

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
 * - unit 文件夹下如果有 sample 文件夹，sample 及其子目录下的 vue 组件都会注册为组件（组件名是 vue 文件名）
 *
 * @param units 所有 CodeUnit 列表
 * @param rootPath Starmap 扫描的项目根目录
 * @returns 拼接好的全局组件注册代码字符串，用于注入到 global-components.ts 模板中
 */
export async function createGlobalComponentsCode(units: CodeUnit[], rootPath?: string) {
    // 并行解析各 unit 组件（内部有缓存，全量生成时多数会命中 unit 阶段结果）
    const validUnits = units.filter(
        (unit) => typeof unit?.dirFullPath === "string" && typeof unit?.dirName === "string",
    )
    const perUnitEntries = await Promise.all(validUnits.map((unit) => resolveUnitComponents(unit)))
    const projectRoot = path.resolve(
        rootPath || units[0]?.gen?.starmapCore?.config?.rootPath || process.cwd(),
    )
    // Vue 应用中的全局组件名必须唯一；同名组件保留首次解析结果，避免重复注册警告
    const uniqueEntries = new Map<string, GlobalComponentEntry>()

    for (const entries of perUnitEntries) {
        for (const entry of entries) {
            // package.json 是包边界标记，包外组件不参与全局注册
            if (!findNearestPackageRoot(entry.importPath, projectRoot)) continue
            if (!uniqueEntries.has(entry.name)) {
                uniqueEntries.set(entry.name, entry)
            }
        }
    }

    return Array.from(uniqueEntries.values())
        .map(
            (entry) =>
                `    {\n        name: "${entry.name}",\n        component: () => import("${entry.importPath}"),\n    }`,
        )
        .join(",\n")
}
