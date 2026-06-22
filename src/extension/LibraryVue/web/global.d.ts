// typescript 定义全局变量 __starmap__
interface Window {
    __starmap__: {
        codeUnit: import("../../../core/Gen/lib/unitTreeToJSON").CodeUnitJSON
        unitsFlat: import("../../../core/Gen/lib/unitTreeToJSON").CodeUnitJSON[]
        unitsTree: import("../../../core/Gen/lib/unitTreeToJSON").CodeUnitJSON[]
        rootMetadata: import("../../../core/Gen/lib/createRootMetadata").RootMetadata
        vueMetadata: import("vue-docgen-api").ComponentDoc | null

        __vue_router__: import("vue-router").Router
        __global_components__: { name: string; component: any }[]
    }
}

declare module "*.vue" {
    import type { DefineComponent } from "vue"
    const component: DefineComponent<{}, {}, any>
    export default component
}
