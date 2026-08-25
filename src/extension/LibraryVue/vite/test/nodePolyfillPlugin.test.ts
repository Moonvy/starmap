import { describe, expect, test } from "vitest"
import { nodePolyfillPlugin } from "../nodePolyfillPlugin"

describe("nodePolyfillPlugin 插件测试", () => {
    const plugin = nodePolyfillPlugin() as any

    test("正确解析 node:module 与 module 模块", () => {
        expect(plugin.resolveId("node:module")).toBe("\0starmap:node:module")
        expect(plugin.resolveId("module")).toBe("\0starmap:node:module")
    })

    test("正确解析 node:crypto 与 crypto 模块", () => {
        expect(plugin.resolveId("node:crypto")).toBe("\0starmap:node:crypto")
        expect(plugin.resolveId("crypto")).toBe("\0starmap:node:crypto")
    })

    test("正确解析 node:path, node:url, node:process, node:fs 等常用内置模块", () => {
        expect(plugin.resolveId("node:path")).toBe("\0starmap:node:path")
        expect(plugin.resolveId("path")).toBe("\0starmap:node:path")
        expect(plugin.resolveId("node:url")).toBe("\0starmap:node:url")
        expect(plugin.resolveId("url")).toBe("\0starmap:node:url")
        expect(plugin.resolveId("node:process")).toBe("\0starmap:node:process")
        expect(plugin.resolveId("process")).toBe("\0starmap:node:process")
        expect(plugin.resolveId("node:fs")).toBe("\0starmap:node:fs")
        expect(plugin.resolveId("fs")).toBe("\0starmap:node:fs")
        expect(plugin.resolveId("node:fs/promises")).toBe("\0starmap:node:fs/promises")
        expect(plugin.resolveId("fs/promises")).toBe("\0starmap:node:fs/promises")
    })

    test("非 node 模块不进行拦截", () => {
        expect(plugin.resolveId("vue")).toBeNull()
        expect(plugin.resolveId("./unit.vue")).toBeNull()
        expect(plugin.resolveId("/src/main.ts")).toBeNull()
    })

    test("针对其它未知 node: 前缀模块提供兜底 shim", () => {
        expect(plugin.resolveId("node:something_else")).toBe("\0starmap:node:generic:something_else")
    })

    test("加载 node:module shim 代码并验证 createRequire 导出", () => {
        const code = plugin.load("\0starmap:node:module")
        expect(code).toBeDefined()
        expect(code).toContain("export function createRequire")
        expect(code).toContain("export const builtinModules")
    })

    test("加载 node:crypto shim 代码并验证 createHash 命名导出", () => {
        const code = plugin.load("\0starmap:node:crypto")
        expect(code).toBeDefined()
        expect(code).toContain("export function createHash")
        expect(code).toContain("export function createHmac")
        expect(code).toContain("export function randomBytes")
    })

    test("若由于缓存传入带 generic: 前缀的 id 时也能正确匹配对应 shim", () => {
        const code = plugin.load("\0starmap:node:generic:crypto")
        expect(code).toBeDefined()
        expect(code).toContain("export function createHash")
    })

    test("加载通用兜底 shim 代码", () => {
        const code = plugin.load("\0starmap:node:generic:something_else")
        expect(code).toBeDefined()
        expect(code).toContain("Proxy")
        expect(code).toContain("createHash")
    })
})
