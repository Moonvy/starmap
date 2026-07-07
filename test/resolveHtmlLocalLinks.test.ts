import { resolveHtmlLocalLinks } from "../src/extension/LibraryVue/web/components/MarkdownWrap/renderMarkdown"

test("能够正确将本地的 markdown 链接转换为 SPA 路由形式，即使带有 # 锚点且指向同目录下的其他 md 文件", () => {
    const mockCodeUnits = [
        {
            id: "array",
            readmeFullPath: "/Users/yarna/Project/MOONVY-ONE/vendors/Starmap4/src/array/readme.md",
            dirName: "array"
        },
        {
            id: "array-sub",
            readmeFullPath: "/Users/yarna/Project/MOONVY-ONE/vendors/Starmap4/src/array/sub/readme.md",
            dirName: "sub"
        }
    ]

    const filePath = "/Users/yarna/Project/MOONVY-ONE/vendors/Starmap4/src/array/readme.md"

    // 1. 完全匹配 of README 链接
    const html1 = '<a href="./readme.md">Array</a>'
    const result1 = resolveHtmlLocalLinks(html1, filePath, mockCodeUnits)
    expect(result1).toBe('<a href="/units/array">Array</a>')

    // 2. 带 # 锚点且指向同目录下其他 md 文件的链接
    const html2 = '<a href="./readme.func.md#arrayremove">arrayRemove</a>'
    const result2 = resolveHtmlLocalLinks(html2, filePath, mockCodeUnits)
    expect(result2).toBe('<a href="/units/array#arrayremove">arrayRemove</a>')

    // 3. 指向子目录下 md 文件的链接，应该优先匹配到更深层的 code unit (array-sub)
    const html3 = '<a href="./sub/options.md#subopt">subOpt</a>'
    const result3 = resolveHtmlLocalLinks(html3, filePath, mockCodeUnits)
    expect(result3).toBe('<a href="/units/array-sub#subopt">subOpt</a>')

    // 4. 外部链接，不应被处理
    const html4 = '<a href="https://google.com">Google</a>'
    const result4 = resolveHtmlLocalLinks(html4, filePath, mockCodeUnits)
    expect(result4).toBe('<a href="https://google.com">Google</a>')
})
