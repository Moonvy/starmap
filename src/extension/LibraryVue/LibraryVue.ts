import { StarmapCoreEvents } from "../../core/events"
import { StarmapCore } from "../../core/StarmapCore"

import path from "node:path"
import fsExtra from "fs-extra"
import { CodeUnit } from "../../core/Gen/CodeUnit"
import { outputTemplate } from "./lib/outputTemplate"
import { createViteServer } from "./vite/createViteServer"
import { buildVite } from "./vite/buildVite"
import { subscribe } from "@parcel/watcher"
import { debounce } from "es-toolkit"
import { readableMs } from "fzz"
import { createRootRoutesCode } from "./lib/createRootRoutesCode"
import { createGlobalComponentsCode } from "./lib/createGlobalComponentsCode"
import { createUnitComponentCode } from "./lib/createUnitComponentCode"
import { outputReadmeVue } from "./gen/readme/outputReadmeVue"
import { outputFileWithCache } from "../../utils/fs/outputFileWithCache"
import { parse } from "vue-docgen-api"
import fs from "node:fs/promises"

import { getLibraryVueRoot } from "../../utils/packagePath"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import chalk from "chalk"

const execAsync = promisify(exec)

/** 记录每个 vue 组件文件上次解析时的 mtime，用于避免内容未变更时重复解析 */
const vueDocgenMtimeCache = new Map<string, number>()

export function LibraryVue(options?: {}) {
    return function extension(core: StarmapCore) {
        core.logger.debug("<LibraryVue|init> start.")

        // 单个代码单元生成
        core.eventHub.on(StarmapCoreEvents.generateUnit, async ({ codeUnit }) => {
            await generateCodeUnit(codeUnit, core)
        })

        // 全部代码单元生成完成后
        core.eventHub.on(StarmapCoreEvents.generateEnd, async ({ gen }) => {
        })

        // 代码单元树生成完成后
        core.eventHub.on(StarmapCoreEvents.generateTree, async ({ gen }) => {
            await generateCodeRoot(core)
        })

        // 启动 vite 开发服务器 / 执行 vite 构建
        core.eventHub.on(StarmapCoreEvents.firstGenerateDone, async () => {
            if (core.config.isBuild) {
                await buildVite({ core })
            } else {
                createViteServer({ core })
            }
        })

        core.logger.debug("<LibraryVue|init> loaded.")

        // 监视源码文件夹（/web）
        // ------------------------
        if (core.config.watch !== false) {
            const webDir = path.join(getLibraryVueRoot(), "web")
            const debouncedGenerateCodeRoot = debounce(() => generateCodeRoot(core), 500, {
                edges: ["leading"],
            })
            // 触发 generateCodeRoot，但是 500ms 内多次变动只触发一次
            void subscribe(webDir, (err, events) => {
                if (err) {
                    core.logger.error("<LibraryVue|watch> error:", err)
                    return
                }
                if (events.length > 0) {
                    debouncedGenerateCodeRoot()
                }
            })
        }
    }
}

/** 为项目生成 */
async function generateCodeRoot(core: StarmapCore) {
    copyAssets()

    // 输出根目录 HTML 文件
    outputTemplate("root.html.hbs", path.join(core.config.outputDir!, "index.html"))

    // 输出根目录 metadata.ts 文件
    const metadataTsPath = path.join(core.config.outputDir!, "metadata.ts")
    outputTemplate("root.metadata.ts", metadataTsPath)

    // 输出根目录 global-components.ts
    const globalComponentsTsPath = path.join(core.config.outputDir!, "global-components.ts")
    outputTemplate("global-components.ts", globalComponentsTsPath, {
        globalComponents: await createGlobalComponentsCode(core.gen.allUnits.flat),
    })

    // 输出根目录 router.ts 文件
    const routerTsPath = path.join(core.config.outputDir!, "router.ts")
    outputTemplate("router.ts", routerTsPath, {
        routes: createRootRoutesCode(core.gen.allUnits.flat),
    })

    // 输出根目录 package.json，写入必要依赖以避免 Vite 在 node_modules/.starmap 中出现 Failed to resolve import "vue" 报错
    const packageJsonPath = path.join(core.config.outputDir!, "package.json")
    outputFileWithCache(
        packageJsonPath,
        JSON.stringify(
            {
                name: "@moonvy/starmap-output",
                private: true,
                type: "module",
                dependencies: {
                    vue: "*",
                    "vue-router": "*",
                },
            },
            null,
            4
        )
    )

    // 必要时触发依赖安装，确保输出目录的依赖完备
    await ensureDependencies(core)

    /** 复制 web/public 下的文件到 outputDir(.starmap) */
    function copyAssets() {
        let publicDir = path.join(getLibraryVueRoot(), "web/public")
        let outputPublicDir = path.join(core.config.outputDir!)

        fsExtra.copySync(publicDir, outputPublicDir)
        core.logger.debug("<LibraryVue|copyAssets>", { publicDir, outputPublicDir })
    }
}

/**
 * 确保输出目录的依赖项已安装
 * 
 * 如果 node_modules 目录或关键依赖项缺失，则会触发包管理器在输出目录下安装依赖。
 * 
 * @param core StarmapCore 实例
 */
async function ensureDependencies(core: StarmapCore) {
    const outputDir = core.config.outputDir!
    const nodeModulesPath = path.join(outputDir, "node_modules")
    const vuePath = path.join(nodeModulesPath, "vue")

    // 检查 node_modules/vue 是否存在。如果已存在，说明依赖已安装，跳过
    let isInstalled = false
    try {
        await fs.access(vuePath)
        isInstalled = true
    } catch {
        isInstalled = false
    }

    if (isInstalled) {
        return
    }

    core.logger.log(chalk.blue("<LibraryVue|install> 检测到输出目录依赖缺失，开始准备安装..."))

    // 检测宿主项目的包管理器
    const rootPath = core.config.rootPath!
    let pm = "bun" // 默认使用 bun

    try {
        const files = await fs.readdir(rootPath)
        if (files.includes("pnpm-lock.yaml")) {
            pm = "pnpm"
        } else if (files.includes("yarn.lock")) {
            pm = "yarn"
        } else if (files.includes("package-lock.json")) {
            pm = "npm"
        }
    } catch (err) {
        core.logger.error("<LibraryVue|install> 检测宿主项目锁文件失败，默认使用 bun 安装:", err)
    }

    core.logger.log(`<LibraryVue|install> 使用包管理器: ${chalk.green(pm)} 开始在输出目录安装依赖...`)

    let installCmd = ""
    if (pm === "bun") {
        installCmd = "bun install --no-lockfile"
    } else if (pm === "pnpm") {
        installCmd = "pnpm install --no-lockfile"
    } else if (pm === "yarn") {
        installCmd = "yarn install --no-lockfile"
    } else {
        installCmd = "npm install --no-package-lock"
    }

    let t0 = performance.now()
    try {
        const { stdout } = await execAsync(installCmd, { cwd: outputDir })
        let dt = performance.now() - t0
        core.logger.log(chalk.green(`<LibraryVue|install> 依赖安装成功！耗时: ${readableMs(dt)}`))
        if (stdout) {
            core.logger.debug("<LibraryVue|install> 安装输出:\n", stdout)
        }
    } catch (error: any) {
        core.logger.error(chalk.red("<LibraryVue|install> 依赖安装失败:"), error.message || error)
        if (error.stdout) {
            core.logger.error("<LibraryVue|install> 安装错误输出:\n", error.stdout)
        }
    }
}

/** 生成单个 CodeUnit */
async function generateCodeUnit(codeUnit: CodeUnit, core: StarmapCore) {
    const { unitPath } = codeUnit

    let t0 = performance.now()

    // 输出 /units/id/metadata.ts 文件
    const metadataTsPath = path.join(unitPath, "metadata.ts")
    outputTemplate("unit.metadata.ts.hbs", metadataTsPath, {
        mainComponentFsNode: !!codeUnit.mainComponentFsNode,
    })

    // 输出 /units/id/readme.vue 文件
    const readmeVuePath = path.join(unitPath, "readme.vue")
    await outputReadmeVue(codeUnit, readmeVuePath)

    // 输出 /units/id/unit.vue 文件
    let unitVueCode = await createUnitComponentCode(codeUnit)
    const unitVuePath = path.join(unitPath, "unit.vue")
    outputTemplate("unit.vue.hbs", unitVuePath, {
        codeUnit,
        unitVueCode,
    })

    let t1 = performance.now()
    let dt = t1 - t0
    core.logger.debug(`  _├_  _${readableMs(dt).padEnd(7)}_  output _unit.vue,metadata.ts_ `)

    // 输出 /units/id/vue-metadata.json 文件（如果存在主组件，且内容有变更）
    if (codeUnit.mainComponentFsNode) {
        try {
            const vueFilePath = codeUnit.mainComponentFsNode.fileFullPath
            const stat = await fs.stat(vueFilePath)
            const currentMtime = stat.mtimeMs
            const cachedMtime = vueDocgenMtimeCache.get(vueFilePath)

            if (cachedMtime !== currentMtime) {
                let t0 = performance.now()
                const vueDoc = await parse(vueFilePath)
                const vueMetadataPath = path.join(unitPath, "vue-metadata.json")
                outputFileWithCache(vueMetadataPath, JSON.stringify(vueDoc, null, 4))
                vueDocgenMtimeCache.set(vueFilePath, currentMtime)

                let dt = performance.now() - t0
                core.logger.debug(`  _├_  _${readableMs(dt).padEnd(7)}_  output _vue-metadata.json_`)
            }
        } catch {}
    }
}
