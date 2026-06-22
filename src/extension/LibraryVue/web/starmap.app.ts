import { createApp } from "vue"

import "./style"

import Root from "./pages/Root.vue"
import PageTabs from "./components/PageTabs/PageTabs.vue"
import PageTab from "./components/PageTabs/PageTab.vue"
import PageHeader from "./components/PageHeader/PageHeader.vue"
import MarkdownWrap from "./components/MarkdownWrap/MarkdownWrap.vue"
import { registerMarkdownComponents } from "./components/MarkdownWrap"

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
            vueApp.component(name, component)
        }
    }

    // 由 root.html 引入的 router.ts 挂载
    const router = window.__starmap__?.__vue_router__
    vueApp.use(router)

    // 挂载
    vueApp.mount(rootEl)
    return vueApp
}
