import { describe, expect, test, vi, beforeEach } from "vitest"
import { markdownImportResolve } from "../markdownImportResolve"
import * as fs from "node:fs/promises"
import * as path from "node:path"

vi.mock("node:fs/promises", () => ({
    readFile: vi.fn(),
}))

describe("markdownImportResolve", () => {
    const mockFilePath = "/mock/path/to/current.md"

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test("解析常规代码块导入", async () => {
        vi.mocked(fs.readFile).mockResolvedValueOnce("console.log('hello')")

        const markdown = `
# Title
@import "demo.js"
`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(fs.readFile).toHaveBeenCalledWith(path.resolve("/mock/path/to", "demo.js"), "utf-8")
        expect(result).toContain("```js")
        expect(result).toContain("console.log('hello')")
        // 非 .vue 文件不加入 imports（仅显示代码块）
        expect(imports?.length).toBe(0)
        expect(dependencies).toEqual([path.resolve("/mock/path/to", "demo.js")])
    })

    test("解析 Vue 文件并作为普通代码块（无 @raw 或 @preview）", async () => {
        vi.mocked(fs.readFile).mockResolvedValueOnce("<template>div</template>")

        const markdown = `@import "demo.vue"`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(result).toContain("```vue")
        expect(result).not.toContain("@preview")
        expect(result).not.toContain("@import-component=")
        expect(result).toContain("<template>div</template>")
        expect(imports?.length).toBe(0)
    })

    test("解析带 @preview 时添加 @import-component", async () => {
        vi.mocked(fs.readFile).mockResolvedValueOnce("<template>div</template>")

        const markdown = `@import @preview.right "demo.vue"`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(result).toContain("```vue @preview.right")
        expect(result).not.toContain("@preview @preview")
        expect(result).toContain("@import-component=")
        expect(imports?.length).toBe(1)

        const componentNameMatch = result.match(/@import-component="([^"]+)"/)
        expect(componentNameMatch).not.toBeNull()
        expect(componentNameMatch![1]).toBe(imports![0].name)
    })

    test("解析带 @raw 时作为组件插入", async () => {
        vi.mocked(fs.readFile).mockResolvedValueOnce("<template>div</template>")

        const markdown = `@import "demo.vue" @raw`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(result).not.toContain("```vue")
        expect(result).toContain(`<${imports![0].name} />`)
        expect(imports?.length).toBe(1)
    })

    test("解析带 @doc 时生成 symbol 文档", async () => {
        vi.mocked(fs.readFile).mockResolvedValueOnce(
            [
                "/**",
                " * createUser",
                " * 创建用户资料。",
                " * @param input 用户输入",
                " */",
                "export function createUser(input: UserInput & AuditFields) {",
                "    return input",
                "}",
            ].join("\n"),
        )

        const markdown = `@import "demo.ts" @doc=createUser`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, {
            filePath: mockFilePath,
        })

        expect(result).toContain("创建用户资料。")
        expect(result).toContain("<StarmapDocParams")
        expect(result).toContain("UserInput&lt;br&gt;AuditFields")
        expect(result).not.toContain("```ts")
        expect(imports?.length).toBe(0)
        expect(dependencies).toEqual([path.resolve("/mock/path/to", "demo.ts")])
    })

    test("递归解析 Markdown 文件", async () => {
        // mock 第一次返回导入另一个 md，第二次返回最终内容
        vi.mocked(fs.readFile).mockResolvedValueOnce("@import 'nested.md'").mockResolvedValueOnce("nested content")

        const markdown = `@import "child.md"`
        const {
            markdown: result,
            imports,
            dependencies,
        } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        // 应该递归解析直接将 nested content 替换进来，而不是用 ```md 包裹
        expect(result).toBe("nested content")
        expect(fs.readFile).toHaveBeenCalledTimes(2)
        expect(fs.readFile).toHaveBeenNthCalledWith(1, path.resolve("/mock/path/to", "child.md"), "utf-8")
        expect(fs.readFile).toHaveBeenNthCalledWith(2, path.resolve("/mock/path/to", "nested.md"), "utf-8")
        // .md 文件不加入 imports（内容直接内联）
        expect(imports?.length).toBe(0)
        expect(dependencies).toEqual([
            path.resolve("/mock/path/to", "nested.md"),
            path.resolve("/mock/path/to", "child.md"),
        ])
    })

    test("支持参数在路径前后且支持单双引号", async () => {
        vi.mocked(fs.readFile).mockResolvedValue("code")

        const markdown = `
@import @full 'a.js'
@import "b.js" @full
`
        const { markdown: result, imports } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(result).toContain("```js @full")
        // 会有两个代码块都是带 @full 的
        const matches = result.match(/```js @full/g)
        expect(matches?.length).toBe(2)
        // 非 .vue 文件不加入 imports
        expect(imports?.length).toBe(0)
    })

    test("未提供 filePath 时返回警告", async () => {
        const markdown = `@import "demo.js"`
        const { markdown: result } = await markdownImportResolve(markdown, {})

        expect(result).toContain("> [!WARNING] Import Error")
        expect(result).toContain("filePath is required")
        expect(fs.readFile).not.toHaveBeenCalled()
    })

    test("文件读取失败时返回警告", async () => {
        vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT: no such file"))

        const markdown = `@import "not-exist.js"`
        const { markdown: result } = await markdownImportResolve(markdown, { filePath: mockFilePath })

        expect(result).toContain("> [!WARNING] Import Error")
        expect(result).toContain("ENOENT")
    })
})
