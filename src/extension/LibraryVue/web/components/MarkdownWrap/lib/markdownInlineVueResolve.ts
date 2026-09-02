import * as path from "node:path"
import * as os from "node:os"
import * as crypto from "node:crypto"
import { outputFileWithCache } from "../../../../../../utils/fs/outputFileWithCache"

/**
 * 转换代码中的相对路径导入为绝对路径，并收集依赖
 * 涵盖 JS/TS 的静态 import、export from、动态 import()、require() 以及 CSS 的 @import、url()
 *
 * @param code 源代码字符串
 * @param baseDir 基准目录（通常为 Markdown 文件所在目录）
 * @param dependencies 收集依赖路径的数组
 */
export function resolveRelativePaths(code: string, baseDir: string, dependencies?: string[]): string {
    if (!baseDir) return code

    // 1. ES import / export from 语句中的相对路径
    // 例: import Foo from "./Foo.vue" 或 export { Bar } from '../Bar'
    code = code.replace(
        /(\b(?:import|export)\s+[\s\S]*?\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
        (match, prefix, relPath, suffix) => {
            const absPath = path.resolve(baseDir, relPath).replace(/\\/g, "/")
            if (dependencies && !dependencies.includes(absPath)) {
                dependencies.push(absPath)
            }
            return `${prefix}${absPath}${suffix}`
        },
    )

    // 2. 纯 import "./foo" 语句
    // 例: import "./style.css"
    code = code.replace(
        /(\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
        (match, prefix, relPath, suffix) => {
            const absPath = path.resolve(baseDir, relPath).replace(/\\/g, "/")
            if (dependencies && !dependencies.includes(absPath)) {
                dependencies.push(absPath)
            }
            return `${prefix}${absPath}${suffix}`
        },
    )

    // 3. 动态 import("./foo") 与 require("./foo")
    code = code.replace(
        /(\b(?:import|require)\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g,
        (match, prefix, relPath, suffix) => {
            const absPath = path.resolve(baseDir, relPath).replace(/\\/g, "/")
            if (dependencies && !dependencies.includes(absPath)) {
                dependencies.push(absPath)
            }
            return `${prefix}${absPath}${suffix}`
        },
    )

    // 4. CSS @import 中的相对路径
    // 例: @import "./foo.css"; 或 @import url("./foo.css");
    code = code.replace(
        /(@import\s+(?:url\()?\s*["'])(\.{1,2}\/[^"']+)(["']\s*\)?)/g,
        (match, prefix, relPath, suffix) => {
            const absPath = path.resolve(baseDir, relPath).replace(/\\/g, "/")
            if (dependencies && !dependencies.includes(absPath)) {
                dependencies.push(absPath)
            }
            return `${prefix}${absPath}${suffix}`
        },
    )

    // 5. CSS url(...) 中的相对路径（排除已由 @import 处理的）
    code = code.replace(
        /(\burl\(\s*["']?)(\.{1,2}\/[^"')]+)(["']?\s*\))/g,
        (match, prefix, relPath, suffix) => {
            const absPath = path.resolve(baseDir, relPath).replace(/\\/g, "/")
            if (dependencies && !dependencies.includes(absPath)) {
                dependencies.push(absPath)
            }
            return `${prefix}${absPath}${suffix}`
        },
    )

    return code
}

/**
 * 格式化提取的 Vue 代码为标准 SFC
 * 若代码未包含 <template> 标签，则自动包裹 <template>
 *
 * @param content 代码块内容
 * @param baseDir 基准目录
 * @param dependencies 收集依赖数组
 */
export function formatVueSfc(content: string, baseDir?: string, dependencies?: string[]): string {
    let processed = content.trim()
    if (baseDir) {
        processed = resolveRelativePaths(processed, baseDir, dependencies)
    }

    const hasTemplateTag = /^\s*<template\b/m.test(processed)
    const hasScriptTag = /^\s*<script\b/m.test(processed)
    const hasStyleTag = /^\s*<style\b/m.test(processed)

    // 如果没有任何 SFC 顶级标签，包裹为 template
    if (!hasTemplateTag && !hasScriptTag && !hasStyleTag) {
        return `<template>\n${processed}\n</template>\n`
    }

    return `${processed}\n`
}

/**
 * 解析 Markdown 中的内联 Vue @preview 代码块，
 * 自动将其提取为独立的 .vue 文件，并为代码块注入 @import-component 标记
 *
 * @param markdown Markdown 内容
 * @param options 配置选项，包含当前文件路径和目标输出目录
 */
export async function markdownInlineVueResolve(
    markdown: string,
    options: {
        /** 当前 Markdown 文件路径 */
        filePath?: string
        /** 单元输出目录，如 .starmap/units/{unitId} */
        outputDir?: string
    } = {},
): Promise<{
    markdown: string
    imports: { name: string; path: string }[]
    dependencies: string[]
}> {
    const baseDir = options.filePath ? path.dirname(options.filePath) : ""
    const targetDir =
        options.outputDir ||
        (baseDir ? path.join(baseDir, ".starmap-preview") : path.join(os.tmpdir(), "starmap-previews"))

    const imports: { name: string; path: string }[] = []
    const dependencies: string[] = []

    // 匹配 Markdown 代码块 ``` 或 ~~~
    const fenceRegex =
        /^(?<indent>[ \t]*)(?<fence>`{3,}|~{3,})[^\S\n]*(?<info>[^\n]*)\n(?<content>[\s\S]*?)\n\k<indent>\k<fence>[ \t]*$/gm

    let result = markdown
    const matches = [...markdown.matchAll(fenceRegex)]

    // 从后向前替换，避免索引错位
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i]
        const indent = match.groups!.indent || ""
        const fence = match.groups!.fence
        const info = match.groups!.info || ""
        const content = match.groups!.content

        // 如果已经通过 @import 注入了 @import-component，则跳过
        if (info.includes("@import-component=")) {
            continue
        }

        const tokens = info.trim().split(/\s+/)
        const lang = (tokens[0] || "").toLowerCase()
        const isPreviewMode = tokens.some((t) => t.startsWith("@preview"))

        if (!isPreviewMode) {
            continue
        }

        // 判断是否属于 Vue 预览（lang 为 vue/vue-html，或者内容包含 <template>/<script>/<style>）
        const isVueLang = lang === "vue" || lang === "vue-html"
        const isSfcContent = /^\s*<(template|script|style)\b/m.test(content)

        if (!isVueLang && !isSfcContent) {
            continue
        }

        // 生成唯一组件名
        const hashSeed = `${options.filePath || ""}:${i}:${content}`
        const hash = crypto.createHash("md5").update(hashSeed).digest("hex").slice(0, 8)
        const componentName = `InlinePreview_${hash}`
        const vueFilePath = path.join(targetDir, `${componentName}.vue`).replace(/\\/g, "/")

        // 生成 SFC 内容并写入文件
        const sfcContent = formatVueSfc(content, baseDir, dependencies)
        outputFileWithCache(vueFilePath, sfcContent)

        // 注册到 imports
        imports.push({
            name: componentName,
            path: vueFilePath,
        })
        dependencies.push(vueFilePath)

        // 将 @import-component 注入到代码块 info 中
        const newInfo = `${info.trim()} @import-component="${componentName}"`
        const replacement = `${indent}${fence}${newInfo}\n${content}\n${indent}${fence}`

        result = result.substring(0, match.index!) + replacement + result.substring(match.index! + match[0].length)
    }

    return {
        markdown: result,
        imports,
        dependencies,
    }
}
