import { defineEvents } from "fzz"
import { CodeUnit } from "./Gen/CodeUnit"
import { StarmapCore } from "./StarmapCore"
import { Gen } from "./Gen/Gen"

export const [StarmapCoreEvents, StarmapCoreEventDefine] = defineEvents({
    inited: <any>{},

    /** 单个代码单元生成完成后触发
     * - 全量生成： generate -> generateUnit-> generateEnd -> generateTree-> generateDone
     * - 单个生成： generateUnit-> generateEnd -> generateTree
     *
     * force: 是否忽略缓存强制生成
     *
     */
    generateUnit: <{ codeUnit: CodeUnit; gen: Gen; starmapCore: StarmapCore; force?: boolean }>{},

    /** 所有代码单元生成完成后触发
     * - 全量生成： generate -> generateUnit-> generateEnd -> generateTree-> generateDone
     * - 单个生成： generateUnit -> generateEnd -> generateTree
     */
    generateEnd: <{ gen: Gen; starmapCore: StarmapCore }>{},

    /** 代码单元树生成完成后触发
     * - 全量生成： generate -> generateUnit-> generateEnd -> generateTree-> generateDone
     * - 单个生成： generateUnit-> generateEnd -> generateTree
     */
    generateTree: <{ gen: Gen; starmapCore: StarmapCore }>{},

    /** 文档生成全部完成后触发
     * - 全量生成： generate -> generateUnit-> generateEnd -> generateTree-> generateDone
     */
    generateDone: <{ gen: Gen; starmapCore: StarmapCore }>{},

    /** 第一次完整生成文档完成后触发 */
    firstGenerateDone: <{ starmapCore: StarmapCore }>{},
})
