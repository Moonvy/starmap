import path from "node:path"
import fsex from "fs-extra"
import { loadConfig } from "../loadConfig"

describe("loadConfig 单元测试", () => {
    const tempDir = path.resolve(__dirname, "temp_test_config")

    beforeEach(async () => {
        await fsex.ensureDir(tempDir)
    })

    afterEach(async () => {
        await fsex.remove(tempDir)
    })

    test("应当能够成功读取并合并 JSON 格式配置文件", async () => {
        const configPath = path.join(tempDir, "starmap.config.json")
        await fsex.outputJson(configPath, {
            port: 1234,
            watch: false,
        })

        const result = await loadConfig({
            cwd: tempDir,
            name: "starmap",
            defaults: {
                port: 4070,
                openBrowser: true,
            },
            overrides: {
                watch: true,
            },
        })

        expect(result.configFile).toBe(configPath)
        expect(result.config.port).toBe(1234)
        expect(result.config.openBrowser).toBe(true)
        expect(result.config.watch).toBe(true)
    })

    test("应当能够成功读取并合并 JS 格式配置文件", async () => {
        const configPath = path.join(tempDir, "starmap.config.js")
        await fsex.writeFile(
            configPath,
            `
            export default {
                port: 5678,
                watch: false
            }
        `,
            "utf-8"
        )

        const result = await loadConfig({
            cwd: tempDir,
            name: "starmap",
            defaults: {
                port: 4070,
                openBrowser: true,
            },
            overrides: {
                watch: true,
            },
        })

        expect(result.configFile).toBe(configPath)
        expect(result.config.port).toBe(5678)
        expect(result.config.openBrowser).toBe(true)
        expect(result.config.watch).toBe(true)
    })

    test("应当能够成功读取并合并 TS 格式配置文件（转译加载）", async () => {
        const configPath = path.join(tempDir, "starmap.config.ts")
        await fsex.writeFile(
            configPath,
            `
            interface Config {
                port: number;
                watch: boolean;
            }
            const config: Config = {
                port: 9012,
                watch: false
            };
            export default config;
        `,
            "utf-8"
        )

        const result = await loadConfig({
            cwd: tempDir,
            name: "starmap",
            defaults: {
                port: 4070,
                openBrowser: true,
            },
            overrides: {
                watch: true,
            },
        })

        expect(result.configFile).toBe(configPath)
        expect(result.config.port).toBe(9012)
        expect(result.config.openBrowser).toBe(true)
        expect(result.config.watch).toBe(true)
    })

    test("若配置文件不存在，应当只合并 defaults 和 overrides", async () => {
        const result = await loadConfig({
            cwd: tempDir,
            name: "starmap",
            defaults: {
                port: 4070,
                openBrowser: true,
            },
            overrides: {
                port: 8080,
            },
        })

        expect(result.configFile).toBeUndefined()
        expect(result.config.port).toBe(8080)
        expect(result.config.openBrowser).toBe(true)
    })

    test("应当能够在 config 子目录中寻寻找配置文件", async () => {
        const configSubdir = path.join(tempDir, "config")
        await fsex.ensureDir(configSubdir)
        const configPath = path.join(configSubdir, "starmap.config.json")
        await fsex.outputJson(configPath, {
            port: 3333,
        })

        // cwd 传入项目的根目录，应当能在 config 子目录下找到
        const result = await loadConfig({
            cwd: tempDir,
            name: "starmap",
        })

        expect(result.configFile).toBe(configPath)
        expect(result.config.port).toBe(3333)
    })
})
