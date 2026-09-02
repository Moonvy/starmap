import { describe, expect, test } from "vitest"
import { isCssLanguage, CSS_COLOR_REGEX } from "../colorPreviewTransformer"
import { markdownCodeHighlight } from "../markdownItCodeHighlight"

describe("CSS 颜色识别与语言判断", () => {
    test("isCssLanguage 正确识别 CSS 及衍生语言", () => {
        expect(isCssLanguage("css")).toBe(true)
        expect(isCssLanguage("CSS")).toBe(true)
        expect(isCssLanguage("scss")).toBe(true)
        expect(isCssLanguage("sass")).toBe(true)
        expect(isCssLanguage("less")).toBe(true)
        expect(isCssLanguage("stylus")).toBe(true)
        expect(isCssLanguage("postcss")).toBe(true)
        expect(isCssLanguage("pcss")).toBe(true)

        expect(isCssLanguage("javascript")).toBe(false)
        expect(isCssLanguage("ts")).toBe(false)
        expect(isCssLanguage("html")).toBe(false)
        expect(isCssLanguage("")).toBe(false)
    })

    test("CSS_COLOR_REGEX 匹配常见 Hex 与函数颜色", () => {
        const text = `
            color: #fff;
            background: #12345678;
            border: 1px solid #3b82f6;
            outline: 2px solid #abcd;
            accent: rgb(255, 0, 128);
            fill: rgba(0, 0, 0, 0.5);
            stroke: hsl(120deg 100% 50%);
            shadow: hsla(200, 50%, 50%, 0.8);
            mix: oklch(0.6 0.25 140);
            mix2: oklab(0.6 -0.1 0.2);
            mix3: hwb(120 10% 20%);
            mix4: color-mix(in srgb, #ff0000 50%, #0000ff);
        `
        CSS_COLOR_REGEX.lastIndex = 0
        const matches = [...text.matchAll(CSS_COLOR_REGEX)].map((m) => m[0])
        expect(matches).toContain("#fff")
        expect(matches).toContain("#12345678")
        expect(matches).toContain("#3b82f6")
        expect(matches).toContain("#abcd")
        expect(matches).toContain("rgb(255, 0, 128)")
        expect(matches).toContain("rgba(0, 0, 0, 0.5)")
        expect(matches).toContain("hsl(120deg 100% 50%)")
        expect(matches).toContain("hsla(200, 50%, 50%, 0.8)")
        expect(matches).toContain("oklch(0.6 0.25 140)")
        expect(matches).toContain("color-mix(in srgb, #ff0000 50%, #0000ff)")
    })

    test("CSS_COLOR_REGEX 排除非颜色 Hex 标识符", () => {
        const text = `
            #container { display: flex; }
            #header-nav { color: #fff; }
            #xyz-123 { margin: 0; }
        `
        CSS_COLOR_REGEX.lastIndex = 0
        const matches = [...text.matchAll(CSS_COLOR_REGEX)].map((m) => m[0])
        expect(matches).toEqual(["#fff"])
        expect(matches).not.toContain("#container")
        expect(matches).not.toContain("#header-nav")
        expect(matches).not.toContain("#xyz-123")
    })
})

describe("Shiki CSS Color Preview 渲染", () => {
    test("在 CSS 代码块中渲染颜色预览色块", async () => {
        const code = `
.box {
  color: #3b82f6;
  background-color: rgb(255, 0, 0);
}
`
        const html = await markdownCodeHighlight(code, "css", "")
        expect(html).toContain('class="shiki-color-preview"')
        expect(html).toContain('data-color="#3b82f6"')
        expect(html).toContain('data-color="rgb(255, 0, 0)"')
        expect(html).toContain('title="点击复制颜色: #3b82f6"')
        expect(html).toContain('class="shiki-color-preview-box"')
        expect(html).toContain("background-color: #3b82f6;")
        expect(html).toContain("background-color: rgb(255, 0, 0);")
    })

    test("在单行多个颜色时正确插入所有色块", async () => {
        const code = `
.multi {
  border-color: #ff0000 #00ff00 #0000ff;
}
`
        const html = await markdownCodeHighlight(code, "css", "")
        expect(html).toContain("background-color: #ff0000;")
        expect(html).toContain("background-color: #00ff00;")
        expect(html).toContain("background-color: #0000ff;")
        const count = (html.match(/shiki-color-preview-box/g) || []).length
        expect(count).toBe(3)
    })

    test("在 SCSS / LESS 代码块中同样支持颜色预览", async () => {
        const code = `
$theme-color: #10b981;
.card {
  border: 1px solid rgba(0, 0, 0, 0.1);
}
`
        const html = await markdownCodeHighlight(code, "scss", "")
        expect(html).toContain("background-color: #10b981;")
        expect(html).toContain("background-color: rgba(0, 0, 0, 0.1);")
    })

    test("非 CSS 语言（如 js）不会添加颜色预览", async () => {
        const code = `const color = '#3b82f6'`
        const html = await markdownCodeHighlight(code, "javascript", "")
        expect(html).not.toContain("shiki-color-preview")
    })
})
