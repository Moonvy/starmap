import { describe, expect, test, vi, beforeAll, afterAll } from "vitest"
import { StarmapCore } from "../StarmapCore"
import fsex from "fs-extra"
import path from "node:path"
import { cwd } from "process"

// Mock buildVite to avoid running real Vite compile during config tests
vi.mock("../../extension/LibraryVue/vite/buildVite", () => ({
    buildVite: vi.fn(async () => {}),
}))

// Mock exec to avoid installing dependencies in tmp directory
vi.mock("node:child_process", () => ({
    exec: vi.fn((cmd, options, callback) => {
        const cb = typeof options === "function" ? options : callback
        if (cb) cb(null, { stdout: "mocked install" })
    }),
}))

describe("StarmapCore build configuration", () => {
    const testRootDir = path.resolve(cwd(), "test/tmp-build-config")
    const testOutputDir = path.resolve(testRootDir, ".starmap-test")

    beforeAll(async () => {
        await fsex.ensureDir(testRootDir)
    })

    afterAll(async () => {
        await fsex.remove(testRootDir)
    })

    test("应该在 isBuild 为 true 时正确解析默认的 buildDir", async () => {
        const core = new StarmapCore({
            rootPath: testRootDir,
            outputDir: testOutputDir,
            isBuild: true,
            watch: false,
        })

        await core.ready

        // 默认将 buildDir 解析为 rootPath 下的 dist 目录
        expect(core.config.buildDir).toBe(path.resolve(testRootDir, "dist"))
        expect(core.config.watch).toBe(false)
    })

    test("应该正确解析自定义的相对路径 buildDir", async () => {
        const core = new StarmapCore({
            rootPath: testRootDir,
            outputDir: testOutputDir,
            buildDir: "./custom-dist-path",
            isBuild: true,
            watch: false,
        })

        await core.ready

        // 将相对路径 buildDir 解析为基于 rootPath 的绝对路径
        expect(core.config.buildDir).toBe(path.resolve(testRootDir, "custom-dist-path"))
    })
})
