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

    let result = markdown
    const imports: { name: string; path: string }[] = []
    const dependencies: string[] = []

    // 从后往前替换，避免索引变化
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i]
        const rawPath = match.groups!.path1 || match.groups!.path2
        const importPath = rawPath.slice(1, -1)
        const args = (match.groups!.args1 || match.groups!.args2 || "").trim()

        let resolvedContent = ""
        try {
            if (!options.filePath) {
                throw new Error("filePath is required to resolve relative import paths")
            }
            const dir = path.dirname(options.filePath)
            const absolutePath = path.resolve(dir, importPath)
            dependencies.unshift(absolutePath)

            let fileContent = await fs.readFile(absolutePath, "utf-8")
            let ext = path.extname(absolutePath).toLowerCase()
            const docSymbolName = getImportArgValue(args, "doc")

            if (docSymbolName) {
                // 只有命中 @doc 时才加载 AST 文档解析逻辑，避免普通导入产生额外开销
                const { renderImportDoc } = await import("./markdownImportDoc")
                resolvedContent = renderImportDoc(fileContent, docSymbolName, { filePath: absolutePath })
            } else if (ext === ".md") {
                // 递归解析 Markdown 片段（不加入 imports，内容直接内联）
                const subResult = await markdownImportResolve(fileContent, { filePath: absolutePath })
                resolvedContent = subResult.markdown
                if (subResult.imports) {
                    imports.unshift(...subResult.imports)
                }
                if (subResult.dependencies) {
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
                    imports.unshift({
                        name: importName,
                        path: absolutePath,
                    })
                    resolvedContent = `<${importName} />`
                } else if (finalArgs.includes("@preview")) {
                    const importName = getImportName(absolutePath)
                    imports.unshift({
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

        // 替换原本的内容
        result = result.substring(0, match.index!) + resolvedContent + result.substring(match.index! + match[0].length)
    }

    // 去重，防止同一文件多次 import 导致变量名冲突
    const uniqueImports = Array.from(new Map(imports.map((item) => [item.path, item])).values())
    const uniqueDependencies = Array.from(new Set(dependencies))

    return { markdown: result, imports: uniqueImports, dependencies: uniqueDependencies }
}

export const markdownCodeImportResolve = markdownImportResolve
