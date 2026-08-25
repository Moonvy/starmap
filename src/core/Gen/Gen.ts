import { StarmapCore } from "../StarmapCore"
import { createUnitTree } from "./lib/createUnitTree"
import { findAllUnits } from "./lib/findAllUnits"
import { normalizeID } from "./lib/normalizeID"

import fsex from "fs-extra"
import path from "node:path"
import os from "node:os"
import { readableMs, cloneDeep } from "fzz"
import { CodeUnit } from "./CodeUnit"
import { StarmapCoreEvents } from "../events"
import { unitTreeToJSON } from "./lib/unitTreeToJSON"
import { createRootMetadata } from "./lib/createRootMetadata"
import { FsTree, FsEvents } from "../FsTree/FsTree"
import { debounce } from "es-toolkit"
import { outputFileWithCache, outputJsonWithCache } from "../../utils/fs/outputFileWithCache"
import { getStarmapDocPath } from "../../utils/getStarmapDocPath"
import { mapPool } from "../../utils/async/mapPool"
import { tryGetFreshUnitGenStamp } from "./lib/unitGenCache"
import chalk from "chalk"

/** 全量生成时 CodeUnit 的并发数：cache-hit 偏 IO，可适当提高上限 */
function getGenerateUnitConcurrency(): number {
    const cpuCount = os.cpus()?.length || 4
    return Math.max(4, Math.min(24, cpuCount * 2))
}

/** 生成器，从项目生成文档 */
export class Gen {
    allUnits = new AllCodeUnits()
    docFsTree?: FsTree

    /** 热更新串行队列：保证增量更新与全量重生成按顺序执行，避免并发写输出目录 / 互相交错 */
    private genQueue: Promise<void> = Promise.resolve()

    /** 依赖索引：readme @import 依赖的绝对路径 → 依赖它的 CodeUnit 集合（供热更新 O(1) 定位） */
    private depIndex = new Map<string, Set<CodeUnit>>()
    /** unit.id → 最近记录的依赖列表（绝对路径），用于增量维护 depIndex */
    private unitDepRecords = new Map<string, string[]>()

    constructor(public starmapCore: StarmapCore) {
        const docPath = getStarmapDocPath()
        if (docPath) {
            this.docFsTree = new FsTree(docPath, { watch: this.starmapCore.config.watch ?? true })
        }
    }

    /** 把热更新任务加入串行队列，队列内任务按序执行
     * @param task 要执行的任务
     */
    private enqueueGen(task: () => Promise<void>): Promise<void> {
        const run = this.genQueue.then(task)
        // 队列本身不因某个任务失败而中断；run 的 rejection 仍会传给调用者（await 可捕获），
        // 这里额外挂一个空 catch 防止调用方未处理时产生 unhandled rejection（调用方多为 fire-and-forget 事件处理器）
        run.catch(() => {})
        this.genQueue = run.then(
            () => undefined,
            () => undefined,
        )
        return run
    }

    /** 全量重建依赖索引（全量生成后调用，此时所有 unit 的依赖已恢复/更新完毕） */
    private rebuildDepIndex() {
        this.depIndex.clear()
        this.unitDepRecords.clear()
        for (const unit of this.allUnits.flat) {
            this.recordUnitDeps(unit, unit.readmeImportDependencyPaths)
        }
    }

    /** 增量更新某个 unit 的依赖索引（先移除旧记录，再写入新记录）
     * @param unit 代码单元
     * @param deps 新的依赖绝对路径列表
     */
    private recordUnitDeps(unit: CodeUnit, deps: string[]) {
        const oldDeps = this.unitDepRecords.get(unit.id)
        if (oldDeps) {
            for (const dep of oldDeps) {
                const set = this.depIndex.get(dep)
                if (set) {
                    set.delete(unit)
                    if (set.size === 0) this.depIndex.delete(dep)
                }
            }
        }

        const newDeps = Array.from(new Set(deps.map((dep) => path.resolve(dep))))
        this.unitDepRecords.set(unit.id, newDeps)
        for (const dep of newDeps) {
            let set = this.depIndex.get(dep)
            if (!set) {
                set = new Set()
                this.depIndex.set(dep, set)
            }
            set.add(unit)
        }
    }
    /**
     * 完整生成文档
     */
    async generate() {
        // 扫描所有代码单元
        let t0 = performance.now()
        let units = await findAllUnits(this.starmapCore.fsTree, this)
        let t_scan = performance.now()
        let dt_scan = t_scan - t0
        this.starmapCore.logger.debug(
            `<Starmap|Gen> Scan Units: _${readableMs(dt_scan)}_,  found *${units.length}* units.`,
        )

        // 添加所有代码单元（生成树结构）
        this.allUnits.setUnits(units)

        // 通知插件全量生成开始（可用于清理轮次级缓存）
        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generate, {
            gen: this,
            starmapCore: this.starmapCore,
        })

        // 收集生成中的错误
        const errors: { unitId: string; error: Error }[] = []

        // 并发生成代码单元（各 unit 输出路径互不冲突，可安全并行）
        const concurrency = getGenerateUnitConcurrency()
        let t_units0 = performance.now()
        let skippedCount = 0
        let generatedCount = 0
        await mapPool(this.allUnits.flat, concurrency, async (unit) => {
            try {
                const result = await this.generateUnit(unit)
                if (result === "skipped") skippedCount++
                else generatedCount++
            } catch (err: any) {
                errors.push({ unitId: unit.id, error: err })
                this.starmapCore.logger.error(
                    `\n${chalk.red.bold("✖")} [CodeUnit: ${unit.id}] 生成失败!\n` +
                        `${chalk.red(err.stack || err.message || err)}\n`
                )
            }
        })
        let dt_units = performance.now() - t_units0
        this.starmapCore.logger.debug(
            `<Starmap|Gen> Generate Units: _${readableMs(dt_units)}_, concurrency *${concurrency}*, ` +
                `generated *${generatedCount}*, skipped *${skippedCount}*`,
        )

        // 重建依赖索引（供热更新时快速定位 @import 依赖方，此时所有 unit 依赖已恢复/更新）
        this.rebuildDepIndex()

        // 生成完成事件
        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateEnd, {
            gen: this,
            starmapCore: this.starmapCore,
        })

        // 生成代码单元树
        await this.generateTree()

        // 生成项目元数据
        await this.generateRootMetadata()

        let dt_done = performance.now() - t0
        this.starmapCore.logger.log(
            `<Starmap|Gen> Generate Done: _${readableMs(dt_done)}_,  total *${this.allUnits.flat.length}* units.`,
        )

        if (errors.length > 0 && !this.starmapCore.config.watch) {
            throw new Error(`构建完成，但有 ${errors.length} 个代码单元生成失败。`)
        }

        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateDone, {
            gen: this,
            starmapCore: this.starmapCore,
        })
    }

    /**
     * 生成单个代码单元的文件
     * @param options.force 是否强制重新生成，忽略缓存
     * @returns skipped 表示命中增量缓存未重生成；generated 表示实际执行了生成
     */
    async generateUnit(
        unit: CodeUnit,
        options?: { force?: boolean },
    ): Promise<"skipped" | "generated"> {
        let t0 = performance.now()

        // cache-hit 热路径：在写 code-unit.json / 触发插件之前短路，避免 402 个 unit 的无用 IO 与日志
        if (!options?.force) {
            const freshStamp = await tryGetFreshUnitGenStamp(unit)
            if (freshStamp) {
                unit.readmeImportDependencyPaths = freshStamp.deps || []
                // 仅在极细粒度需要时再打开；全量 400+ unit 时逐条日志本身就是瓶颈
                this.starmapCore.logger.debug(`<Starmap|GenUnit> *${unit.id.padEnd(18)}* skipped`)
                return "skipped"
            }
        }

        this.starmapCore.logger.debug(`<Starmap|GenUnit> *${unit.id.padEnd(18)}* `)
        outputJsonWithCache(path.join(unit.unitPath, "code-unit.json"), unit)
        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateUnit, {
            codeUnit: unit,
            gen: this,
            starmapCore: this.starmapCore,
            force: options?.force,
        })

        let t1 = performance.now()
        let dt = t1 - t0

        this.starmapCore.logger.debug(`  _└_  ${readableMs(dt)}`)
        return "generated"
    }

    /**
     * 生成代码单元树文件
     * @param options.emit 是否触发 generateTree 事件（会驱动 LibraryVue 重写 router 等根文件）。
     *                     热更新仅改标题/图标等数据时应为 false，只写 JSON，交给 Vite HMR，避免整页刷新
     */
    async generateTree(options?: { emit?: boolean }) {
        const outputDir = path.join(this.starmapCore.config.outputDir!)
        const emit = options?.emit !== false

        outputJsonWithCache(path.join(outputDir, "units-tree.json"), unitTreeToJSON(this.allUnits.tree))
        outputJsonWithCache(path.join(outputDir, "units-flat.json"), this.allUnits.flat)

        if (emit) {
            await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateTree, {
                gen: this,
                starmapCore: this.starmapCore,
            })
        }
    }

    /** 生成项目元数据 */
    async generateRootMetadata() {
        const outputDir = path.join(this.starmapCore.config.outputDir!)

        let rootMetadata = createRootMetadata(this.starmapCore)

        outputJsonWithCache(path.join(outputDir, "root-metadata.json"), rootMetadata)
    }

    // ---------------------------------
    // 用于热更新
    // ---------------------------------

    /** 更新生成，单个代码单元（热更新路径） */
    async _updateGenUnit(unit: CodeUnit) {
        try {
            let oldId = unit.id
            let oldMetadata = JSON.stringify(unit.metadata)

            // 重新读取 metadata（FsNode 缓存已由 FsTree 失效）
            await unit.init()

            // 检查 id 是否变化，如果 id 变化直接去全部重新生成
            if (unit.id !== oldId) {
                this.starmapCore.logger.log(
                    `<Starmap|Watch> unit.id 变化 (*${oldId}* → *${unit.id}*)，触发全量重新生成`,
                )
                await this.generate()
                return
            }

            // 热更新路径：已知输入已变，强制重新生成，避免 stamp / mtime 竞态导致跳过
            // 只会重写该 unit 的 readme.vue / code-unit.json 等，由 Vite 对 Vue SFC 做 HMR
            await this.generateUnit(unit, { force: true })

            // 同步依赖索引（generateUnit 已恢复/更新 @import 依赖列表）
            this.recordUnitDeps(unit, unit.readmeImportDependencyPaths)

            // 标题/图标/排序等 metadata 变化时，只更新 units-tree.json 等数据文件（不 emit generateTree）
            // 避免 generateCodeRoot 重写 entry（metadata.ts / router.ts）导致 Vite 整页刷新
            if (JSON.stringify(unit.metadata) !== oldMetadata) {
                this.starmapCore.logger.debug(
                    `<Starmap|Watch> unit metadata 变化，热更新目录树数据: *${unit.id}*`,
                )
                await this._updateGenTree({ refreshRootCode: false })
            }
        } catch (err: any) {
            this.starmapCore.logger.error(
                `\n${chalk.red.bold("✖")} 更新 CodeUnit 失败: *${unit.id}*\n` +
                    `${chalk.red(err.stack || err.message || err)}\n`
            )
        }
    }

    /** 更新生成，重新生成单元目录树和 root 元数据，但不会重新全部生成代码单元
     * @param options.refreshRootCode 是否触发 generateTree 事件以重写 router / 根模板。
     *                                新增/删除 unit 等结构变化需要 true；仅 metadata 文案变化应为 false（纯 HMR）
     */
    async _updateGenTree(options?: { refreshRootCode?: boolean }) {
        const refreshRootCode = options?.refreshRootCode !== false
        await this.generateTree({ emit: refreshRootCode })
        await this.generateRootMetadata()
    }

    /** 更新生成，新增代码单元，会重新生成单元目录树，但不会重新生成代码单元 */
    async _updateGenNewUnit(fullPath: string) {
        try {
            let readmeNode = this.starmapCore.fsTree.getOrCreateNode(fullPath)
            if (!readmeNode) return
            const unit = new CodeUnit(readmeNode, this)
            await unit.ready
            this.allUnits.addUnit(unit)
            await this.generateUnit(unit)
            // 同步依赖索引
            this.recordUnitDeps(unit, unit.readmeImportDependencyPaths)
            // 结构变化：需要刷新 router 等根文件
            await this._updateGenTree({ refreshRootCode: true })
        } catch (err: any) {
            this.starmapCore.logger.error(
                `\n${chalk.red.bold("✖")} 新增 CodeUnit 失败: _${fullPath}_\n` +
                    `${chalk.red(err.stack || err.message || err)}\n`
            )
        }
    }

    /** 初始化监听，监听文件系统变化并增量更新 CodeUnit */
    async initWatch() {
        const logger = this.starmapCore.logger

        // 每个 CodeUnit 独立的 debounce 更新函数，避免批量保存时重复触发
        const unitUpdateMap = new Map<string, ReturnType<typeof debounce>>()

        /** 获取或创建某个 CodeUnit 的 debounced 更新函数 */
        const getDebouncedUnitUpdate = (unit: CodeUnit) => {
            let fn = unitUpdateMap.get(unit.id)
            if (!fn) {
                fn = debounce(async () => {
                    logger.log(`<Starmap|Watch> 🔄 重新生成 CodeUnit: *${unit.id}*`)
                    // 串行队列：同一时间只执行一个生成任务，避免自动保存连发时重叠生成
                    await this.enqueueGen(() => this._updateGenUnit(unit))
                }, 300)
                unitUpdateMap.set(unit.id, fn)
            }
            return fn
        }

        const attachWatchEvents = (fsEvent: typeof this.starmapCore.fsTree.fsEvent, isDocTree: boolean) => {
            const isUnitEntryPath = (relativePath: string) => {
                const fileName = path.basename(relativePath).toLowerCase()
                if (isDocTree) {
                    return fileName.endsWith(".md")
                }
                return fileName === "readme.md"
            }
            const isSkipFilePath = (relativePath: string) => {
                return path.basename(relativePath).toLowerCase() === ".starmap-skip"
            }

            fsEvent.on(FsEvents.add, async (event) => {
                if (isSkipFilePath(event.relativePath)) {
                    logger.log(`<Starmap|Watch> 🔁 .starmap-skip 新增 → 触发全量重新生成`)
                    generateDebounced()
                    return
                }

                if (isUnitEntryPath(event.relativePath)) {
                    // 新增入口文件 → 创建新的 CodeUnit
                    logger.log(`<Starmap|Watch> ✨ 新增 CodeUnit: _${event.relativePath}_`)
                    await this.enqueueGen(() => this._updateGenNewUnit(event.fullPath))
                    return
                }

                // 非 readme 文件新增到已有 CodeUnit 目录，触发该 CodeUnit 重新生成
                const dependentUnits = findUnitsByImportDependency(event.fullPath)
                for (const unit of dependentUnits) {
                    logger.debug(`<Starmap|Watch> 🔗 依赖文件新增: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }

                const unit = findUnitByFilePath(event.relativePath)
                if (unit && !dependentUnits.includes(unit)) {
                    logger.debug(`<Starmap|Watch> 📄 文件新增: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }
            })

            fsEvent.on(FsEvents.update, async (event) => {
                if (isSkipFilePath(event.relativePath)) {
                    logger.log(`<Starmap|Watch> 🔁 .starmap-skip 变更 → 触发全量重新生成`)
                    generateDebounced()
                    return
                }

                if (isUnitEntryPath(event.relativePath)) {
                    // 入口文件变化 → 更新对应的 CodeUnit（防抖 + 串行，避免自动保存连发多次重叠生成）
                    const unit = findUnitByEntryPath(event.relativePath)
                    if (unit) {
                        logger.log(`<Starmap|Watch> 📝 readme 变更: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                        getDebouncedUnitUpdate(unit)()
                    }
                    return
                }

                // 非 readme 文件变化：查找所属的 CodeUnit 并触发重新生成
                const dependentUnits = findUnitsByImportDependency(event.fullPath)
                for (const unit of dependentUnits) {
                    logger.debug(`<Starmap|Watch> 🔗 依赖文件变更: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }

                const unit = findUnitByFilePath(event.relativePath)
                if (unit && !dependentUnits.includes(unit)) {
                    logger.debug(`<Starmap|Watch> 📄 文件变更: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }
            })

            fsEvent.on(FsEvents.delete, async (event) => {
                if (isSkipFilePath(event.relativePath)) {
                    logger.log(`<Starmap|Watch> 🔁 .starmap-skip 删除 → 触发全量重新生成`)
                    generateDebounced()
                    return
                }

                if (isUnitEntryPath(event.relativePath)) {
                    // 入口文件被删除 → 移除对应 CodeUnit，重新生成全部
                    const unit = findUnitByEntryPath(event.relativePath)
                    if (unit) {
                        logger.log(`<Starmap|Watch> 🗑️ readme 删除: _${event.relativePath}_ → 触发全量重新生成`)
                        generateDebounced()
                    }
                    return
                }

                // 非 readme 文件删除：触发所属 CodeUnit 重新生成
                const dependentUnits = findUnitsByImportDependency(event.fullPath)
                for (const unit of dependentUnits) {
                    logger.debug(`<Starmap|Watch> 🔗 依赖文件删除: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }

                const unit = findUnitByFilePath(event.relativePath)
                if (unit && !dependentUnits.includes(unit)) {
                    logger.debug(`<Starmap|Watch> 🗑️ 文件删除: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                    getDebouncedUnitUpdate(unit)()
                }
            })

            // ---- 删除目录 ----
            fsEvent.on(FsEvents.deleteDir, async (event) => {
                // 查找所有在被删除目录下的 CodeUnit
                const deletedDirPath = event.relativePath
                const unitsToRemove = this.allUnits.flat.filter((unit) => {
                    return unit.dirPath === deletedDirPath || unit.dirPath.startsWith(deletedDirPath + "/")
                })
                if (unitsToRemove.length > 0) {
                    logger.log(
                        `<Starmap|Watch> 🗑️ 目录删除: _${deletedDirPath}_ → 影响 *${unitsToRemove.length}* 个 CodeUnit，触发全量重新生成`,
                    )
                    generateDebounced()
                }
            })
        }

        attachWatchEvents(this.starmapCore.fsTree.fsEvent, false)
        if (this.docFsTree) {
            attachWatchEvents(this.docFsTree.fsEvent, true)
        }

        // ---- 辅助函数 ----

        /**
         * 根据入口文件路径查找对应的 CodeUnit
         */
        const findUnitByEntryPath = (relativePath: string): CodeUnit | undefined => {
            return this.allUnits.getByReadmePath(relativePath)
        }

        /**
         * 根据任意文件路径查找其直接所属的 CodeUnit
         * 从文件所在目录开始逐级向上查找，直到找到匹配的 CodeUnit 或到达根目录
         */
        const findUnitByFilePath = (relativePath: string): CodeUnit | undefined => {
            let dirPath = path.dirname(relativePath)
            // 逐级向上查找，直到找到匹配的 CodeUnit 或到达根目录
            while (dirPath && dirPath !== ".") {
                const unit = this.allUnits.getByPath(dirPath)
                if (unit) return unit
                const parentDir = path.dirname(dirPath)
                if (parentDir === dirPath) break // 到达根目录
                dirPath = parentDir
            }
            // 检查根目录（dirPath === "."）
            return this.allUnits.getByPath(".")
        }

        /**
         * 根据 readme 中 @import 的依赖文件查找需要重新生成的 CodeUnit
         * 通过依赖索引 O(1) 定位，避免每次文件变化都全表扫描
         */
        const findUnitsByImportDependency = (fullPath: string): CodeUnit[] => {
            const normalizedFullPath = path.resolve(fullPath)
            return Array.from(this.depIndex.get(normalizedFullPath) ?? [])
        }

        /** 全量重新生成（debounced） */
        const generateDebounced = debounce(async () => {
            logger.log(`<Starmap|Watch> 🔁 执行全量重新生成`)
            try {
                await this.enqueueGen(() => this.generate())
            } catch (err: any) {
                logger.error(
                    `\n${chalk.red.bold("✖")} 热更新全量重新生成失败!\n` +
                        `${chalk.red(err.stack || err.message || err)}\n`
                )
            }
        }, 300)
    }
}

class AllCodeUnits {
    flat: CodeUnit[] = []
    tree: CodeUnit[] = []
    map: Map<string, CodeUnit> = new Map()
    /** dirPath（规范化）→ CodeUnit，O(1) 定位所属单元 */
    dirPathMap: Map<string, CodeUnit> = new Map()
    /** readme 相对路径（规范化）→ CodeUnit，O(1) 定位入口单元 */
    readmePathMap: Map<string, CodeUnit> = new Map()

    /** 清空所有缓存的 CodeUnit 数据 */
    clear() {
        this.flat = []
        this.tree = []
        this.map.clear()
        this.dirPathMap.clear()
        this.readmePathMap.clear()
    }

    /** 设置代码单元列表，会重建 tree 和 map
     * @param flatUnits 扁平化的 CodeUnit 列表
     */
    setUnits(flatUnits: CodeUnit[]) {
        this.flat = [...flatUnits]
        this.map.clear()
        this.dirPathMap.clear()
        this.readmePathMap.clear()

        for (const unit of this.flat) {
            this.map.set(unit.id, unit)
            // 同目录多个 readme（readme.md + README.md）时保持与 flat.find 一致：先到先得
            const dirKey = normalizeUnitPath(unit.dirPath)
            if (!this.dirPathMap.has(dirKey)) {
                this.dirPathMap.set(dirKey, unit)
            }
            this.readmePathMap.set(normalizeUnitPath(unit.readmePath), unit)
        }

        this.tree = createUnitTree(this.flat)
    }

    /** 通过 ID 删除 CodeUnit
     * @param id CodeUnit ID
     */
    deleteById(id: string) {
        const target = this.map.get(id)
        if (!target) return

        this.map.delete(id)
        this.flat = this.flat.filter((unit) => unit.id !== id)
        const dirKey = normalizeUnitPath(target.dirPath)
        if (this.dirPathMap.get(dirKey) === target) {
            this.dirPathMap.delete(dirKey)
        }
        this.readmePathMap.delete(normalizeUnitPath(target.readmePath))
        this.tree = createUnitTree(this.flat)
    }

    /** 添加 CodeUnit，会增量重建 tree 和 map
     * @param unit 新的 CodeUnit
     */
    addUnit(unit: CodeUnit) {
        this.flat.push(unit)
        this.map.set(unit.id, unit)
        const dirKey = normalizeUnitPath(unit.dirPath)
        if (!this.dirPathMap.has(dirKey)) {
            this.dirPathMap.set(dirKey, unit)
        }
        this.readmePathMap.set(normalizeUnitPath(unit.readmePath), unit)
        this.tree = createUnitTree(this.flat)
    }

    /** 通过路径获取 CodeUnit
     * @param path 代码单元目录路径（相对项目路径）
     */
    getByPath(path: string): CodeUnit | undefined {
        return this.dirPathMap.get(normalizeUnitPath(path))
    }

    /** 通过入口文件路径获取 CodeUnit
     * @param readmePath 入口文件路径（相对项目路径）
     */
    getByReadmePath(readmePath: string): CodeUnit | undefined {
        return this.readmePathMap.get(normalizeUnitPath(readmePath))
    }

    /** 通过 ID 获取 CodeUnit
     * @param id CodeUnit ID
     */
    getById(id: string): CodeUnit | undefined {
        return this.map.get(id)
    }

    /** 获取一个新 ID，可以提供一个预期的 ID，如果预期 ID 和现有的 ID 冲突会自动添加后缀
     * @param expectedId 预期 ID
     */
    getNewId(expectedId?: string): string {
        const baseId = normalizeID(expectedId ?? "unit")
        if (!this.map.has(baseId)) return baseId

        let index = 2
        let nextId = `${baseId}-${index}`
        while (this.map.has(nextId)) {
            index += 1
            nextId = `${baseId}-${index}`
        }

        return nextId
    }
}

/** 路径规范化：统一为 / 分隔（Windows 反斜杠转正斜杠） */
function normalizeUnitPath(inputPath: string): string {
    return inputPath.split("\\").join("/")
}
