import path from "node:path"
import fsex from "fs-extra"
import { createRootMetadata, getProjectName } from "../createRootMetadata"
import { StarmapCore } from "../../../StarmapCore"

describe("createRootMetadata 单元测试", () => {
    const tempDir = path.join(__dirname, "temp-mock-project")

    beforeEach(() => {
        fsex.ensureDirSync(tempDir)
    })

    afterEach(() => {
        fsex.removeSync(tempDir)
    })

    test("getProjectName 优先级0：当 config.projectName 存在时，应该直接使用", () => {
        const config = {
            projectName: "ConfigProjectName",
            rootPath: tempDir,
        }
        const name = getProjectName(config)
        expect(name).toBe("ConfigProjectName")
    })

    test("getProjectName 优先级1：当 config.projectName 不存在，但 package.json 存在且含有 name 字段，应该使用 package.json 中的 name", () => {
        // 在临时目录创建 package.json
        fsex.writeJsonSync(path.join(tempDir, "package.json"), {
            name: "package-json-project-name",
        })

        const config = {
            rootPath: tempDir,
        }
        const name = getProjectName(config)
        expect(name).toBe("package-json-project-name")
    })

    test("getProjectName 优先级2：当 config.projectName 不存在且 package.json 没有合法 name 字段时，应该回退到 rootPath 文件夹名称", () => {
        // 在临时目录创建一个没有 name 字段的 package.json
        fsex.writeJsonSync(path.join(tempDir, "package.json"), {
            version: "1.0.0",
        })

        const config = {
            rootPath: tempDir,
        }
        const name = getProjectName(config)
        expect(name).toBe("temp-mock-project")
    })

    test("getProjectName 优先级2：当 package.json 损坏或不存在时，应该回退到 rootPath 文件夹名称", () => {
        const config = {
            rootPath: tempDir,
        }
        const name = getProjectName(config)
        expect(name).toBe("temp-mock-project")
    })

    test("createRootMetadata 应该能够正确调用 getProjectName 并装配 RootMetadata", () => {
        const mockStarmapCore = {
            config: {
                projectName: "CoreProjectName",
                rootPath: tempDir,
                uiTreeDirAlwaysSticky: true,
            },
        } as unknown as StarmapCore

        const metadata = createRootMetadata(mockStarmapCore)
        expect(metadata.projectName).toBe("CoreProjectName")
        expect(metadata.uiTreeDirAlwaysSticky).toBe(true)
    })
})
