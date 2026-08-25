import path from "node:path"
import { pathToFileURL } from "node:url"
import fsex from "fs-extra"
import { merge } from "fzz"
import { IStarmapConfig } from "../../config.type"

export interface LoadConfigOptions {
    cwd: string
    name: string
    overrides?: Partial<IStarmapConfig>
    defaults?: Partial<IStarmapConfig>
}

export interface LoadConfigResult {
    config: IStarmapConfig
    configFile?: string
}

/**
 * 载入项目配置文件
 * 从 starmap.config.ts, starmap.config.js, starmap.config.json 中载入配置并进行合并
 *
 * @param options 载入配置的选项参数
 */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadConfigResult> {
    const { cwd: cwdPath, overrides, defaults } = options

    const baseDir = path.resolve(cwdPath)
    let rootDir = baseDir
    // 如果 cwdPath 是以 config 目录结尾的，我们需要退回父级获得项目根目录
    if (path.basename(baseDir) === "config") {
        rootDir = path.dirname(baseDir)
    }

    // 候选配置文件路径列表
    const searchPaths = [
        path.join(rootDir, "config", "starmap.config.ts"),
        path.join(rootDir, "config", "starmap.config.js"),
        path.join(rootDir, "config", "starmap.config.json"),
        path.join(rootDir, "starmap.config.ts"),
        path.join(rootDir, "starmap.config.js"),
        path.join(rootDir, "starmap.config.json"),
    ]

    let configFile: string | undefined
    for (const p of searchPaths) {
        if (await fsex.pathExists(p)) {
            configFile = p
            break
        }
    }

    let fileConfig: any = {}

    if (configFile) {
        const ext = path.extname(configFile)
        try {
            if (ext === ".json") {
                const content = await fsex.readFile(configFile, "utf-8")
                fileConfig = JSON.parse(content)
            } else if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
                const fileUrl = pathToFileURL(configFile).href
                const mod = await import(fileUrl)
                fileConfig = mod.default ?? mod.config ?? mod
            } else if (ext === ".ts") {
                // 首先尝试直接导入，以支持 Bun 环境或开启了直接运行 ts 的 Node 环境
                try {
                    const fileUrl = pathToFileURL(configFile).href
                    const mod = await import(fileUrl)
                    fileConfig = mod.default ?? mod.config ?? mod
                } catch (e) {
                    // 如果直接加载失败，降级到转译加载
                    const ts = await import("typescript")
                        .then((m) => m.default || m)
                        .catch(() => null)

                    if (ts) {
                        const tsCode = await fsex.readFile(configFile, "utf-8")
                        const transpileResult = ts.transpileModule(tsCode, {
                            compilerOptions: {
                                module: ts.ModuleKind.ESNext,
                                target: ts.ScriptTarget.ES2022,
                            },
                        })

                        // 将编译出的 JS 内容写入同一个目录下的临时 mjs 文件，确保相对路径引用一致
                        const tempFilePath = `${configFile}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.mjs`
                        await fsex.writeFile(tempFilePath, transpileResult.outputText, "utf-8")

                        try {
                            const fileUrl = pathToFileURL(tempFilePath).href
                            const mod = await import(fileUrl)
                            fileConfig = mod.default ?? mod.config ?? mod
                        } catch {
                            // 配置文件可能依赖了 Vue / 前端模块，在 Node 环境下执行失败属正常现象
                            // 此时保留空配置，前端 Vite 运行时会通过 user-config.ts 完整加载
                        } finally {
                            // 加载完后，无论成功与否都要删除临时文件
                            if (await fsex.pathExists(tempFilePath)) {
                                await fsex.unlink(tempFilePath)
                            }
                        }
                    }
                }
            }
        } catch {
            // 静默处理，避免非关键报错阻塞 CLI
        }
    }

    // 合并配置项，优先级为：defaults -> fileConfig -> overrides
    const config = merge({}, defaults || {}, fileConfig || {}, overrides || {})

    return {
        config,
        configFile,
    }
}
