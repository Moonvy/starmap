import path from "node:path"
import fs from "node:fs/promises"
import { CodeUnit } from "../../../core/Gen/CodeUnit"
import { outputFileWithCache } from "../../../utils/fs/outputFileWithCache"

/**
 * 单元生成缓存版本号
 * 渲染逻辑 / 模板变更时递增，强制失效旧 stamp
 */
export const UNIT_GEN_CACHE_VERSION = 2

/** 单元生成输入指纹（落盘到 unit 输出目录） */
export interface IUnitGenStamp {
    /** 缓存格式版本 */
    v: number
    /** 输入文件绝对路径 → mtimeMs */
    inputs: Record<string, number>
    /** readme @import 依赖路径，跳过生成时用于恢复热更新依赖 */
    deps: string[]
}

const STAMP_FILE = "gen-stamp.json"

/**
 * 获取 stamp 文件路径
 * @param unit CodeUnit
 */
export function getUnitGenStampPath(unit: CodeUnit): string {
    return path.join(unit.unitPath, STAMP_FILE)
}

/**
 * 安全读取文件 mtime，不存在返回 null
 * @param filePath 文件绝对路径
 */
async function safeMtime(filePath: string): Promise<number | null> {
    try {
        const stat = await fs.stat(filePath)
        return stat.mtimeMs
    } catch {
        return null
    }
}

/**
 * 收集当前 CodeUnit 的核心输入文件 mtime（不含 @import 依赖，依赖来自上次 stamp）
 * @param unit CodeUnit
 */
export async function collectUnitCoreInputMtimes(unit: CodeUnit): Promise<Record<string, number>> {
    const inputs: Record<string, number> = {}
    const paths = [unit.readmeFullPath]

    if (unit.mainComponentFsNode) {
        paths.push(unit.mainComponentFsNode.fileFullPath)
    }
    if (unit.indexCodeFsNode) {
        paths.push(unit.indexCodeFsNode.fileFullPath)
    }

    const mtimes = await Promise.all(paths.map((p) => safeMtime(p)))
    for (let i = 0; i < paths.length; i++) {
        if (mtimes[i] != null) {
            inputs[paths[i]] = mtimes[i]!
        }
    }
    return inputs
}

/**
 * 读取已有 stamp
 * @param unit CodeUnit
 */
export async function readUnitGenStamp(unit: CodeUnit): Promise<IUnitGenStamp | null> {
    try {
        const text = await fs.readFile(getUnitGenStampPath(unit), "utf-8")
        const data = JSON.parse(text) as IUnitGenStamp
        if (!data || data.v !== UNIT_GEN_CACHE_VERSION || !data.inputs) return null
        return data
    } catch {
        return null
    }
}

/**
 * 判断关键关键输出文件是否存在
 * @param unit CodeUnit
 */
async function unitOutputsExist(unit: CodeUnit): Promise<boolean> {
    const required = [
        path.join(unit.unitPath, "readme.vue"),
        path.join(unit.unitPath, "unit.vue"),
        path.join(unit.unitPath, "metadata.ts"),
    ]
    const flags = await Promise.all(
        required.map(async (p) => {
            try {
                await fs.access(p)
                return true
            } catch {
                return false
            }
        }),
    )
    return flags.every(Boolean)
}

/**
 * 判断 inputs 是否与 stamp 完全一致
 * @param current 当前 mtime 映射
 * @param stamped stamp 中的 mtime 映射
 */
function inputsMatch(current: Record<string, number>, stamped: Record<string, number>): boolean {
    const currentKeys = Object.keys(current)
    const stampedKeys = Object.keys(stamped)
    if (currentKeys.length !== stampedKeys.length) return false
    for (const key of currentKeys) {
        if (stamped[key] !== current[key]) return false
    }
    return true
}

/**
 * 若 unit 输出仍新鲜则可跳过重新生成
 *
 * 检查：stamp 版本、全部 inputs mtime（核心入口 + @import 依赖）、输出文件是否齐全
 *
 * @param unit CodeUnit
 * @returns 可跳过时返回 stamp（用于恢复 deps），否则 null
 */
export async function tryGetFreshUnitGenStamp(unit: CodeUnit): Promise<IUnitGenStamp | null> {
    const stamp = await readUnitGenStamp(unit)
    if (!stamp) return null

    if (!(await unitOutputsExist(unit))) return null

    // 当前核心入口必须都能对上 stamp（防止新增 index.ts / 主组件后仍命中旧缓存）
    const coreInputs = await collectUnitCoreInputMtimes(unit)
    for (const [filePath, mtime] of Object.entries(coreInputs)) {
        if (stamp.inputs[filePath] !== mtime) return null
    }

    // stamp 记录的所有输入文件 mtime 必须仍然一致
    const checkPaths = Object.keys(stamp.inputs)
    const checkMtimes = await Promise.all(checkPaths.map((p) => safeMtime(p)))
    for (let i = 0; i < checkPaths.length; i++) {
        if (checkMtimes[i] == null || checkMtimes[i] !== stamp.inputs[checkPaths[i]]) {
            return null
        }
    }

    return stamp
}

/**
 * 写入 unit 生成 stamp
 * @param unit CodeUnit
 * @param deps readme @import 依赖绝对路径
 */
export async function writeUnitGenStamp(unit: CodeUnit, deps: string[]): Promise<void> {
    const coreInputs = await collectUnitCoreInputMtimes(unit)
    const uniqueDeps = Array.from(new Set(deps.map((d) => path.resolve(d))))

    const depMtimes = await Promise.all(uniqueDeps.map((p) => safeMtime(p)))
    const inputs: Record<string, number> = { ...coreInputs }
    for (let i = 0; i < uniqueDeps.length; i++) {
        if (depMtimes[i] != null) {
            inputs[uniqueDeps[i]] = depMtimes[i]!
        }
    }

    const stamp: IUnitGenStamp = {
        v: UNIT_GEN_CACHE_VERSION,
        inputs,
        deps: uniqueDeps,
    }

    outputFileWithCache(getUnitGenStampPath(unit), JSON.stringify(stamp, null, 2))
}
