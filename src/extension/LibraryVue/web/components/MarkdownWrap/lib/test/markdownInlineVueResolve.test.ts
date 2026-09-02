import { describe, expect, test } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
    markdownInlineVueResolve,
    resolveRelativePaths,
    formatVueSfc,
} from "../markdownInlineVueResolve"

describe("markdownInlineVueResolve", () => {
    test("resolveRelativePaths 正确转换各种相对路径为绝对路径", () => {
        const baseDir = "/Users/test/project/src/components"
        const code = `
import Foo from "./Foo.vue"
import Bar from '../common/Bar'
import "./style.css"
const Lazy = () => import('./Lazy.vue')
const Req = require("./req.js")
/* CSS */
@import "./theme.css";
background: url("./bg.png");
`
        const deps: string[] = []
        const result = resolveRelativePaths(code, baseDir, deps)

        expect(result).toContain('from "/Users/test/project/src/components/Foo.vue"')
        expect(result).toContain("from '/Users/test/project/src/common/Bar'")
        expect(result).toContain('import "/Users/test/project/src/components/style.css"')
        expect(result).toContain("import('/Users/test/project/src/components/Lazy.vue')")
        expect(result).toContain('require("/Users/test/project/src/components/req.js")')
        expect(result).toContain('@import "/Users/test/project/src/components/theme.css"')
        expect(result).toContain('url("/Users/test/project/src/components/bg.png")')

        expect(deps).toContain("/Users/test/project/src/components/Foo.vue")
        expect(deps).toContain("/Users/test/project/src/components/style.css")
    })

    test("formatVueSfc 自动包裹缺少 template 的纯模板片段", () => {
        const snippet = `<div><h1>Hello World</h1></div>`
        const formatted = formatVueSfc(snippet)
        expect(formatted).toBe("<template>\n<div><h1>Hello World</h1></div>\n</template>\n")
    })

    test("formatVueSfc 保留已有的完整 SFC 标签", () => {
        const sfc = `<template>\n<div>Hello</div>\n</template>\n<script>\nexport default {}\n</script>`
        const formatted = formatVueSfc(sfc)
        expect(formatted).toBe(`${sfc}\n`)
    })

    test("提取 markdown 中的内联 vue @preview 代码块并输出独立 vue 文件", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-inline-vue-test-"))
        const outputDir = path.join(tempDir, "output")
        const mdFilePath = path.join(tempDir, "readme.md")

        try {
            const mdContent = `
# 标题

\`\`\`vue @preview
<template>
    <AbSingleView :views="views" ref="AbSingleView" />
</template>
<script>
import LoginPage from "./pages/LoginPage.vue"
export default {
    data() { return { views: [] } }
}
</script>
\`\`\`
`
            const res = await markdownInlineVueResolve(mdContent, {
                filePath: mdFilePath,
                outputDir,
            })

            expect(res.imports.length).toBe(1)
            const imported = res.imports[0]
            expect(imported.name).toMatch(/^InlinePreview_/)
            expect(imported.path).toMatch(/\.vue$/)

            // 验证生成的 vue 文件内容
            expect(fs.existsSync(imported.path)).toBe(true)
            const generatedVue = fs.readFileSync(imported.path, "utf-8")
            expect(generatedVue).toContain("<AbSingleView")
            // 相对路径已被解析为基于 mdFilePath 的绝对路径
            expect(generatedVue).toContain(path.resolve(tempDir, "./pages/LoginPage.vue").replace(/\\/g, "/"))

            // 验证 markdown 中的代码块添加了 @import-component
            expect(res.markdown).toContain(`@import-component="${imported.name}"`)
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })
})
