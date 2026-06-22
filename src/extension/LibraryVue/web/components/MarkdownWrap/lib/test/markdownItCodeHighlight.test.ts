import { describe, expect, test } from "vitest"
import { markdownCodeHighlight, parseHighlightLines, parseLineNumbers } from "../markdownItCodeHighlight"

describe("markdownCodeHighlight", () => {
    test("识别 Vue SFC", async () => {
        const code = `
<template>
  <div>Hello</div>
</template>
<script setup>
console.log('world')
</script>
`
        const html = await markdownCodeHighlight(code, "vue", "")
        // 检查渲染出的 HTML 是否包含 data-language="vue"
        expect(html).toContain('data-language="vue"')
    })

    test("识别 Vue Template Snippet (vue-html)", async () => {
        const code = `<div>仅包含 HTML 标记</div>`
        const html = await markdownCodeHighlight(code, "vue", "")
        // data-language 记录原始语言 rawLang="vue"，但 Shiki 内部使用 vue-html 高亮
        // 验证实际渲染出了 HTML 标签的语法高亮（而不仅是纯文本）
        expect(html).toContain('data-language="vue"')
        expect(html).toContain("<span") // 有语法高亮 span 说明 vue-html 生效
    })

    test("不影响其他语言", async () => {
        const code = `const a = 1`
        const html = await markdownCodeHighlight(code, "javascript", "")
        // displayLang 会把 javascript 简化为 js
        expect(html).toContain('data-language="js"')
    })
})

describe("parseHighlightLines", () => {
    test("无高亮规则时返回空集合", () => {
        expect(parseHighlightLines("ts line-numbers").size).toBe(0)
    })

    test("单行高亮 {1}", () => {
        const result = parseHighlightLines("ts {1}")
        expect(result.has(1)).toBe(true)
        expect(result.size).toBe(1)
    })

    test("多行高亮 {1,3}", () => {
        const result = parseHighlightLines("ts {1,3}")
        expect(result.has(1)).toBe(true)
        expect(result.has(3)).toBe(true)
        expect(result.size).toBe(2)
    })

    test("范围高亮 {2-4}", () => {
        const result = parseHighlightLines("ts {2-4}")
        expect(result.has(2)).toBe(true)
        expect(result.has(3)).toBe(true)
        expect(result.has(4)).toBe(true)
        expect(result.size).toBe(3)
    })

    test("混合规则 {1,3-5,7}", () => {
        const result = parseHighlightLines("ts {1,3-5,7}")
        expect([...result].sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 7])
    })
})

describe("parseLineNumbers", () => {
    test("无行号参数时返回 false", () => {
        expect(parseLineNumbers("ts {1,3}")).toBe(false)
    })

    test("line-numbers 返回 true（从 1 开始）", () => {
        expect(parseLineNumbers("ts line-numbers")).toBe(true)
    })

    test(":line-numbers 和 @line-numbers 也返回 true", () => {
        expect(parseLineNumbers("ts:line-numbers")).toBe(false) // 这种写法不在 info string 里
        expect(parseLineNumbers("ts :line-numbers")).toBe(true)
        expect(parseLineNumbers("ts @line-numbers")).toBe(true)
    })

    test("line-numbers=3 返回数字 3", () => {
        expect(parseLineNumbers("ts line-numbers=3")).toBe(3)
    })

    test(":line-numbers=2 和 @line-numbers=2 返回数字 2", () => {
        expect(parseLineNumbers("ts :line-numbers=2")).toBe(2)
        expect(parseLineNumbers("ts @line-numbers=2")).toBe(2)
    })

    test("{1,3} 和 line-numbers 混合使用", () => {
        expect(parseLineNumbers("ts {1,3} line-numbers")).toBe(true)
    })
})
