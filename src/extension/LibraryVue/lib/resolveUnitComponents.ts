import { CodeUnit } from "../../../core/Gen/CodeUnit"
import { init, parse } from "es-module-lexer"
import path from "node:path"
import fs from "node:fs/promises"

/** 全局组件条目 */
export interface GlobalComponentEntry {
    /** 组件注册名 */
    name: string
    /** 组件的 import 绝对路径（指向项目源码中的 .vue 文件） */
    importPath: string
}

/**
 * 检查文件是否存在
 * @param filePath 文件绝对路径
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

/**
 * 解析单个 CodeUnit 下的全局组件
 *
 * 按三条规则检查：
 * 1. 与文件夹同名的 .vue 文件
 * 2. index.vue
 * 3. index.ts 导出的 .vue 文件
 *
 * @param unit CodeUnit 实例
 * @returns 解析出的全局组件条目列表
 */
export async function resolveUnitComponents(unit: CodeUnit): Promise<GlobalComponentEntry[]> {
    // 初始化 es-module-lexer（WASM），重复调用安全
    await init

    const dirFullPath = unit.dirFullPath
    const dirName = unit.dirName
    const entries: GlobalComponentEntry[] = []

    // 规则 1: 与文件夹同名的 .vue 文件（如 button/button.vue）
    // 组件名是文件名（不含扩展名）
    const sameNameVuePath = path.join(dirFullPath, `${dirName}.vue`)
    if (await fileExists(sameNameVuePath)) {
        entries.push({
            name: dirName,
            importPath: sameNameVuePath,
        })
    }

    // 规则 2: index.vue 作为全局组件，组件名是文件夹名字
    const indexVuePath = path.join(dirFullPath, "index.vue")
    if (await fileExists(indexVuePath)) {
        entries.push({
            name: dirName,
            importPath: indexVuePath,
        })
    }

    // 规则 3: index.ts 导出分析，每个 .vue 导出都作为全局组件
    const indexTsPath = path.join(dirFullPath, "index.ts")
    if (await fileExists(indexTsPath)) {
        const indexTsEntries = await resolveIndexTsExports(unit, indexTsPath)
        entries.push(...indexTsEntries)
    }

    return entries
}

/**
 * 分析 index.ts 中的导出，提取 .vue 文件的 re-export
 *
 * 通过 es-module-lexer 解析 index.ts 的 import 和 export 语句，
 * 找出导入了 .vue 文件的 import，然后在 export 中找到对应的导出名
 *
 * 支持的模式：
 * - `export { default as ButtonPrimary } from './ButtonPrimary.vue'`
 * - `import ButtonPrimary from './ButtonPrimary.vue'; export { ButtonPrimary }`
 *
 * @param unit CodeUnit 实例
 * @param indexTsPath index.ts 的绝对路径
 * @returns 解析出的全局组件条目列表
 */
async function resolveIndexTsExports(unit: CodeUnit, indexTsPath: string): Promise<GlobalComponentEntry[]> {
    const entries: GlobalComponentEntry[] = []

    try {
        const content = await fs.readFile(indexTsPath, "utf-8")
        const [imports, exports] = parse(content)

        // 收集所有导入了 .vue 文件的 import 语句的模块路径
        // 格式: { './ButtonPrimary.vue' => true }
        const vueImportPaths = new Set<string>()
        for (const imp of imports) {
            const specifier = imp.n
            if (specifier && specifier.endsWith(".vue")) {
                vueImportPaths.add(specifier)
            }
        }

        // 分析导出：对于每个 export，检查其源码来判断是否关联 .vue 文件
        for (const exp of exports) {
            const exportName = exp.n
            if (!exportName || exportName === "default") continue

            // 获取 export 语句的源码片段，检查是否包含 .vue 引用
            // 首先检查整段 export 语句中是否 re-export 了 .vue 文件
            const exportStatement = content.substring(exp.s, exp.e)

            // 方式 1: 检查是否是 re-export 语句（export ... from '*.vue'）
            // 通过检查 imports 中是否有对应的 .vue 文件来判断
            let isVueExport = false
            let vueFilePath: string | undefined

            // 检查 import 列表中是否有此 export 相关的 .vue 导入
            for (const imp of imports) {
                if (imp.n && imp.n.endsWith(".vue")) {
                    // 检查这个 import 语句的范围是否包含当前 export 的位置
                    // 或者它们在同一个 export..from 语句中
                    // es-module-lexer 对于 `export { x } from 'y'` 会同时出现在 imports 和 exports 中
                    if (imp.ss <= exp.s && imp.se >= exp.e) {
                        isVueExport = true
                        vueFilePath = imp.n
                        break
                    }
                    // 检查 re-export: import 和 export 位于同一语句
                    if (imp.ss === exp.s || (imp.ss <= exp.s + 10 && imp.se >= exp.e - 1)) {
                        isVueExport = true
                        vueFilePath = imp.n
                        break
                    }
                }
            }

            // 方式 2: 如果上面没有匹配，回退检查本地变量名是否对应某个 .vue import
            if (!isVueExport) {
                const localName = exp.ln || exportName
                // 在完整源码中搜索对应的 import 语句
                for (const imp of imports) {
                    if (imp.n && imp.n.endsWith(".vue")) {
                        // 获取 import 语句源码，检查是否包含该 localName
                        const importStmt = content.substring(imp.ss, imp.se)
                        if (importStmt.includes(localName)) {
                            isVueExport = true
                            vueFilePath = imp.n
                            break
                        }
                    }
                }
            }

            if (isVueExport && vueFilePath) {
                // 将 .vue 的相对路径解析为绝对路径（相对于 index.ts 所在目录）
                const absoluteVuePath = path.resolve(unit.dirFullPath, vueFilePath)
                entries.push({
                    name: exportName,
                    importPath: absoluteVuePath,
                })
            }
        }
    } catch {
        // index.ts 解析失败时静默跳过
    }

    return entries
}
