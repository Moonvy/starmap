import { IStarmapExtension } from "./extension/types"

export interface IStarmapConfig {
    /** 项目名，默认会从 package.json 的 name 字段中获取 */
    projectName?: string
    /** 项目根路径，默认当前工作目录 */
    rootPath?: string
    /** 项目根路径，`rootPath` 的别名 */
    srcDir?: string
    /** 输出目录，默认：`./node_modules/.starmap` */
    outputDir?: string
    /** 是否重新构建，删除缓存等 */
    rebuild?: boolean
    /** 扩展插件列表 */
    extensions?: IStarmapExtension[]
    /** 是否启用文件监控模式，默认为 true */
    watch?: boolean
    /** 构建后的网页输出目录 */
    buildDir?: string
    /** 是否是构建模式 */
    isBuild?: boolean

    /** 开发服务器端口，默认 3000 */
    port?: number
    /** 启动后是否自动打开浏览器 */
    openBrowser?: boolean

    /** 代码单元的树列表是否总是启用 sticky 吸顶效果
     *  默认：`false`，只有当前选中项的父级目录才有 sticky 吸顶效果
     */
    uiTreeDirAlwaysSticky?: boolean

    /** vite 配置 */
    viteConfig?: any
    /** vue 插件列表，会被当做 Vue 插件全局注册 */
    vuePlugins?: any[]
}
