/**
 * CSS 变量与注释解析工具库
 */

export interface CssVarEntry {
    /** 唯一标识符 */
    id: string
    /** 条目类型：变量、独立注释、选择器 */
    type: "var" | "comment" | "selector"
    /** 变量名称（当 type === 'var' 时有效，如 --c-action-bk） */
    name?: string
    /** 变量值（当 type === 'var' 时有效，如 rgb(67, 80, 109)） */
    value?: string
    /** 是否为颜色值 */
    isColor?: boolean
    /** 关联的注释文本（提取后的纯文本） */
    comment?: string
    /** 原始行内注释（如 /* 主要文字 *\/） */
    inlineComment?: string
    /** 所属选择器上下文（如 :root、.theme-dark） */
    selector?: string
    /** 原始文本 */
    raw: string
}

/** 常见标准命名颜色集合 */
const NAMED_COLORS = new Set([
    "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black",
    "blanchedalmond", "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
    "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue",
    "darkcyan", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki",
    "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon",
    "darkseagreen", "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
    "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue",
    "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite",
    "gold", "goldenrod", "gray", "green", "greenyellow", "grey", "honeydew", "hotpink",
    "indianred", "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen",
    "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow",
    "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen",
    "lightskyblue", "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow",
    "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue",
    "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen",
    "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose",
    "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
    "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
    "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple",
    "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen",
    "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey",
    "snow", "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "transparent",
    "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen",
    "currentcolor"
])

/**
 * 判断字符串是否为合法的 CSS 颜色值
 * @param val 待判断的属性值
 */
export function isColorValue(val: string): boolean {
    if (!val) return false
    const trimmed = val.trim().toLowerCase()

    // 16 进制颜色 (#fff, #ffffff, #ffffff80 等)
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
        return true
    }

    // 函数型颜色：rgb, rgba, hsl, hsla, hwb, lab, lch, oklab, oklch, color
    if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\([\s\S]*\)$/i.test(trimmed)) {
        return true
    }

    // 命名颜色
    if (NAMED_COLORS.has(trimmed)) {
        return true
    }

    return false
}

/**
 * 将任意颜色字符串转换为 6 位十六进制 (#RRGGBB) 格式以适配原生 <input type="color">
 * @param colorStr 颜色字符串
 */
export function colorToHex6(colorStr: string): string {
    if (!colorStr) return "#000000"
    const val = colorStr.trim()

    // 如果已经是 3 位或 6 位十六进制
    if (/^#([0-9a-f]{3})$/i.test(val)) {
        return (
            "#" +
            val[1] +
            val[1] +
            val[2] +
            val[2] +
            val[3] +
            val[3]
        ).toLowerCase()
    }
    if (/^#([0-9a-f]{6})/i.test(val)) {
        return val.slice(0, 7).toLowerCase()
    }

    // 匹配 rgb/rgba(r, g, b) 或 rgb/rgba(r g b)
    const rgbMatch = val.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
    if (rgbMatch) {
        const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)))
        const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)))
        const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)))
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toLowerCase()
    }

    return "#000000"
}

/**
 * 将十六进制颜色值 (#RRGGBB) 更新回原始颜色表示形式
 * 如果原始值是 rgb/rgba，则保持 rgb 格式，否则返回 hex
 * @param originalValue 原始颜色值
 * @param newHex 新的 16 进制颜色
 */
export function formatColorValue(originalValue: string, newHex: string): string {
    const trimmed = (originalValue || "").trim()

    // 如果原来是 rgb/rgba 格式，转换为 rgb/rgba
    if (/^rgba?\s*\(/i.test(trimmed)) {
        const r = parseInt(newHex.slice(1, 3), 16)
        const g = parseInt(newHex.slice(3, 5), 16)
        const b = parseInt(newHex.slice(5, 7), 16)

        // 检查原先是否含有 alpha 透明度通道
        const rgbaMatch = trimmed.match(/rgba\s*\(\s*\d+[,\s]+\d+[,\s]+\d+[\s,/]+([\d.]+%?)\s*\)/i)
        if (rgbaMatch) {
            const alpha = rgbaMatch[1]
            return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }

        return `rgb(${r}, ${g}, ${b})`
    }

    return newHex
}

/**
 * 解析 CSS 文件文本，提取出条目列表（注释、选择器、CSS 变量）
 * @param cssText CSS 文件内容
 */
export function parseCssVars(cssText: string): CssVarEntry[] {
    const entries: CssVarEntry[] = []
    if (!cssText) return entries

    const lines = cssText.split(/\r?\n/)
    let currentSelector = ""
    let currentPendingComment = ""
    let inMultiLineComment = false
    let multiLineCommentBuffer: string[] = []

    let indexCounter = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // 1. 处理多行注释跨行
        if (inMultiLineComment) {
            const endIdx = line.indexOf("*/")
            if (endIdx !== -1) {
                multiLineCommentBuffer.push(line.slice(0, endIdx))
                inMultiLineComment = false
                const commentText = multiLineCommentBuffer
                    .join("\n")
                    .replace(/^\/\*+/, "")
                    .replace(/\*+\/$/, "")
                    .trim()

                if (commentText) {
                    currentPendingComment = commentText
                    entries.push({
                        id: `comment_${indexCounter++}`,
                        type: "comment",
                        comment: commentText,
                        raw: `/* ${commentText} */`,
                    })
                }
                multiLineCommentBuffer = []
            } else {
                multiLineCommentBuffer.push(line)
            }
            continue
        }

        // 2. 检测整行/多行注释开始
        if (trimmed.startsWith("/*")) {
            if (trimmed.includes("*/")) {
                // 单行完整注释
                const commentContent = trimmed
                    .replace(/^\/\*+/, "")
                    .replace(/\*+\/$/, "")
                    .trim()

                if (commentContent) {
                    currentPendingComment = commentContent
                    entries.push({
                        id: `comment_${indexCounter++}`,
                        type: "comment",
                        comment: commentContent,
                        raw: trimmed,
                    })
                }
            } else {
                // 多行注释开始
                inMultiLineComment = true
                multiLineCommentBuffer.push(line)
            }
            continue
        }

        // 3. 检查选择器进入 (如 :root {, .theme-dark {)
        if (trimmed.includes("{") && !trimmed.startsWith("--")) {
            const selectorPart = trimmed.split("{")[0].trim()
            if (selectorPart) {
                currentSelector = selectorPart
                entries.push({
                    id: `selector_${indexCounter++}`,
                    type: "selector",
                    selector: selectorPart,
                    raw: line,
                })
            }
        }

        // 4. 检查选择器闭合 }
        if (trimmed === "}" || (trimmed.endsWith("}") && !trimmed.includes("{"))) {
            currentSelector = ""
            continue
        }

        // 5. 解析 CSS 变量声明: --variable-name: value; /* optional comment */
        const varMatch = line.match(/^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+)(?:;)?\s*(?:\/\*(.*?)\*\/)?\s*$/)
        if (varMatch) {
            const varName = varMatch[1].trim()
            const varValue = varMatch[2].trim()
            const inlineComment = varMatch[3] ? varMatch[3].trim() : undefined

            entries.push({
                id: `var_${varName}_${indexCounter++}`,
                type: "var",
                name: varName,
                value: varValue,
                isColor: isColorValue(varValue),
                comment: inlineComment || currentPendingComment || undefined,
                inlineComment,
                selector: currentSelector || undefined,
                raw: line,
            })
            // 消费掉 pending comment
            currentPendingComment = ""
            continue
        }

        // 如果是空行，重置 pending comment
        if (!trimmed) {
            currentPendingComment = ""
        }
    }

    return entries
}

/**
 * 在 CSS 文件内容中精准替换指定 CSS 变量的值，完全保留原文件的排版、注释和结构
 * @param cssContent 原始 CSS 文件字符串
 * @param varName 变量名称，如 --c-action-bk
 * @param newValue 新的变量值，如 rgb(67, 80, 109)
 * @returns 替换更新后的 CSS 内容
 */
export function updateCssVarInContent(cssContent: string, varName: string, newValue: string): string {
    if (!cssContent || !varName) return cssContent

    // 转义正则特殊字符
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // 正则匹配: (变量名\s*:\s*)(原值)(\s*(?:;|(?=\/\*)|$))
    const regex = new RegExp(`(${escapedVarName}\\s*:\\s*)([^;\\r\\n]+?)(\\s*(?:;|(?=\\/\\*)|$))`, "g")

    return cssContent.replace(regex, (match, prefix, oldValue, suffix) => {
        return `${prefix}${newValue}${suffix}`
    })
}
