// typescript 定义全局变量 __starmap__
interface Window {
    __starmap__: {
        codeUnit: import("../../../core/Gen/CodeUnit.type").CodeUnitJSON
        unitsFlat: import("../../../core/Gen/CodeUnit.type").CodeUnitJSON[]
        unitsTree: import("../../../core/Gen/CodeUnit.type").CodeUnitJSON[]
        rootMetadata: import("../../../core/Gen/CodeUnit.type").RootMetadata
        vueMetadata: import("vue-docgen-api").ComponentDoc | null

        __vue_router__: import("vue-router").Router
        __global_components__: { name: string; component: any }[]
        __user_config__?: any
        __on_vue_init__?: (vueApp: any, routePath: string) => void | Promise<void>
        __root_components__?: any[]
        __vue_plugins__?: any[]
    }
}

declare module "*.vue" {
    import type { DefineComponent } from "vue"
    const component: DefineComponent<{}, {}, any>
    export default component
}

declare module "*.css"
declare module "@fontsource-variable/*"
declare module "@fontsource/*"

declare module "*.svg" {
    const content: string
    export default content
}

