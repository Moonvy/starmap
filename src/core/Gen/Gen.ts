import { StarmapCore } from "../StarmapCore"
import { createUnitTree } from "./lib/createUnitTree"
import { findAllUnits } from "./lib/findAllUnits"
import { normalizeID } from "./lib/normalizeID"

import fsex from "fs-extra"
import path from "node:path"
import { readableMs, cloneDeep } from "fzz"
import { CodeUnit } from "./CodeUnit"
import { StarmapCoreEvents } from "../events"
import { unitTreeToJSON } from "./lib/unitTreeToJSON"
import { createRootMetadata } from "./lib/createRootMetadata"
import { FsTree, FsEvents } from "../FsTree/FsTree"
import { debounce } from "es-toolkit"
import { outputFileWithCache, outputJsonWithCache } from "../../utils/fs/outputFileWithCache"
import { getStarmapDocPath } from "../../utils/getStarmapDocPath"

/** 生成器，从项目生成文档 */
export class Gen {
    allUnits = new AllCodeUnits()
    docFsTree?: FsTree

    constructor(public starmapCore: StarmapCore) {
        const docPath = getStarmapDocPath()
        if (docPath) {
            this.docFsTree = new FsTree(docPath, { watch: this.starmapCore.config.watch ?? true })
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

        // 逐个生成代码单元
        for (let unit of this.allUnits.flat) {
            await this.generateUnit(unit)
        }

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

        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateDone, {
            gen: this,
            starmapCore: this.starmapCore,
        })
    }

    /**
     * 生成单个代码单元的文件
     * @param options.force 是否强制重新生成，忽略缓存
     */
    async generateUnit(unit: CodeUnit, options?: { force?: boolean }) {
        let t0 = performance.now()
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
    }

    /**
     * 生成代码单元树文件
     */
    async generateTree() {
        const outputDir = path.join(this.starmapCore.config.outputDir!)

        outputJsonWithCache(path.join(outputDir, "units-tree.json"), unitTreeToJSON(this.allUnits.tree))
        outputJsonWithCache(path.join(outputDir, "units-flat.json"), this.allUnits.flat)

        await this.starmapCore.eventHub.emitAsync(StarmapCoreEvents.generateTree, {
            gen: this,
            starmapCore: this.starmapCore,
        })
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

    /** 更新生成，单个代码单元 */
    async _updateGenUnit(unit: CodeUnit) {
        let oldId = unit.id
        let oldMetadata = JSON.stringify(unit.metadata)

        // 重新读取 metadata（FsNode 缓存已由 FsTree 失效）
        await unit.init()

        // 检查 id 是否变化，如果 id 变化直接去全部重新生成
        if (unit.id !== oldId) {
            console.log(">>> unit.id changed, regenerate all")
            await this.generate()
            return
        }
        // 重新生成代码单元
        await this.generateUnit(unit)

        // 更改了元数据（图标、标题等需要更新目录树）
        if (JSON.stringify(unit.metadata) !== oldMetadata) {
            console.log(">>> unit metadata changed, regenerate tree")
            await this._updateGenTree()
        }
    }

    /** 更新生成，重新生成单元目录树和 root 元数据，但不会重新全部生成代码单元 */
    async _updateGenTree() {
        await this.generateTree()
        await this.generateRootMetadata()
    }

    /** 更新生成，新增代码单元，会重新生成单元目录树，但不会重新生成代码单元 */
    async _updateGenNewUnit(fullPath: string) {
        let readmeNode = this.starmapCore.fsTree.getOrCreateNode(fullPath)
        if (!readmeNode) return
        const unit = new CodeUnit(readmeNode, this)
        await unit.ready
        this.allUnits.addUnit(unit)
        await this.generateUnit(unit)
        await this._updateGenTree()
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
                    await this._updateGenUnit(unit)
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
            fsEvent.on(FsEvents.add, async (event) => {
                if (isUnitEntryPath(event.relativePath)) {
                    // 新增入口文件 → 创建新的 CodeUnit
                    logger.log(`<Starmap|Watch> ✨ 新增 CodeUnit: _${event.relativePath}_`)
                    await this._updateGenNewUnit(event.fullPath)
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
                if (isUnitEntryPath(event.relativePath)) {
                    // 入口文件变化 → 直接更新对应的 CodeUnit
                    const unit = findUnitByEntryPath(event.relativePath)
                    if (unit) {
                        logger.log(`<Starmap|Watch> 📝 readme 变更: _${event.relativePath}_ → CodeUnit *${unit.id}*`)
                        await this._updateGenUnit(unit)
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
         */
        const findUnitsByImportDependency = (fullPath: string): CodeUnit[] => {
            const normalizedFullPath = path.resolve(fullPath)
            return this.allUnits.flat.filter((unit) => {
                return unit.readmeImportDependencyPaths.some((dependencyPath) => {
                    return path.resolve(dependencyPath) === normalizedFullPath
                })
            })
        }

        /** 全量重新生成（debounced） */
        const generateDebounced = debounce(async () => {
            logger.log(`<Starmap|Watch> 🔁 执行全量重新生成`)
            await this.generate()
        }, 300)
    }
}

class AllCodeUnits {
    flat: CodeUnit[] = []
    tree: CodeUnit[] = []
    map: Map<string, CodeUnit> = new Map()

    /** 清空所有缓存的 CodeUnit 数据 */
    clear() {
        this.flat = []
        this.tree = []
        this.map.clear()
    }

    /** 设置代码单元列表，会重建 tree 和 map
     * @param flatUnits 扁平化的 CodeUnit 列表
     */
    setUnits(flatUnits: CodeUnit[]) {
        this.flat = [...flatUnits]
        this.map.clear()

        for (const unit of this.flat) {
            this.map.set(unit.id, unit)
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
        this.tree = createUnitTree(this.flat)
    }

    /** 添加 CodeUnit，会增量重建 tree 和 map
     * @param unit 新的 CodeUnit
     */
    addUnit(unit: CodeUnit) {
        this.flat.push(unit)
        this.map.set(unit.id, unit)
        this.tree = createUnitTree(this.flat)
    }

    /** 通过路径获取 CodeUnit
     * @param path 代码单元目录路径（相对项目路径）
     */
    getByPath(path: string): CodeUnit | undefined {
        const normalizedPath = path.split("\\").join("/")
        return this.flat.find((unit) => unit.dirPath === normalizedPath)
    }

    /** 通过入口文件路径获取 CodeUnit
     * @param readmePath 入口文件路径（相对项目路径）
     */
    getByReadmePath(readmePath: string): CodeUnit | undefined {
        const normalizedPath = readmePath.split("\\").join("/")
        return this.flat.find((unit) => unit.readmePath === normalizedPath)
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
