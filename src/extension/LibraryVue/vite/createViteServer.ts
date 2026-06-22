import { createServer, UserConfig as ViteUserConfig, searchForWorkspaceRoot } from "vite"
import { StarmapCore } from "../../../core/StarmapCore"
import { getPackageRoot } from "../../../utils/packagePath"
import defaultViteConfig from "./vite.config"
import { merge, fmt } from "fzz"
import path from "node:path"
import fsex from "fs-extra"

/**
 * 创建并返回一个 Vite 开发服务器实例
 * @param options Vite 配置选项
 * @returns Vite 开发服务器实例与最终监听端口
 */
export async function createViteServer(options: { core: StarmapCore; viteConfig?: ViteUserConfig }): Promise<{
    /** Vite 开发服务器实例 */
    viteServer: any
    /** 最终的服务器监听端口 */
    port: number
}> {
    const starmapConfig = options.core.config
    const starmapPkgRoot = getPackageRoot()

    // 如果是 rebuild ，删除 node_modules/.starmap 和 node_modules/.vite
    if (starmapConfig.rebuild) {
        // .starmap 已经在 StarmapCore.rebuild() 中删除了，这里删除 .vite
        const viteCacheDir = path.resolve(starmapConfig.rootPath!, "node_modules", ".vite")
        await fsex.remove(viteCacheDir)
    }

    let coreViteConfig: ViteUserConfig = {
        server: {
            port: starmapConfig.port ?? 4070,
            open: starmapConfig.openBrowser,
        },
        root: starmapConfig.outputDir,
        optimizeDeps: {
            // 告诉 Vite 不要对 .starmap 进行依赖预构建（不进行强缓存）
            exclude: [".starmap"],
        },
    }

    let finViteConfig: ViteUserConfig = merge(
        {
            server: {
                fs: {
                    strict: false,
                    // 测试时还是 strict false 比较方便
                    // allow: [
                    //     starmapPkgRoot,
                    //     starmapConfig.outputDir,
                    //     searchForWorkspaceRoot(starmapConfig.outputDir!),
                    //     searchForWorkspaceRoot(starmapConfig.rootPath!),
                    //     searchForWorkspaceRoot(process.cwd()),
                    // ],
                },
            },
        },
        defaultViteConfig,
        coreViteConfig,
        options.core.config?.viteConfig || {},
        options.viteConfig || {},
    )

    // 合并多个 Vue 插件的 isCustomElement 回调，确保所有自定义元素判断都生效
    // mergeVueIsCustomElement(finViteConfig)

    // console.log("<LibraryVue|createViteServer> Final Vite Config:", finViteConfig)
    const viteServer = await createServer(finViteConfig)
    await viteServer.listen()

    let port = viteServer.config.server?.port ?? 0
    const addressInfo = viteServer.httpServer?.address()
    if (typeof addressInfo === "object" && addressInfo?.port) {
        port = addressInfo.port
    }

    console.log(...fmt(`<LibraryVue|createViteServer>`, `*http://localhost:${port}*\n\n`))
    return { viteServer, port }
}

/**
 * 合并 Vite 配置中多个 Vue 插件的 isCustomElement 回调
 * 当默认配置和用户配置都包含 Vue 插件时，merge 只会保留最后一个，
 * 此函数收集所有 Vue 插件的 isCustomElement 并合并为一个联合判断函数
 * @param config Vite 用户配置
 */
function mergeVueIsCustomElement(config: ViteUserConfig) {
    const plugins = (config.plugins ?? []).flat().filter(Boolean) as any[]

    // 查找所有 Vue 插件实例（@vitejs/plugin-vue 的 name 为 'vite:vue'）
    const vuePlugins = plugins.filter((p) => p?.name === "vite:vue")
    if (vuePlugins.length <= 1) return

    // 收集所有 isCustomElement 回调
    const fns: Array<(tag: string) => boolean> = []
    for (const vp of vuePlugins) {
        const fn = vp?.api?.options?.template?.compilerOptions?.isCustomElement
        if (typeof fn === "function") fns.push(fn)
    }
    if (fns.length <= 1) return

    // 合并为联合判断：任一回调返回 true 即视为自定义元素
    const merged = (tag: string) => fns.some((fn) => fn(tag))

    // 将合并后的回调设置到最后一个 Vue 插件上
    const last = vuePlugins[vuePlugins.length - 1]
    if (last?.api?.options?.template?.compilerOptions) {
        last.api.options.template.compilerOptions.isCustomElement = merged
    }
}
