import { describe, expect, test } from "vitest"
import { findAllUnits } from "../findAllUnits"
import { FsTree } from "../../../FsTree"
import { Gen } from "../../Gen"
import { StarmapCore } from "../../../StarmapCore"
import * as fs from "node:fs"
import * as path from "node:path"

describe("findAllUnits 单元测试 (.starmap-skip 机制)", () => {
    test("如果包含 .starmap-skip 文件，则应该跳过对应的目录及其子目录下的 readme.md", async () => {
        const testRootDir = path.resolve(__dirname, "./temp-skip-test")
        if (!fs.existsSync(testRootDir)) {
            fs.mkdirSync(testRootDir, { recursive: true })
        }

        // 1. 创建普通目录与 readme.md
        const pkgADir = path.join(testRootDir, "packages/pkg-a")
        const pkgBDir = path.join(testRootDir, "packages/pkg-b")
        const pkgBSubDir = path.join(pkgBDir, "subdir")

        fs.mkdirSync(pkgADir, { recursive: true })
        fs.mkdirSync(pkgBSubDir, { recursive: true })

        fs.writeFileSync(path.join(testRootDir, "readme.md"), "# Root readme")
        fs.writeFileSync(path.join(pkgADir, "readme.md"), "# Package A")
        fs.writeFileSync(path.join(pkgBDir, "readme.md"), "# Package B")
        fs.writeFileSync(path.join(pkgBSubDir, "readme.md"), "# Package B Sub")

        // 2. 在 pkg-b 下创建 .starmap-skip
        fs.writeFileSync(path.join(pkgBDir, ".starmap-skip"), "")

        try {
            // 使用纯 Mock 对象避免复杂的真实异步初始化
            const mockCore = {
                config: {
                    watch: false,
                    rootPath: testRootDir,
                },
                logger: {
                    log: () => {},
                    debug: () => {},
                    error: () => {},
                }
            } as unknown as StarmapCore

            // 初始化 FsTree 并将 FsTree 的 options 设置完整
            const fsTree = new FsTree(testRootDir, { watch: false, rootPath: testRootDir })
            const gen = new Gen(mockCore)

            const units = await findAllUnits(fsTree, gen)

            // 预期找到: testRootDir/readme.md, pkg-a/readme.md
            // 被跳过: pkg-b/readme.md, pkg-b/subdir/readme.md (因父目录有 .starmap-skip)
            const unitIds = units.map((u) => u.id)
            
            // 因为 getIDFromDirPath 解析，根目录 ID 为 starmap-project-root，pkg-a 对应 packages/pkg-a（或 pkg-a）
            expect(unitIds).toContain("starmap-project-root")
            expect(unitIds.some(id => id.includes("pkg-a"))).toBe(true)

            // 验证被跳过的目录不在列表中
            expect(unitIds.some(id => id.includes("pkg-b"))).toBe(false)
        } finally {
            // 清除目录
            const rmrf = (dir: string) => {
                if (fs.existsSync(dir)) {
                    fs.readdirSync(dir).forEach((file) => {
                        const curPath = path.join(dir, file)
                        if (fs.lstatSync(curPath).isDirectory()) {
                            rmrf(curPath)
                        } else {
                            fs.unlinkSync(curPath)
                        }
                    })
                    fs.rmdirSync(dir)
                }
            }
            rmrf(testRootDir)
        }
    })
})
