import type MarkdownIt from "markdown-it"

/**
 * 解析图片文件名中的倍率标记（@1x, @2x, @3x）
 * 如果文件名没有倍率标记，默认为 2x
 *
 * @param src 图片路径
 * @returns 倍率数字（1, 2, 3）
 */
function parseImageScale(src: string): number {
    // 从路径中提取文件名部分（不含扩展名）
    const filename = src.split("/").pop() ?? src
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "")

    const scaleMatch = nameWithoutExt.match(/@([123])x$/i)
    if (scaleMatch) {
        return parseInt(scaleMatch[1], 10)
    }
    // 默认 2x
    return 2
}

/**
 * 解析 Obsidian 图片尺寸语法
 * 格式：`Alt|WIDTHxHEIGHT`，例如 `Alt|200x300`, `Alt|200x0`, `Alt|0x300`
 * WIDTH 或 HEIGHT 为 0 时表示按比例缩放
 *
 * @param alt 原始 alt 文本（可能包含尺寸语法）
 * @returns 解析后的 alt 文本和尺寸信息
 */
export function parseObsidianImageSize(alt: string): {
    alt: string
    width: number | undefined
    height: number | undefined
} {
    // 匹配 `|数字x数字` 格式
    const match = alt.match(/^(.*?)\|(\d+)x(\d+)$/)
    if (!match) {
        return { alt, width: undefined, height: undefined }
    }

    const cleanAlt = match[1].trim()
    const w = parseInt(match[2], 10)
    const h = parseInt(match[3], 10)

    return {
        alt: cleanAlt,
        // 0 表示不指定（按比例缩放），转为 undefined
        width: w > 0 ? w : undefined,
        height: h > 0 ? h : undefined,
    }
}

/**
 * markdown-it 图片渲染插件
 *
 * 功能：
 * 1. 使用 srcset 实现高清显示，图片默认为 2x，除非文件名包含 @1x/@2x/@3x 标记
 * 2. 兼容 Obsidian 图片尺寸语法：![Alt|200x300](path)
 * 3. 将图片包裹在 <figure> 中，alt 文本显示为 <figcaption>
 */
export function markdownItImage(md: MarkdownIt) {
    md.renderer.rules.image = (tokens, idx) => {
        const token = tokens[idx]

        const src = token.attrGet("src") ?? ""
        const rawAlt = token.children?.map((t) => t.content).join("") ?? token.attrGet("alt") ?? ""

        // 解析 Obsidian 尺寸语法，并过滤掉尺寸部分得到纯净的 alt
        const { alt, width, height } = parseObsidianImageSize(rawAlt)

        // 解析图片倍率
        const scale = parseImageScale(src)

        // 构建 img 标签属性
        const attrs: string[] = []
        attrs.push(`src="${escapeAttr(src)}"`)
        attrs.push(`alt="${escapeAttr(alt)}"`)

        // 设置 srcset（告知浏览器该图片的实际像素密度）
        if (scale > 1) {
            attrs.push(`srcset="${escapeAttr(src)} ${scale}x"`)
        }

        // 设置 Obsidian 指定的尺寸
        if (width !== undefined) {
            attrs.push(`width="${width}"`)
        }
        if (height !== undefined) {
            attrs.push(`height="${height}"`)
        }

        const imgTag = `<img ${attrs.join(" ")} />`

        // 包裹 <figure>，如果有 alt 则添加 <figcaption>
        if (alt) {
            return `<figure class="md-figure">${imgTag}<figcaption>${escapeHtml(alt)}</figcaption></figure>`
        }

        return `<figure class="md-figure">${imgTag}</figure>`
    }
}

/**
 * 转义 HTML 属性值中的特殊字符
 */
function escapeAttr(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * 转义 HTML 文本内容中的特殊字符
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}
