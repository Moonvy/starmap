import { StarmapCore } from "../StarmapCore"
import fsex from "fs-extra"
import path from "node:path"
import { cwd } from "process"

describe("StarmapCore rebuild", () => {
    const testRootDir = path.resolve(cwd(), "test/tmp-rebuild")
    const testOutputDir = path.resolve(testRootDir, ".starmap-test")

    beforeAll(async () => {
        await fsex.ensureDir(testRootDir)
    })

    afterAll(async () => {
        await fsex.remove(testRootDir)
    })

    test("rebuild 应该清除输出目录和缓存", async () => {
        // 准备环境
        await fsex.ensureDir(testOutputDir)
        await fsex.writeFile(path.join(testOutputDir, "old-file.txt"), "old")

        const core = new StarmapCore({
            rootPath: testRootDir,
            outputDir: testOutputDir,
        })

        await core.ready

        // 验证初始状态：文件应该存在（因为 new StarmapCore 默认不 rebuild）
        expect(fsex.existsSync(path.join(testOutputDir, "old-file.txt"))).toBe(true)

        // 执行 rebuild
        await core.rebuild()

        // 验证：输出目录被清空并重建，旧文件应该消失
        expect(fsex.existsSync(path.join(testOutputDir, "old-file.txt"))).toBe(false)
        expect(fsex.existsSync(testOutputDir)).toBe(true)
    })
})
