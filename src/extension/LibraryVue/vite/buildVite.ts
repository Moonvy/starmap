import { build as viteBuild, UserConfig as ViteUserConfig } from "vite"
import { StarmapCore } from "../../../core/StarmapCore"
import defaultViteConfig from "./vite.config"
import { merge } from "fzz"
import path from "node:path"

/**
 * 编译 Vite 产物到指定的 buildDir 目录
 * @param options 构建配置项，包含 StarmapCore 实例
 */
export async function buildVite(options: { core: StarmapCore }) {
    const starmapConfig = options.core.config

    let coreViteConfig: ViteUserConfig = {
        root: starmapConfig.outputDir,
        base: "./", // 使用相对路径以支持部署在子目录如 GitHub Pages
        build: {
            outDir: path.resolve(starmapConfig.buildDir!),
            emptyOutDir: true, // 构建前清空目标目录
        },
    }

    let finViteConfig: ViteUserConfig = merge(
        defaultViteConfig,
        coreViteConfig,
        options.core.config?.viteConfig || {},
    )

    options.core.logger.log("<LibraryVue|buildVite> 开始执行 Vite 编译打包...")
    
    // 执行 Vite 构建编译
    await viteBuild(finViteConfig)
    
    options.core.logger.log("<LibraryVue|buildVite> Vite 编译打包完成！")
}
