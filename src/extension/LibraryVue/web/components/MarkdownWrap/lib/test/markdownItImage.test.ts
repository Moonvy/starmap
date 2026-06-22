import { expect, test, describe } from "vitest"
import MarkdownIt from "markdown-it"
import { markdownItImage, parseObsidianImageSize } from "../markdownItImage"

describe("parseObsidianImageSize", () => {
    test("解析带尺寸的 alt", () => {
        expect(parseObsidianImageSize("Alt Text|200x300")).toEqual({
            alt: "Alt Text",
            width: 200,
            height: 300,
        })
    })

    test("解析宽为 0", () => {
        expect(parseObsidianImageSize("Alt|0x300")).toEqual({
            alt: "Alt",
            width: undefined,
            height: 300,
        })
    })

    test("解析高为 0", () => {
        expect(parseObsidianImageSize("Alt|200x0")).toEqual({
            alt: "Alt",
            width: 200,
            height: undefined,
        })
    })

    test("解析不带尺寸的 alt", () => {
        expect(parseObsidianImageSize("Alt Text")).toEqual({
            alt: "Alt Text",
            width: undefined,
            height: undefined,
        })
    })

    test("无 alt 文本仅有尺寸", () => {
        expect(parseObsidianImageSize("|200x300")).toEqual({
            alt: "",
            width: 200,
            height: 300,
        })
    })
})

describe("markdownItImage 渲染测试", () => {
    const md = new MarkdownIt()
    md.use(markdownItImage)

    test("默认渲染为 2x 图片带 figure", () => {
        const html = md.render("![alt](/example.png)")
        expect(html).toContain('<figure class="md-figure">')
        expect(html).toContain('<img src="/example.png" alt="alt" srcset="/example.png 2x" />')
        expect(html).toContain("<figcaption>alt</figcaption>")
        expect(html).toContain("</figure>")
    })

    test("支持 @1x, @2x, @3x", () => {
        const html1 = md.render("![alt](/example@1x.png)")
        expect(html1).toContain('<img src="/example@1x.png" alt="alt" />')

        const html2 = md.render("![alt](/example@2x.png)")
        expect(html2).toContain('<img src="/example@2x.png" alt="alt" srcset="/example@2x.png 2x" />')

        const html3 = md.render("![alt](/example@3x.jpg)")
        expect(html3).toContain('<img src="/example@3x.jpg" alt="alt" srcset="/example@3x.jpg 3x" />')
    })

    test("支持 Obsidian Syntax 设置尺寸", () => {
        const html = md.render("![Alt|200x300](/example.png)")
        expect(html).toContain('<img src="/example.png" alt="Alt" srcset="/example.png 2x" width="200" height="300" />')
        expect(html).toContain("<figcaption>Alt</figcaption>")
    })

    test("支持 Obsidian Syntax 设置单边尺寸", () => {
        const html = md.render("![Alt|0x300](/example.png)")
        expect(html).toContain('<img src="/example.png" alt="Alt" srcset="/example.png 2x" height="300" />')
    })

    test("没有 alt 的图片", () => {
        const html = md.render("![](/example.png)")
        expect(html).toContain(
            '<figure class="md-figure"><img src="/example.png" alt="" srcset="/example.png 2x" /></figure>',
        )
        expect(html).not.toContain("<figcaption>")
    })

    test("没有 alt 只有尺寸", () => {
        const html = md.render("![|200x300](/example.png)")
        expect(html).toContain(
            '<figure class="md-figure"><img src="/example.png" alt="" srcset="/example.png 2x" width="200" height="300" /></figure>',
        )
        expect(html).not.toContain("<figcaption>")
    })
})
