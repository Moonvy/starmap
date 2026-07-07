import { App } from "vue"
import CodeWrap from "./components/CodeWrap/CodeWrap.vue"
import LayoutH from "./components/LayoutH/LayoutH.vue"
import StarmapVueDoc from "./components/StarmapVueDoc/StarmapVueDoc.vue"
import StarmapSelect from "./components/StarmapSelect/StarmapSelect.vue"
import StarmapCheckbox from "./components/StarmapCheckbox/StarmapCheckbox.vue"
import StarmapInput from "./components/StarmapInput/StarmapInput.vue"
import StarmapDocParams from "./components/StarmapDocParams/StarmapDocParams.vue"
import StarmapDocExample from "./components/StarmapDocExample/StarmapDocExample.vue"

/** 注册全局组件 */
export function registerMarkdownComponents(vueApp: App) {
    vueApp.component("StarmapCodeWrap", CodeWrap)
    vueApp.component("StarmapLayoutH", LayoutH)
    vueApp.component("StarmapSelect", StarmapSelect)
    vueApp.component("StarmapCheckbox", StarmapCheckbox)
    vueApp.component("StarmapInput", StarmapInput)
    vueApp.component("StarmapVueDoc", StarmapVueDoc)
    vueApp.component("StarmapDocParams", StarmapDocParams)
    vueApp.component("StarmapDocExample", StarmapDocExample)
}

/** Vue 模板中使用的组件 */
export const MarkdownComponents = {
    StarmapCodeWrap: CodeWrap,
    StarmapLayoutH: LayoutH,
    StarmapSelect: StarmapSelect,
    StarmapCheckbox: StarmapCheckbox,
    StarmapInput: StarmapInput,
    StarmapVueDoc: StarmapVueDoc,
    StarmapDocParams: StarmapDocParams,
    StarmapDocExample: StarmapDocExample,
    LayoutH: LayoutH,
}
