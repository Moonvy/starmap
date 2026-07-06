import { expect, test } from "vitest"
import { renderMarkdown } from "../../../extension/LibraryVue/web/components/MarkdownWrap/renderMarkdown"
import path from "path"

test("renderMarkdown 基本渲染", async () => {
    const { html } = await renderMarkdown("# Hello")
    expect(html).toContain('<h1 id="hello" tabindex="-1"><a class="header-anchor" href="#hello" aria-hidden="true">#</a> Hello</h1>')
})

test("renderMarkdown 包含图片相对路径", async () => {
    const md = `![alt](./image.png)`
    const filePath = "/Users/test/project/readme.md"
    const { html } = await renderMarkdown(md, { filePath })

    const expectedPath = path.resolve("/Users/test/project", "./image.png")
    expect(html).toContain(`src="${expectedPath}"`)
    expect(html).toContain(`srcset="${expectedPath} 2x"`)
})

test("renderMarkdown 包含图片绝对路径不处理", async () => {
    const md = `![alt](/absolute/image.png)`
    const filePath = "/Users/test/project/readme.md"
    const { html } = await renderMarkdown(md, { filePath })

    expect(html).toContain(`src="/absolute/image.png"`)
})

test("renderMarkdown 包含图片网络路径不处理", async () => {
    const md = `![alt](https://example.com/image.png)`
    const filePath = "/Users/test/project/readme.md"
    const { html } = await renderMarkdown(md, { filePath })

    expect(html).toContain(`src="https://example.com/image.png"`)
})

test("renderMarkdown HTML video 标签相对路径", async () => {
    const md = `<video src="./video.mp4" poster="../poster.jpg"></video>`
    const filePath = "/Users/test/project/src/readme.md"
    const { html } = await renderMarkdown(md, { filePath })

    const expectedSrc = path.resolve("/Users/test/project/src", "./video.mp4")
    const expectedPoster = path.resolve("/Users/test/project/src", "../poster.jpg")

    expect(html).toContain(`src="${expectedSrc}"`)
    expect(html).toContain(`poster="${expectedPoster}"`)
})

test("renderMarkdown 移除首个 h1", async () => {
    const md = `# Title1\n## Subtitle\n# Title2`

    // 默认不移除
    const { html: html1 } = await renderMarkdown(md)
    expect(html1).toContain('<h1 id="title1" tabindex="-1"><a class="header-anchor" href="#title1" aria-hidden="true">#</a> Title1</h1>')
    expect(html1).toContain('<h1 id="title2" tabindex="-1"><a class="header-anchor" href="#title2" aria-hidden="true">#</a> Title2</h1>')

    // 开启选项移除首个 h1
    const { html: html2 } = await renderMarkdown(md, { removeFirstH1: true })
    expect(html2).not.toContain('<h1 id="title1" tabindex="-1"><a class="header-anchor" href="#title1" aria-hidden="true">#</a> Title1</h1>')
    expect(html2).toContain('<h1 id="title2" tabindex="-1"><a class="header-anchor" href="#title2" aria-hidden="true">#</a> Title2</h1>')
})

test("renderMarkdown 代码块包含 data-language 属性", async () => {
    const md = "```typescript\nconst a = 1\n```"
    const { html } = await renderMarkdown(md)
    // displayLang 会把 typescript 简化为 ts
    expect(html).toContain('data-language="ts"')
})

test("renderMarkdown 保留导入文档主注释换行", async () => {
    const md =
        '<div class="starmap-import-doc-comment"><div class="starmap-import-doc-comment-line">第一段说明。</div><div class="starmap-import-doc-comment-line is-empty"></div><div class="starmap-import-doc-comment-line">第二段说明。</div></div>'
    const { html } = await renderMarkdown(md)

    expect(html).toContain('<div class="starmap-import-doc-comment-line">第一段说明。</div>')
    expect(html).toContain('<div class="starmap-import-doc-comment-line is-empty"></div>')
    expect(html).toContain('<div class="starmap-import-doc-comment-line">第二段说明。</div>')
    expect(html).not.toContain("<p>第一段说明。")
})

test("renderMarkdown 剥离纯 figure 段落外层的 p 标签", async () => {
    // 单个图片的情况
    const md1 = `![alt](/example.png)`
    const { html: html1 } = await renderMarkdown(md1)
    expect(html1).toContain('<figure class="md-figure">')
    expect(html1).not.toContain('<p><figure class="md-figure">')
    expect(html1).not.toContain('</figure></p>')

    // 连续两个图片在同一个段落中的情况
    const md2 = `![img1](/example.png)\n![img2](/example.png)`
    const { html: html2 } = await renderMarkdown(md2)
    // 两个 figure 应该依次排列，但外层不能有 p 标签
    expect(html2).toContain('<figure class="md-figure">')
    expect(html2).not.toContain('<p><figure')
    expect(html2).not.toContain('</figure></p>')
})

test("renderMarkdown 自定义标题 ID", async () => {
    const md = `
## My section {#my-custom-anchor}
### Configuration options {#config}
##### Deep detail {#detail}
## *Styled Section* {#styled-anchor}
`
    const { html } = await renderMarkdown(md)
    expect(html).toContain('<h2 id="my-custom-anchor" tabindex="-1"><a class="header-anchor" href="#my-custom-anchor" aria-hidden="true">#</a> My section</h2>')
    expect(html).toContain('<h3 id="config" tabindex="-1"><a class="header-anchor" href="#config" aria-hidden="true">#</a> Configuration options</h3>')
    expect(html).toContain('<h5 id="detail" tabindex="-1"><a class="header-anchor" href="#detail" aria-hidden="true">#</a> Deep detail</h5>')
    expect(html).toContain('<h2 id="styled-anchor" tabindex="-1"><a class="header-anchor" href="#styled-anchor" aria-hidden="true">#</a> <em>Styled Section</em></h2>')
})

test("renderMarkdown 本地 markdown 链接重定向", async () => {
    const md = `[array](./src/array/readme.md) and [array option](./src/array/readme.md#options) and [external](https://google.com)`
    const filePath = "/Users/test/project/src/math/readme.md"
    const codeUnits = [
        {
            id: "array",
            readmeFullPath: "/Users/test/project/src/array/readme.md",
            gen: {
                starmapCore: {
                    config: {
                        rootPath: "/Users/test/project",
                    },
                },
            },
        },
    ]

    const { html } = await renderMarkdown(md, { filePath, codeUnits: codeUnits as any })

    expect(html).toContain('href="#/units/array"')
    expect(html).toContain('href="#/units/array#options"')
    expect(html).toContain('href="https://google.com"')
})
