import path from "node:path"
import fsex from "fs-extra"

let packageRootCache: string | null = null

/**
 * 获取当前项目的根目录路径（即 package.json 所在的目录）
 * 不管是在源码运行（bun run try）还是在打包后（dist/cli.js）运行，都能准确获取
 * @returns 项目根目录的绝对路径
 */
export function getPackageRoot(): string {
    if (packageRootCache) return packageRootCache

    // 获取当前模块的目录，如果不存在则退化到 process.cwd()
    let current = import.meta.dirname || process.cwd()
    
    // 向上查找包含 package.json 的目录
    while (current) {
        if (fsex.existsSync(path.join(current, "package.json"))) {
            packageRootCache = current
            return current
        }
        const parent = path.dirname(current)
        if (parent === current) {
            break
        }
        current = parent
    }

    // 如果未找到，退化到当前进程的运行目录
    packageRootCache = process.cwd()
    return packageRootCache
}

/**
 * 获取 LibraryVue 插件的根目录绝对路径
 * @returns LibraryVue 根目录的绝对路径
 */
export function getLibraryVueRoot(): string {
    return path.join(getPackageRoot(), "src/extension/LibraryVue")
}
