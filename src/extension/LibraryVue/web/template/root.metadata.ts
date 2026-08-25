// @ts-ignore
import unitsFlat from "./units-flat.json" with { type: "json" }
// @ts-ignore
import unitsTree from "./units-tree.json" with { type: "json" }
// @ts-ignore
import rootMetadata from "./root-metadata.json" with { type: "json" }

const metadata = {
    unitsFlat,
    unitsTree,
    rootMetadata,
}

// 合并写入，避免 HMR 重跑时抹掉 __vue_router__ / __global_components__ 等运行时字段
// @ts-ignore
window.__starmap__ = {
    ...(window.__starmap__ || {}),
    ...metadata,
}

// 通知 Root 等组件：目录树 / 元数据已更新（不整页刷新）
window.dispatchEvent(new CustomEvent("starmap:meta-updated"))

// 作为 HTML entry 的 metadata.ts：必须 self-accept。
// 否则 units-tree.json 等依赖变更会向上冒泡成 Vite full page reload。
// accept() 后本模块会带着最新 JSON 重新求值，上面的赋值与事件会再跑一遍。
// @ts-ignore
if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.accept()
}

export default metadata