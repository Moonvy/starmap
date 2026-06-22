import path from "node:path"
import fsex from "fs-extra"
import { StarmapCore } from "../../StarmapCore"

export type RootMetadata = ReturnType<typeof createRootMetadata>

/**
 * 创建根节点的元数据，包含项目名称及 UI 配置
 * @param starmapCore Starmap 核心实例
 */
export function createRootMetadata(starmapCore: StarmapCore) {
    let projectName = getProjectName(starmapCore.config)
    /** 树列表是否总是启用 sticky 吸顶效果 */
    let uiTreeDirAlwaysSticky = starmapCore.config.uiTreeDirAlwaysSticky ?? false
    return { projectName, uiTreeDirAlwaysSticky }
}

/**
 * 根据优先级获取项目名称
 * 优先级为：
 * 0. 配置中的 projectName
 * 1. 从项目 rootPath 目录下的 package.json 获取 name 字段
 * 2. 从 rootPath 的文件夹名称获取
 * @param config Starmap 配置项
 */
export function getProjectName(config: { projectName?: string; rootPath?: string }): string {
    let projectName = config.projectName

    if (!projectName) {
        // 尝试从项目根目录的 package.json 中读取 name
        try {
            const packageJsonPath = path.join(config.rootPath!, "package.json")
            if (fsex.existsSync(packageJsonPath)) {
                const packageJson = fsex.readJsonSync(packageJsonPath)
                if (packageJson && typeof packageJson.name === "string" && packageJson.name.trim() !== "") {
                    projectName = packageJson.name.trim()
                }
            }
        } catch (error) {
            // 忽略读取 package.json 的错误，退化到使用文件夹名称
        }
    }

    if (!projectName) {
        // 退化方案：从 rootPath 的文件夹名获取
        projectName = path.basename(config.rootPath!)
    }

    return projectName
}
