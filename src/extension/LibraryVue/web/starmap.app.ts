import { createApp, defineAsyncComponent } from "vue"

import "./style/index.ts"

import Root from "./pages/Root.vue"
import PageTabs from "./components/PageTabs/PageTabs.vue"
import PageTab from "./components/PageTabs/PageTab.vue"
import PageHeader from "./components/PageHeader/PageHeader.vue"
import MarkdownWrap from "./components/MarkdownWrap/MarkdownWrap.vue"
import { registerMarkdownComponents } from "./components/MarkdownWrap/index.ts"

main()

async function main() {
    await createStarmapApp()
}

/**
 * 创建并挂载 Starmap 的 Vue 应用
 * 使用 vue-router 管理路由，Root.vue 作为唯一根组件
 */
async function createStarmapApp() {
    const rootEl = document.querySelector("#startmap-app-root")
    if (!rootEl) {
        throw new Error(`[Starmap] 找不到挂载节点: #startmap-app-root`)
    }

    const vueApp = createApp(Root)

    // 注册全局组件
    vueApp.component("StarmapPageTabs", PageTabs)
    vueApp.component("StarmapPageTab", PageTab)
    vueApp.component("StarmapPageHeader", PageHeader)
    vueApp.component("StarmapMarkdownWrap", MarkdownWrap)

    registerMarkdownComponents(vueApp)

    const globalComponents = window.__starmap__?.__global_components__
    if (globalComponents) {
        for (const { name, component } of globalComponents) {
            vueApp.component(name, defineAsyncComponent(component))
        }
    }

    // 由 root.html 引入的 router.ts 挂载
    const router = window.__starmap__?.__vue_router__
    if (router) {
        vueApp.use(router)
    }

    // 挂载用户配置中的 Vue 插件
    const userConfig = window.__starmap__?.__user_config__
    const vuePlugins = window.__starmap__?.__vue_plugins__ || userConfig?.vuePlugins
    if (Array.isArray(vuePlugins)) {
        for (const plugin of vuePlugins) {
            if (Array.isArray(plugin)) {
                vueApp.use(plugin[0], ...plugin.slice(1))
            } else if (plugin) {
                vueApp.use(plugin)
            }
        }
    }

    // 执行用户配置的 onVueInit 回调（支持异步操作）
    const onVueInit = window.__starmap__?.__on_vue_init__ || userConfig?.onVueInit
    if (typeof onVueInit === "function") {
        const routePath = router?.currentRoute?.value?.path || window.location.pathname || "/"
        await onVueInit(vueApp, routePath)
    }

    // 挂载
    vueApp.mount(rootEl)
    return vueApp
}
