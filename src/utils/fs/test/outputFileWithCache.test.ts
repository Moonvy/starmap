import { expect, test, describe, beforeEach, vi, afterEach } from "vitest"
import { outputFileWithCache, outputJsonWithCache } from "../outputFileWithCache"
import fsex from "fs-extra"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const testOutputDir = path.resolve(__dirname, "output_test")

describe("outputFileWithCache", () => {
    beforeEach(() => {
        // 每个测试前清空测试输出目录
        fsex.removeSync(testOutputDir)
        fsex.ensureDirSync(testOutputDir)

        // 监视 console.log
        vi.spyOn(console, "log").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        fsex.removeSync(testOutputDir)
    })

    test("首次写入文件", () => {
        const outputPath = path.join(testOutputDir, "test1.txt")
        const content = "hello world"

        outputFileWithCache(outputPath, content)

        expect(fsex.existsSync(outputPath)).toBe(true)
        expect(fsex.readFileSync(outputPath, "utf-8")).toBe(content)
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Output:"))
    })

    test("相同内容再次写入应跳过", () => {
        const outputPath = path.join(testOutputDir, "test2.txt")
        const content = "stable content"

        // 第一次写入
        outputFileWithCache(outputPath, content)
        expect(console.log).toHaveBeenCalledTimes(1)

        const mtime1 = fsex.statSync(outputPath).mtimeMs

        // 模拟一点延迟以确保 mtime 可能会变（虽然 fs 精读可能不够，但我们可以通过 spy 验证）
        // 实际上我们通过重置 spy 来验证 console.log 是否再次被调用
        vi.clearAllMocks()

        // 第二次写入相同内容
        outputFileWithCache(outputPath, content)

        expect(console.log).not.toHaveBeenCalled()
        const mtime2 = fsex.statSync(outputPath).mtimeMs
        expect(mtime1).toBe(mtime2)
    })

    test("不同内容写入应更新", () => {
        const outputPath = path.join(testOutputDir, "test3.txt")

        outputFileWithCache(outputPath, "content v1")
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Output:"))

        vi.clearAllMocks()

        outputFileWithCache(outputPath, "content v2")
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Output:"))
        expect(fsex.readFileSync(outputPath, "utf-8")).toBe("content v2")
    })

    test("支持 ArrayBuffer 内容", () => {
        const outputPath = path.join(testOutputDir, "test4.bin")
        const content = new TextEncoder().encode("binary content").buffer

        outputFileWithCache(outputPath, content)

        expect(fsex.existsSync(outputPath)).toBe(true)
        expect(fsex.readFileSync(outputPath, "utf-8")).toBe("binary content")
    })

    test("自动创建不存在的目录", () => {
        const outputPath = path.join(testOutputDir, "deep/dir/test5.txt")
        const content = "deep content"

        outputFileWithCache(outputPath, content)

        expect(fsex.existsSync(outputPath)).toBe(true)
        expect(fsex.readFileSync(outputPath, "utf-8")).toBe(content)
    })

    test("outputJsonWithCache 应该正确输出 JSON 并缓存", () => {
        const outputPath = path.join(testOutputDir, "test.json")
        const data = { a: 1, b: "2" }

        outputJsonWithCache(outputPath, data)

        expect(fsex.existsSync(outputPath)).toBe(true)
        const content = fsex.readJsonSync(outputPath)
        expect(content).toEqual(data)
    })
})
