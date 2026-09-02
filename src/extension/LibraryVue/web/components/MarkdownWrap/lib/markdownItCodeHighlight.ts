import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki/bundle/full"
import { createHash } from "node:crypto"

import { transformerNotationDiff } from "@shikijs/transformers"

import { createColorPreviewTransformer, isCssLanguage } from "./colorPreviewTransformer"

/** 相同代码块高亮结果缓存，跨 CodeUnit 复用，显著减少重复 shiki 开销 */
const highlightResultCache = new Map<string, string>()
/** 缓存上限，防止长时间 watch 下无限增长 */
const HIGHLIGHT_CACHE_MAX = 500

/** 首批预加载的高频语言（其余按需 loadLanguage，避免冷启动加载过重） */
const PRELOAD_LANGS = ["javascript", "typescript", "vue", "vue-html", "json", "html", "css", "bash", "markdown"] as const

const THEMES = ["github-light", "one-dark-pro"] as const

/** 进程内共享 Highlighter，避免 codeToHtml 每次走全局懒加载竞争 */
let highlighterPromise: Promise<Highlighter> | null = null
/** 并发生成时同一语言只 load 一次 */
const languageLoadPromises = new Map<string, Promise<void>>()

/**
 * 预热 / 获取共享 Shiki Highlighter
 * 全量生成开始时调用，降低首批 unit 的冷启动抖动
 */
export function ensureShikiHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: [...THEMES],
            langs: [...PRELOAD_LANGS],
        })
    }
    return highlighterPromise
}

/**
 * 确保 highlighter 已加载指定语言（并发安全）
 * @param highlighter Shiki Highlighter
 * @param lang 语言 id
 */
async function ensureLanguageLoaded(highlighter: Highlighter, lang: string): Promise<string> {
    const loaded = highlighter.getLoadedLanguages()
    if (loaded.includes(lang)) return lang

    let pending = languageLoadPromises.get(lang)
    if (!pending) {
        pending = highlighter
            .loadLanguage(lang as any)
            .then(() => undefined)
            .catch(async () => {
                // 未知语言回退 text
                if (!highlighter.getLoadedLanguages().includes("text")) {
                    await highlighter.loadLanguage("text")
                }
            })
        languageLoadPromises.set(lang, pending)
    }
    await pending

    if (highlighter.getLoadedLanguages().includes(lang)) return lang
    return "text"
}

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
    if (!lang) {
        lang = "javascript"
    } else {
        lang = lang.toLowerCase().split(/[,\s;]/)[0]
    }

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

    // 缓存键：语言 + 展示参数 + 内容哈希（避免超大字符串作 Map key）
    const cacheKey = buildHighlightCacheKey(str, lang, rawLang, attrs, highlightLines, lineNumbersResult)
    const cached = highlightResultCache.get(cacheKey)
    if (cached !== undefined) {
        return cached
    }

    const highlighter = await ensureShikiHighlighter()
    lang = await ensureLanguageLoaded(highlighter, lang)

    let html = ""
    try {
        html = highlighter.codeToHtml(str, {
            lang,
            themes: {
                light: "github-light",
                dark: "one-dark-pro",
            },
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
                transformerNotationDiff({
                    matchAlgorithm: "v3",
                }),
                ...(isCssLanguage(lang) || isCssLanguage(rawLang) ? [createColorPreviewTransformer()] : []),
            ],
        })
    } catch (err: any) {
        const codeLines = str.split("\n")
        const codeSnippet = codeLines.slice(0, 5).join("\n")
        const truncated = codeLines.length > 5 ? "\n..." : ""
        const highlightError = new Error(
            `Shiki 渲染代码块失败 (语言: "${lang}"): ${err.message}\n代码片段:\n${codeSnippet}${truncated}`,
        )
        highlightError.stack = err.stack
        throw highlightError
    }

    setHighlightCache(cacheKey, html)

    // 直接返回 shiki 的 <pre class="shiki..."> 输出
    // 以 <pre 开头，确保 markdown-it-async 的 replaceAsync 直接使用而不会再套益
    return html
}

/**
 * 生成高亮缓存键
 */
function buildHighlightCacheKey(
    str: string,
    lang: string,
    rawLang: string,
    attrs: string,
    highlightLines: Set<number>,
    lineNumbersResult: false | true | number,
): string {
    const contentHash = createHash("sha1").update(str).digest("hex").slice(0, 16)
    const linesKey = highlightLines.size > 0 ? [...highlightLines].sort((a, b) => a - b).join(",") : ""
    return `${lang}|${rawLang}|${attrs}|ln:${String(lineNumbersResult)}|hl:${linesKey}|${contentHash}`
}

/**
 * 写入高亮缓存，超出上限时淘汰最旧条目
 */
function setHighlightCache(key: string, html: string) {
    if (highlightResultCache.size >= HIGHLIGHT_CACHE_MAX) {
        const oldestKey = highlightResultCache.keys().next().value
        if (oldestKey !== undefined) {
            highlightResultCache.delete(oldestKey)
        }
    }
    highlightResultCache.set(key, html)
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
 * 判断内容是否为 Vue 单文件组件 (SFC)
 * 如果包含 <template>、<script> 或 <style> 顶级标签，则认为是 SFC
 * @param code 代码内容
 */
function isVueSFC(code: string) {
    const sfcTags = /^\s*<(template|script|style)\b/m
    return sfcTags.test(code)
}
