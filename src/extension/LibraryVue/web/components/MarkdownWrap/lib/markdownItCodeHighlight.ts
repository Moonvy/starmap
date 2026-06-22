import { codeToHtml, ShikiTransformer } from "shiki"

import { transformerNotationDiff } from "@shikijs/transformers"

/**
 * 渲染 Markdown 代码块高亮
 *
 * 返回 Shiki 的原始 `<pre class="shiki...">` 输出，以 `<pre` 开头
 * 这样 markdown-it-async 的 replaceAsync 不会再套益一层 `<pre><code>`
 *
 * 包裹逻辑（StarmapCodeWrap）全部由 renderMarkdown.ts 的 fence 规则处理
 *
 * @param str 代码内容
 * @param lang 语言
 * @param attrs 代码块 info 字符串（如 `ts {1,3-5} line-numbers=2`）
 */
export async function markdownCodeHighlight(str: string, lang: string, attrs: string) {
    if (!lang) lang = "javascript"

    let rawLang = lang
    // 当语言是 vue 时，自动探测是 SFC 还是 vue-html (纯 template)
    if (lang === "vue") {
        if (!isVueSFC(str)) {
            lang = "vue-html"
        }
    }

    // 解析 attrs info 字符串，提取高亮行、行号设置
    const highlightLines = parseHighlightLines(attrs)
    const lineNumbersResult = parseLineNumbers(attrs)

    const html = await codeToHtml(str, {
        lang,
        themes: {
            light: "github-light",
            dark: "one-dark-pro",
        },
        includeExplanation: "scopeName",
        transformers: [
            {
                pre(node: any) {
                    let displayLang = rawLang
                    if (rawLang === "javascript") {
                        displayLang = "js"
                    }
                    if (rawLang === "typescript") {
                        displayLang = "ts"
                    }

                    node.properties["data-language"] = displayLang

                    // 标记是否开启行号显示
                    if (lineNumbersResult !== false) {
                        node.properties["class"] = (node.properties["class"] ?? "") + " has-line-numbers"
                        // 行号起始值，通过 CSS counter-reset 控制
                        const startLine = lineNumbersResult === true ? 1 : lineNumbersResult
                        node.properties["style"] = `counter-reset: line-number ${startLine - 1};`
                    }
                },
            },
            // 行高亮 transformer：给指定行加上 highlighted class
            createLineHighlightTransformer(highlightLines),
            transformerSyntaxClasses,
            transformerNotationDiff({
                matchAlgorithm: "v3",
            }),
        ],
    })

    // 直接返回 shiki 的 <pre class="shiki..."> 输出
    // 以 <pre 开头，确保 markdown-it-async 的 replaceAsync 直接使用而不会再套益
    return html
}

/**
 * 解析 info 字符串中的行高亮规则
 * 支持 VitePress 格式：{1} {1,3} {1,3-5} {1,3,5-7}
 *
 * @param attrs info 字符串，如 `ts {1,3-5} line-numbers`
 * @returns 需要高亮的行号集合（1-based），若无规则则返回空 Set
 */
export function parseHighlightLines(attrs: string): Set<number> {
    const result = new Set<number>()
    if (!attrs) return result

    // 匹配花括号内的行号规则，如 {1,3-5}
    const match = attrs.match(/\{([^}]+)\}/)
    if (!match) return result

    const parts = match[1].split(",")
    for (const part of parts) {
        const trimmed = part.trim()
        // 匹配范围，如 3-5
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10)
            const end = parseInt(rangeMatch[2], 10)
            for (let i = start; i <= end; i++) {
                result.add(i)
            }
        }
        // 匹配单个行号
        else if (/^\d+$/.test(trimmed)) {
            result.add(parseInt(trimmed, 10))
        }
    }

    return result
}

/**
 * 解析 info 字符串中的行号显示规则
 * 支持：
 *   - `line-numbers`        开启行号，从 1 开始
 *   - `line-numbers=2`      开启行号，从 2 开始（:line-numbers=N 格式也支持）
 *
 * @param attrs info 字符串
 * @returns false 表示不显示行号；true 表示从 1 开始；number 表示自定义起始行号
 */
export function parseLineNumbers(attrs: string): false | true | number {
    if (!attrs) return false

    // 匹配 :line-numbers=N, @line-numbers=N 或 line-numbers=N 格式（带数字）
    const withNumberMatch = attrs.match(/[:@]?line-numbers=(\d+)/)
    if (withNumberMatch) {
        return parseInt(withNumberMatch[1], 10)
    }

    // 匹配 :line-numbers, @line-numbers 或 line-numbers（不带数字，不能是 line-numbersSOMETHING）
    if (/(?:^|\s)[:@]?line-numbers(?:\s|$)/.test(attrs)) {
        return true
    }

    return false
}

/**
 * 创建行高亮 transformer
 * 给需要高亮的行加上 `highlighted` CSS class
 *
 * @param lines 需要高亮的行号集合（1-based）
 */
function createLineHighlightTransformer(lines: Set<number>): ShikiTransformer {
    if (lines.size === 0) return {}

    return {
        name: "starmap:line-highlight",
        line(node: any, line: number) {
            // 给高亮行添加 highlighted class
            if (lines.has(line)) {
                this.addClassToHast(node, "highlighted")
            }
            // 若存在高亮行，给其余行加上 dim 效果
            else {
                this.addClassToHast(node, "dim")
            }
        },
    }
}

/**
 * 一个转换器，用于提取 VS Code 语法作用域并将其转换为 CSS 类名
 */
const transformerSyntaxClasses: ShikiTransformer = {
    span(node, line, col, lineElement, token) {
        // Shiki 提供 'explanation'，其中包含作用域层级
        if (token.explanation && token.explanation.length > 0) {
            // 取第一个（最相关的）
            const explanation = token.explanation[0]

            // 遍历作用域
            // 最后一个通常是最具体的
            const specificScope = explanation.scopes[explanation.scopes.length - 1].scopeName

            // 清理作用域名称以作为 CSS 类名 (例如 'keyword.control.ts' -> 'sk-keyword')
            const classBase = specificScope.split(".")[0] // 如 'keyword', 'string', 'variable'
            const classFull = specificScope.replace(/\./g, "-") // 如 'keyword-control-ts'

            this.addClassToHast(node, `sk-${classBase}`)
            this.addClassToHast(node, `sk-${classFull}`)
        }
    },
}

/**
 * 判断内容是否为 Vue 单文件组件 (SFC)
 * 如果包含 <template>、<script> 或 <style> 顶级标签，则认为是 SFC
 * @param code 代码内容
 */
function isVueSFC(code: string) {
    const sfcTags = /^\s*<(template|script|style)\b/m
    return sfcTags.test(code)
}
