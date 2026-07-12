import * as path from "node:path"
import * as fs from "node:fs/promises"
import * as crypto from "node:crypto"
import { substringJsBySymbol } from "./lib/substringJsBySymbol"

function getImportName(absolutePath: string) {
    const baseName = path.basename(absolutePath, path.extname(absolutePath))
    const pascalName = baseName
        .split(/[^a-zA-Z0-9]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")

    const hash = crypto.createHash("md5").update(absolutePath).digest("hex").slice(0, 8)
    let name = `${pascalName}${hash}`
    if (/^[0-9]/.test(name)) {
        name = `S${name}`
    }
    return name
}

/** 从导入参数中读取指定的参数值
 *
 * @param args 导入命令参数字符串
 * @param name 参数名，不包含 @
 */
function getImportArgValue(args: string, name: string): string {
    const match = args.match(new RegExp(`(?:^|\\s)@${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))`))
    return (match?.[1] || match?.[2] || match?.[3] || "").trim()
}

interface ResolvedImport {
    match: RegExpMatchArray
    resolvedContent: string
    imports: { name: string; path: string }[]
    dependencies: string[]
}

/**
 * 解析单条 @import 指令
 * @param match 正则匹配结果
 * @param filePath 当前 markdown 文件路径
 */
async function resolveOneImport(match: RegExpMatchArray, filePath: string | undefined): Promise<ResolvedImport> {
    const rawPath = match.groups!.path1 || match.groups!.path2
    const importPath = rawPath.slice(1, -1)
    const args = (match.groups!.args1 || match.groups!.args2 || "").trim()
    const imports: { name: string; path: string }[] = []
    const dependencies: string[] = []

    let resolvedContent = ""
    try {
        if (!filePath) {
            throw new Error("filePath is required to resolve relative import paths")
        }
        const dir = path.dirname(filePath)
        const absolutePath = path.resolve(dir, importPath)
        dependencies.push(absolutePath)

        let fileContent = await fs.readFile(absolutePath, "utf-8")
        let ext = path.extname(absolutePath).toLowerCase()
        let docSymbolName = getImportArgValue(args, "doc")
        let ignoreFirstLine = false
        if (!docSymbolName) {
            docSymbolName = getImportArgValue(args, "doc.notitle")
            if (docSymbolName) {
                ignoreFirstLine = true
            }
        }

        if (docSymbolName) {
            // 只有命中 @doc 时才加载 AST 文档解析逻辑，避免普通导入产生额外开销
            const { renderImportDoc } = await import("./markdownImportDoc")
            resolvedContent = renderImportDoc(fileContent, docSymbolName, {
                filePath: absolutePath,
                ignoreFirstLine,
            })
        } else if (ext === ".md") {
            // 递归解析 Markdown 片段（不加入 imports，内容直接内联）
            const subResult = await markdownImportResolve(fileContent, { filePath: absolutePath })
            resolvedContent = subResult.markdown
            if (subResult.imports) {
                // 与原先 unshift 行为一致：子级 import 排在前面
                imports.unshift(...subResult.imports)
            }
            if (subResult.dependencies) {
                // 子依赖在前，当前文件在后（与串行 unshift 顺序一致）
                dependencies.unshift(...subResult.dependencies)
            }
        } else {
            const extWithoutDot = ext.slice(1) || "text" // 去掉 .
            let finalArgs = args || ""

            // 处理 @only=symbolName 的情况
            if (/\B@only\b/.test(finalArgs) || /\b@only\b/.test(finalArgs)) {
                let symbolName = ""
                const onlyMatch = finalArgs.match(/@only\s*=\s*([^\s]+)/)
                if (onlyMatch) {
                    symbolName = onlyMatch[1]
                }
                if (symbolName) {
                    fileContent = substringJsBySymbol(fileContent, symbolName)
                }
            }

            if (/\B@file\b/.test(finalArgs) || /\b@file\b/.test(finalArgs)) {
                const baseName = path.basename(absolutePath)
                // If it's just @file without value, replace it
                if (finalArgs.match(/@file(?!\=)/)) {
                    finalArgs = finalArgs.replace(/@file(?!\=)/g, `@file="${baseName}"`)
                }
            }

            if (finalArgs.includes("@raw")) {
                const importName = getImportName(absolutePath)
                imports.push({
                    name: importName,
                    path: absolutePath,
                })
                resolvedContent = `<${importName} />`
            } else if (finalArgs.includes("@preview")) {
                const importName = getImportName(absolutePath)
                imports.push({
                    name: importName,
                    path: absolutePath,
                })
                finalArgs = `${finalArgs} @import-component="${importName}"`
                resolvedContent = `\`\`\`${extWithoutDot} ${finalArgs}\n${fileContent?.trim()}\n\`\`\``
            } else {
                // 普通代码块，不需要加入 imports
                resolvedContent = `\`\`\`${extWithoutDot} ${finalArgs}\n${fileContent?.trim()}\n\`\`\``
            }
        }
    } catch (error) {
        resolvedContent = `\n> [!WARNING] Import Error\n> \`@import ${importPath}\` failed: ${
            (error as Error).message
        }\n`
    }

    return { match, resolvedContent, imports, dependencies }
}

/**
 * Markdown 代码导入语法解析
 * 语法：
 * `@import args "path"`
 * `@import "path" args`
 * -  以 `@import` 的开头的行被视为导入指令
 * -  先找到路径参数，路径参数要么跟在 `@import` 后面，要么在行尾，这意味着可选的 `args` 可以路径前面或后面
 * -  `args` 是可选的，格式为空格分割的命令字符串`
 * - 根据 `path` 的文件后缀名来决定导入逻辑
 *    - `.md` 文件作为 Markdown 片段导入（递归解析）
 *    - `.vue` 作为代码块导入，并且默认带 `@preview` 参数
 *    - 其他后缀作为代码块导入
 *
 * @param markdown
 */
export async function markdownImportResolve(
    markdown: string,
    options: {
        /** 当前文件路径，用于解析相对路径 */
        filePath?: string
    },
): Promise<{ markdown: string; imports?: { name: string; path: string }[]; dependencies?: string[] }> {
    const importRegex =
        /^@import[^\S\n]+(?:(?<path1>["'][^"']+["'])(?:[^\S\n]+(?<args1>.*))?|(?:(?<args2>.*?)[^\S\n]+)?(?<path2>["'][^"']+["']))[^\S\n]*$/gm

    const matches = [...markdown.matchAll(importRegex)]
    if (matches.length === 0) {
        return { markdown, imports: [], dependencies: [] }
    }

    // 并行解析所有 import（读盘 / @doc AST），再按从后往前顺序替换，避免索引错位
    const resolvedList = await Promise.all(matches.map((match) => resolveOneImport(match, options.filePath)))

    let result = markdown
    const imports: { name: string; path: string }[] = []
    const dependencies: string[] = []

    for (let i = resolvedList.length - 1; i >= 0; i--) {
        const item = resolvedList[i]
        const match = item.match
        // 保持与原先 unshift 一致的依赖/import 顺序（后出现的 import 在前）
        imports.unshift(...item.imports)
        dependencies.unshift(...item.dependencies)
        result = result.substring(0, match.index!) + item.resolvedContent + result.substring(match.index! + match[0].length)
    }

    // 去重，防止同一文件多次 import 导致变量名冲突
    const uniqueImports = Array.from(new Map(imports.map((item) => [item.path, item])).values())
    const uniqueDependencies = Array.from(new Set(dependencies))

    return { markdown: result, imports: uniqueImports, dependencies: uniqueDependencies }
}

export const markdownCodeImportResolve = markdownImportResolve
