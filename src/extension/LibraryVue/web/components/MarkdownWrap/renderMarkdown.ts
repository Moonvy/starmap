import MarkdownItAsync from "markdown-it-async"
import MarkdownItGitHubAlerts from "markdown-it-github-alerts"
import MarkdownItCjkFriendly from "markdown-it-cjk-friendly"

import anchor from "markdown-it-anchor"
import { dirname, resolve, isAbsolute } from "path"
import { markdownCodeHighlight } from "./lib/markdownItCodeHighlight"
import { markdownCodeImportResolve } from "./lib/markdownImportResolve"
import { markdownItImage } from "./lib/markdownItImage"
import type { CodeUnit } from "../../../../core/Gen/CodeUnit"

const anchorFunc = (anchor as any).default || anchor
const permalink = (anchorFunc as any).permalink || (anchor as any).permalink

const mdit = MarkdownItAsync({
    html: true,
    warnOnSyncRender: true,
    highlight: markdownCodeHighlight,
})

// 自定义标题 ID 解析规则
// 当检测到标题末尾有类似 {#custom-id} 的自定义锚点 ID 时，将其提取并应用为标题节点的 id 属性
// 并且在标题文本中擦除该部分，以便 markdown-it-anchor 直接使用该自定义 id
mdit.core.ruler.after("block", "custom_heading_id", (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "heading_open") {
            const inlineToken = tokens[i + 1]
            if (inlineToken && inlineToken.type === "inline") {
                const match = inlineToken.content.match(/\s*\{\#([^}]+)\}\s*$/)
                if (match) {
                    const customId = match[1]
                    tokens[i].attrSet("id", customId)
                    inlineToken.content = inlineToken.content.replace(/\s*\{\#([^}]+)\}\s*$/, "")
                }
            }
        }
    }
})

mdit.use(anchorFunc, {
    permalink: permalink.ariaHidden({
        symbol: "#",
        placement: "before",
        class: "header-anchor",
    }),
})
mdit.use(markdownItImage)
mdit.use(MarkdownItGitHubAlerts)
mdit.use(MarkdownItCjkFriendly)

// 保存原始渲染函数以备后用
const defaultFence = mdit.renderer.rules.fence!
mdit.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const args = token.info ? token.info.trim() : ""

    // 检测 @preview 参数
    const previewInfo = args.split(" ").find((str) => str.startsWith("@preview"))
    const isPreviewMode = !!previewInfo

    let previewModifer = ""
    if (previewInfo) {
        // 提取 . 分割的修饰符，例如 @preview.right -> ['right']
        const modifiers = previewInfo.split(".").slice(1)
        previewModifer = modifiers.join(" ")
    }

    let className = ""

    // 检测 @full 参数
    if (args.split(" ").includes("@full")) {
        className = "full"
    }

    // 检测 @min 参数
    if (args.split(" ").includes("@min")) {
        className += className ? " min" : "min"
    }

    // 检测 @title 参数
    const titleMatch = args.match(/@title=(?:"([^"]+)"|'([^']+)'|(\S+))/)
    let title = titleMatch ? titleMatch[1] || titleMatch[2] || titleMatch[3] : ""

    // 检测 @icon 参数
    const iconMatch = args.match(/@icon=(?:"([^"]+)"|'([^']+)'|(\S+))/)
    let icon = iconMatch ? iconMatch[1] || iconMatch[2] || iconMatch[3] : ""

    // 检测 @file 参数
    const fileMatch = args.match(/@file=(?:"([^"]+)"|'([^']+)'|(\S+))/)
    const file = fileMatch ? fileMatch[1] || fileMatch[2] || fileMatch[3] : ""

    if (file) {
        if (!title) title = file
        if (!icon) {
            const ext = file.split(".").pop()?.toLowerCase() || ""
            const iconMap: Record<string, string> = {
                vue: "ri:vuejs-fill",
                js: "ri:javascript-fill",
                mjs: "ri:javascript-fill",
                cjs: "ri:javascript-fill",
                ts: "ri:javascript-fill",
                jsx: "ri:reactjs-fill",
                tsx: "ri:reactjs-fill",
                json: "ri:braces-fill",
                md: "ri:markdown-fill",
                markdown: "ri:markdown-fill",
                html: "ri:html5-fill",
                css: "ri:css3-fill",
                svg: "ri:image-fill",
                png: "ri:image-fill",
                jpg: "ri:image-fill",
                jpeg: "ri:image-fill",
                gif: "ri:image-fill",
            }
            icon = iconMap[ext] || "ri:file-code-fill"
        }
    }

    const escapeHtmlAttr = (str: string) => str.replace(/"/g, "&quot;")
    let extraProps = ""
    if (title) extraProps += ` title="${escapeHtmlAttr(title)}"`
    if (icon) extraProps += ` icon="${escapeHtmlAttr(icon)}"`

    // defaultFence 内部调用 options.highlight（被 markdown-it-async 包裹的同步版本）
    // 此时 highlight 是异步的，返回占位符 <pre><!--::markdown-it-async::ID::--><code>...</code></pre>
    // replaceAsync 之后，占位符会被 shiki 的 <pre class="shiki..."> 就地替换
    // 关键：占位符以 <pre 开头，markdown-it 直接使用，不会再套 <pre><code>
    // 关键：shiki 返回的也以 <pre 开头，replaceAsync 也直接使用，不会再套
    // 所以在 <StarmapCodeWrap> 内部，占位符 → shiki <pre> 完全正确
    const raw = defaultFence(tokens, idx, options, env, self)

    if (isPreviewMode) {
        // 检查是否有 @import-component 标记（从文件导入的代码）
        // 有此标记时，preview slot 渲染为独立的 Vue 组件（支持 Vite HMR）
        // 否则将代码原文内联进 Vue 模板的具名 slot（原始行为）
        const importComponentMatch = args.match(/@import-component="([^"]+)"/)
        let previewContent = importComponentMatch ? `<${importComponentMatch[1]} />` : token.content

        const lang = args.split(" ")[0]
        if (!importComponentMatch && (lang === "md" || lang === "markdown")) {
            previewContent = mdit.render(token.content, env)
        }

        return `<StarmapCodeWrap mode="preview" modifer="${previewModifer}" class="${className}"${extraProps}><template v-slot:preview>${previewContent}</template>${raw}</StarmapCodeWrap>`
    }

    return `<StarmapCodeWrap class="${className}"${extraProps}>${raw}</StarmapCodeWrap>`
}

// code_block 是无语言标记的缩进代码块，不走 highlight 函数，需要手动包裹
const defaultCodeBlock = mdit.renderer.rules.code_block!
mdit.renderer.rules.code_block = (tokens, idx, options, env, self) => {
    const raw = defaultCodeBlock(tokens, idx, options, env, self)
    return `<StarmapCodeWrap>${raw}</StarmapCodeWrap>`
}

/**
 * 渲染 Markdown 到 HTML 代码
 * 处理：
 * 图片、视频资源会修改为绝对路径
 *
 * @param markdown Markdown 内容
 * @param options 配置选项
 * @returns 渲染后的 HTML
 */
export async function renderMarkdown(
    markdown: string,
    options?: {
        // markdown 文件路径，用于处理相对路径的图片等资源
        filePath?: string
        // 是否移除第一个 h1 标签
        removeFirstH1?: boolean
        // 所有代码单元，用于处理本地 markdown 链接的跳转
        codeUnits?: CodeUnit[]
    },
): Promise<{ html: string; imports?: { name: string; path: string }[]; dependencies?: string[] }> {
    // 代码导入解析 resolve
    let {
        markdown: resolvedMarkdown,
        imports,
        dependencies,
    } = await markdownCodeImportResolve(markdown, {
        filePath: options?.filePath,
    })

    let html = await mdit.renderAsync(resolvedMarkdown)

    // 移除首个 h1 标签
    if (options?.removeFirstH1) {
        html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\n?/i, "")
    }

    // 修复 <figure> 被包裹在 <p> 中导致的 HTML5 规范警告 (Vite/Vue hydration error)
    html = html.replace(/<p>\s*((?:<figure[^>]*>[\s\S]*?<\/figure>\s*)+)<\/p>/gi, "$1")

    // 处理 markdown 文件中的图片、视频等资源路径，转换为绝对路径
    if (options?.filePath) {
        html = resolveHtmlMediaPaths(html, options.filePath)

        // 处理本地 markdown 链接的重定向
        const codeUnits = options.codeUnits || (typeof window !== "undefined" ? (window as any).__starmap__?.unitsFlat : undefined)
        if (codeUnits && codeUnits.length > 0) {
            html = resolveHtmlLocalLinks(html, options.filePath, codeUnits)
        }
    }

    return { html, imports, dependencies }
}

/**
 * 处理 HTML 文本，将图片、视频资源转换为绝对路径
 */
export function resolveHtmlMediaPaths(html: string, filePath: string) {
    const dir = dirname(filePath)

    const resolvePath = (src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:") || isAbsolute(src)) {
            return src
        }
        return resolve(dir, src)
    }

    let resultHtml = html

    // 匹配 img, video, source 标签中的 src 属性
    resultHtml = resultHtml.replace(/<(img|video|source)[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, tag, src) => {
        const absPath = resolvePath(src)
        if (absPath === src) return match
        return match.replace(`src="${src}"`, `src="${absPath}"`).replace(`src='${src}'`, `src='${absPath}'`)
    })

    // 处理 img 的 srcset 属性
    resultHtml = resultHtml.replace(/<(img)[^>]+srcset=["']([^"']+)["'][^>]*>/gi, (match, tag, srcset) => {
        const parts = srcset.split(",").map((part: string) => {
            const [url, descriptor] = part.trim().split(/\s+/)
            if (!url) return part
            const absPath = resolvePath(url)
            return descriptor ? `${absPath} ${descriptor}` : absPath
        })
        const newSrcset = parts.join(", ")
        if (newSrcset === srcset) return match
        return match
            .replace(`srcset="${srcset}"`, `srcset="${newSrcset}"`)
            .replace(`srcset='${srcset}'`, `srcset='${newSrcset}'`)
    })

    // 处理 video 的 poster 属性
    resultHtml = resultHtml.replace(/<(video)[^>]+poster=["']([^"']+)["'][^>]*>/gi, (match, tag, poster) => {
        const absPath = resolvePath(poster)
        if (absPath === poster) return match
        return match
            .replace(`poster="${poster}"`, `poster="${absPath}"`)
            .replace(`poster='${poster}'`, `poster='${absPath}'`)
    })

    return resultHtml
}

/**
 * 处理 HTML 文本，将指向本地 markdown 文件的链接转换为 SPA 路由地址
 */
export function resolveHtmlLocalLinks(html: string, filePath: string, codeUnits: any[]): string {
    const dir = dirname(filePath)

    // 获取项目根目录，如果获取不到则使用 dir 作为退路
    const sampleUnit = codeUnits[0]
    const rootPath = sampleUnit?.gen?.starmapCore?.config?.rootPath || dir

    let resultHtml = html

    // 匹配 a 标签中的 href 属性
    resultHtml = resultHtml.replace(/<a([^>]+)href=["']([^"']+)["']([^>]*)>/gi, (match, before, href, after) => {
        // 如果是外部链接，或者纯锚点，则不处理
        if (
            href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            href.startsWith("#")
        ) {
            return match
        }

        // 解析出路径 and 可选的 hash 锚点
        const hashIndex = href.indexOf("#")
        const pathPart = hashIndex !== -1 ? href.slice(0, hashIndex) : href
        const hashPart = hashIndex !== -1 ? href.slice(hashIndex) : ""

        // 判断是否是 markdown 链接，例如扩展名是 .md 或 .markdown
        const ext = pathPart.split(".").pop()?.toLowerCase() || ""
        if (ext !== "md" && ext !== "markdown") {
            return match
        }

        // 尝试两种解析路径：
        // 1. 相对于当前 markdown 文件的目录
        const targetAbsPath1 = resolve(dir, pathPart)
        // 2. 相对于项目根目录（去除开头的 ./）
        const cleanPath = pathPart.startsWith("./") ? pathPart.slice(2) : pathPart
        const targetAbsPath2 = resolve(rootPath, cleanPath)

        // 在 codeUnits 列表中查找匹配的单元
        const matchedUnit = codeUnits.find((unit) => {
            if (!unit.readmeFullPath) return false
            const unitAbs = resolve(unit.readmeFullPath)
            return unitAbs === targetAbsPath1 || unitAbs === targetAbsPath2
        })

        if (matchedUnit) {
            // 转义为 vue-router hash 路由形式，例如：#/units/array#options
            const newHref = `#/units/${matchedUnit.id}${hashPart}`
            return `<a${before}href="${newHref}"${after}>`
        }

        return match
    })

    return resultHtml
}
