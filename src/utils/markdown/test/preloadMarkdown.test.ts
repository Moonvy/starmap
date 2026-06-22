import { preloadMarkdown } from "../preloadMarkdown"

test("支持自定义 metadata 围栏块", () => {
    const source = ["```metadata    ", '{"iconClass":"ri:folders-fill", "sort": 7}', "```  ", "", "# Title"].join("\n")

    const result = preloadMarkdown(source)

    expect(result.metadata).toEqual({
        iconClass: "ri:folders-fill",
        sort: 7,
    })
    expect(result.content.trim()).toBe("# Title")
})

test("支持 json metadata 围栏块", () => {
    const source = ["```json metadata", '{"category":"docs"}', "```", "Content"].join("\n")

    const result = preloadMarkdown(source)

    expect(result.metadata).toEqual({ category: "docs" })
    expect(result.content.trim()).toBe("Content")
})

test("未匹配围栏时使用 gray-matter", () => {
    const source = ["---", "title: Hello", "weight: 3", "---", "正文"].join("\n")

    const result = preloadMarkdown(source)

    expect(result.metadata).toEqual({ title: "Hello", weight: 3 })
    expect(result.content.trim()).toBe("正文")
})

test("没有元数据时返回空对象", () => {
    const source = ["# Plain", "Content"].join("\n")

    const result = preloadMarkdown(source)

    expect(result.metadata).toEqual({})
    expect(result.content.trim()).toBe("# Plain\nContent")
})
