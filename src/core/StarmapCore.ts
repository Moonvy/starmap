import { RawEvents, defineEvents, fmt, Logger } from "fzz"
import { FsTree } from "./FsTree"
import { IStarmapConfig } from "../config.type"
import { cwd } from "process"
import path from "node:path"
import fsex from "fs-extra"
import { StarmapCoreEventDefine, StarmapCoreEvents } from "./events"
import { Gen } from "./Gen/Gen"

import { LibraryVue } from "../extension/LibraryVue/LibraryVue"
import { IStarmapExtension } from "../extension/types"

/**
 * Starmap 核心实现
 */
export class StarmapCore {
    // 文件缓存系统
    fsTree!: FsTree
    // 生成器
    gen!: Gen
    // 事件中心
    eventHub!: RawEvents<typeof StarmapCoreEventDefine>
    /** 上下文 */
    ctx!: StarmapCoreCtx
    /** 配置 */
    config!: IStarmapConfig
    /** 日志记录器 */
    logger!: Logger

    /** 是否已初始化完成 */
    ready: Promise<any>
    constructor(config: IStarmapConfig) {
        this.logger = new Logger({}, { enableFmt: true })
        this.ready = this.init(config)
    }

    /**
     * 初始化 StarmapCore
     */
    async init(config?: IStarmapConfig) {
        this.ctx = {
            /** 当前工作目录，执行命令的目录 */
            cwd: cwd(),
        }

        // 初始化配置
        this.config = await initConfig(config || this.config)
        this.logger.log("<Starmap|init> config:", this.config)

        // 初始化事件中心
        this.eventHub = new RawEvents<typeof StarmapCoreEventDefine>()

        // 初始化文件系统
        this.fsTree = new FsTree(this.config.rootPath!, { watch: this.config.watch ?? true })

        // 初始化生成器
        // （包括实时更新监视）
        this.gen = new Gen(this)
        if (this.config.watch ?? true) {
            await this.gen.initWatch()
        }

        // 初始化插件
        let extensions: IStarmapExtension[] = [
            // 内置插件
            LibraryVue(),
            // 用户配置的插件
            ...(this.config.extensions || []),
        ]
        for (let extension of extensions) {
            await extension(this)
        }

        // 触发 inited 事件
        this.eventHub.emit(StarmapCoreEvents.inited)

        // Build -------------------------
        if (this.config.rebuild) {
            await this.rebuild()
        } else {
            await this.build()
        }

        this.eventHub.emit(StarmapCoreEvents.firstGenerateDone, { starmapCore: this })
    }

    /**
     * 触发构建
     */
    async build() {
        await this.gen.generate()
    }

    /** 重新构建 */
    async rebuild() {
        this.logger.log("<Starmap|rebuild> clearing cache and rebuilding...")
        // 1. 删除输出目录
        if (this.config.outputDir) {
            await fsex.remove(this.config.outputDir)
            await fsex.ensureDir(this.config.outputDir)
        }
        // 2. 清空生成器缓存
        this.gen.allUnits.clear()

        // 4. 执行构建
        await this.build()
    }

    /** 重启 StarmapCore */
    async restart() {}
}

/** 上下文 */
export interface StarmapCoreCtx {}

// -------------------------------

/**
 * 初始化配置
 */
async function initConfig(inputConfig: IStarmapConfig) {
    const { loadConfig } = await import("./lib/loadConfig")

    let cwdPath = path.join(inputConfig.rootPath ?? inputConfig.srcDir ?? cwd(), "config")
    const { config, configFile } = await loadConfig({
        cwd: cwdPath,
        name: "starmap",
        overrides: inputConfig,
        defaults: <any>{ _v1: 0 },
    })

    // console.log(">> c12:", { configFile, layers, config })
    if (configFile) {
        console.log(...fmt("<Starmap|configFile>", configFile))
    }

    if (!config.rootPath) {
        if (config.srcDir) {
            config.rootPath = config.srcDir
        } else {
            config.rootPath = cwd()
        }
    }

    if (config.buildDir) {
        config.buildDir = path.resolve(config.rootPath, config.buildDir)
    } else if (config.isBuild) {
        config.buildDir = path.resolve(config.rootPath, "dist")
    }

    if (!config.outputDir) {
        config.outputDir = path.resolve(config.rootPath, "node_modules", ".starmap")
        fsex.ensureDirSync(config.outputDir)
    }

    // console.log(...fmt("<Starmap|init> config 2:", { config }))

    return config
}
