import type { ShikiTransformer } from "shiki/bundle/full"

/** CSS 及衍生语言集合 */
const CSS_LANGUAGES = new Set(["css", "scss", "sass", "less", "stylus", "postcss", "pcss"])

/**
 * 判断是否为 CSS 相关语言
 * @param lang 语言标识
 */
export function isCssLanguage(lang: string): boolean {
    if (!lang) return false
    return CSS_LANGUAGES.has(lang.toLowerCase())
}

/**
 * 匹配 CSS 颜色值的正则表达式
 * 1. Hex 颜色：#RGB, #RGBA, #RRGGBB, #RRGGBBAA（后不跟标识符字符）
 * 2. 颜色函数：rgb(), rgba(), hsl(), hsla(), hwb(), lab(), lch(), oklab(), oklch(), color(), color-mix()
 */
export const CSS_COLOR_REGEX =
    /(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b(?![_-])|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\((?:[^()]+|\([^()]*\))*\))/gi

/**
 * 递归获取 Hast 节点的文本内容
 * @param node Hast 节点
 */
function getNodeText(node: any): string {
    if (!node) return ""
    if (node.type === "text") return node.value || ""
    if (Array.isArray(node.children)) {
        return node.children.map(getNodeText).join("")
    }
    return ""
}

/**
 * 创建色块预览 DOM 节点 (Hast)
 * @param color 颜色值字符串
 */
function createColorPreviewNode(color: string) {
    return {
        type: "element",
        tagName: "span",
        properties: {
            class: "shiki-color-preview",
            "data-color": color,
            title: `点击复制颜色: ${color}`,
            role: "button",
            tabindex: "0",
            "aria-label": `复制颜色 ${color}`,
        },
        children: [
            {
                type: "element",
                tagName: "span",
                properties: {
                    class: "shiki-color-preview-box",
                    style: `background-color: ${color};`,
                },
                children: [],
            },
        ],
    }
}

/**
 * 创建 Shiki CSS 颜色预览 Transformer
 * 在 CSS 代码中的颜色值前插入圆角矩形色块预览
 */
export function createColorPreviewTransformer(): ShikiTransformer {
    return {
        name: "starmap:color-preview",
        line(node: any) {
            const spans = node.children
            if (!spans || spans.length === 0) return

            const lineText = spans.map(getNodeText).join("")
            CSS_COLOR_REGEX.lastIndex = 0
            const matches = [...lineText.matchAll(CSS_COLOR_REGEX)]
            if (matches.length === 0) return

            let currentOffset = 0
            let matchIdx = 0

            /**
             * 深度优先遍历并根据颜色匹配位置插入预览节点
             * @param n 当前节点
             */
            function processNode(n: any): any[] {
                if (matchIdx >= matches.length) {
                    currentOffset += getNodeText(n).length
                    return [n]
                }

                const text = getNodeText(n)
                const nodeStart = currentOffset
                const nodeEnd = currentOffset + text.length

                // 检查下一个待匹配的颜色是否位于当前节点内
                if (matches[matchIdx].index >= nodeStart && matches[matchIdx].index < nodeEnd) {
                    if (n.type === "text") {
                        const res: any[] = []
                        let remainingText = text
                        let currentTextStart = nodeStart

                        while (
                            matchIdx < matches.length &&
                            matches[matchIdx].index >= currentTextStart &&
                            matches[matchIdx].index < nodeEnd
                        ) {
                            const match = matches[matchIdx]
                            const splitPoint = match.index - currentTextStart
                            const before = remainingText.slice(0, splitPoint)
                            if (before) {
                                res.push({ type: "text", value: before })
                            }
                            res.push(createColorPreviewNode(match[0]))
                            remainingText = remainingText.slice(splitPoint)
                            currentTextStart = match.index
                            matchIdx++
                        }

                        if (remainingText) {
                            res.push({ type: "text", value: remainingText })
                        }

                        currentOffset = nodeEnd
                        return res
                    } else if (n.children) {
                        const newChildren: any[] = []
                        for (const child of n.children) {
                            newChildren.push(...processNode(child))
                        }
                        return [{ ...n, children: newChildren }]
                    }
                }

                currentOffset = nodeEnd
                return [n]
            }

            const finalChildren: any[] = []
            for (const child of spans) {
                finalChildren.push(...processNode(child))
            }
            node.children = finalChildren
        },
    }
}
