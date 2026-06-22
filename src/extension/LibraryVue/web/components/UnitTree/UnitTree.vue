<template>
    <div class="UnitTree">
        <div v-if="!treeData.length" class="UnitTree-Empty">No units</div>
        <ul v-else class="UnitTree-List">
            <UnitTreeNode
                v-for="node in treeData"
                :key="node.id"
                :node="node"
                :level="0"
                :expanded-ids="expandedIds"
                :selected-id="selectedId"
                :selected-ancestor-ids="selectedAncestorIds"
                :always-sticky="alwaysSticky"
                @toggle="handleToggle"
                @select="handleSelect"
                @contextmenu="handleContextMenu"
            />
        </ul>

        <UnitTreeContextMenu
            ref="contextMenu"
            :visible="contextMenu.visible"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :node="contextMenu.node"
            @copy-link="copyNodeLink"
            @print-node="printNodeToConsole"
        />
    </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
import type { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"
import { sortUnitNodes } from "./sortUnitNodes"
import UnitTreeContextMenu from "./UnitTreeContextMenu.vue"
import UnitTreeNode from "./UnitTreeNode.vue"
import { getNodeLabel } from "./UnitTreeNode.vue"

type UnitNode = CodeUnitJSON

type UnitTreeContextMenuPayload = {
    event: MouseEvent
    node: UnitNode
}

export default defineComponent({
    name: "UnitTree",
    components: { UnitTreeContextMenu, UnitTreeNode },
    emits: ["select", "navigate"],
    props: {
        units: {
            type: Array as PropType<UnitNode[]>,
            default: () => [],
        },
        /** 树列表目录是否总是 sticky 吸顶 */
        alwaysSticky: {
            type: Boolean,
            default: false,
        },
        initialSelectedId: {
            type: String,
            default: null,
        },
    },
    data() {
        return {
            selectedId: this.initialSelectedId as string | null,
            expandedIds: new Set<string>(),
            contextMenu: {
                visible: false,
                x: 0,
                y: 0,
                node: null as UnitNode | null,
            },
            /** 上一次 units 的根节点 ID 列表，用于判断数据是否真正发生变化 */
            _lastUnitIds: "" as string,
        }
    },
    mounted() {
        document.addEventListener("mousedown", this.handleDocumentPointerDown)
        document.addEventListener("contextmenu", this.handleDocumentContextMenu)
        document.addEventListener("keydown", this.handleDocumentKeydown)
        window.addEventListener("scroll", this.closeContextMenu, true)
        window.addEventListener("resize", this.closeContextMenu)
    },
    beforeUnmount() {
        document.removeEventListener("mousedown", this.handleDocumentPointerDown)
        document.removeEventListener("contextmenu", this.handleDocumentContextMenu)
        document.removeEventListener("keydown", this.handleDocumentKeydown)
        window.removeEventListener("scroll", this.closeContextMenu, true)
        window.removeEventListener("resize", this.closeContextMenu)
    },
    computed: {
        treeData(): UnitNode[] {
            return sortUnitNodes(this.units)
        },
        /** 选中节点的所有祖先节点 ID 集合，用于控制 sticky 吸顶效果 */
        selectedAncestorIds(): Set<string> {
            const ancestors = new Set<string>()
            if (!this.selectedId) return ancestors
            const path = findPathToId(this.units, this.selectedId)
            if (path) {
                // 路径中除了最后一个（选中节点本身），其余都是祖先
                for (let i = 0; i < path.length - 1; i++) {
                    ancestors.add(path[i].id)
                }
            }
            return ancestors
        },
    },
    watch: {
        units: {
            immediate: true,
            handler(newUnits: UnitNode[]) {
                // 只在数据实质性变化（根节点 ID 列表改变）时才重建展开状态
                // 避免响应式触发时覆盖用户手动收起的节点
                const newIds = newUnits.map((n) => n.id).join(",")
                if (newIds !== this._lastUnitIds) {
                    this._lastUnitIds = newIds
                    this.expandedIds = buildDefaultExpanded(newUnits, this.selectedId)
                }
            },
        },
        /** 监听外部传入的选中 ID 变化（如浏览器前进/后退） */
        initialSelectedId(newId: string | null) {
            if (newId !== this.selectedId) {
                this.selectedId = newId
            }
        },
    },
    methods: {
        /**
         * 切换节点展开状态
         * @param id 节点 ID
         */
        handleToggle(id: string) {
            const next = new Set(this.expandedIds)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            this.expandedIds = next
        },
        /**
         * 选中节点，并通知父组件进行导航
         * @param id 节点 ID
         */
        handleSelect(id: string) {
            this.selectedId = id
            this.$emit("select", id)
            this.$emit("navigate", id)
        },
        /**
         * 打开节点右键菜单
         * @param payload 节点与鼠标事件
         */
        handleContextMenu(payload: UnitTreeContextMenuPayload) {
            payload.event.preventDefault()
            this.selectedId = payload.node.id
            this.contextMenu = {
                visible: true,
                x: payload.event.clientX,
                y: payload.event.clientY,
                node: payload.node,
            }
        },
        /** 关闭右键菜单 */
        closeContextMenu() {
            if (!this.contextMenu.visible) return
            this.contextMenu = {
                visible: false,
                x: 0,
                y: 0,
                node: null,
            }
        },
        /**
         * 点击菜单外部时关闭菜单
         * @param event 鼠标事件
         */
        handleDocumentPointerDown(event: MouseEvent) {
            if (!this.contextMenu.visible) return
            const menuRef = this.$refs.contextMenu as
                | { containsTarget?: (target: EventTarget | null) => boolean }
                | undefined
            if (menuRef?.containsTarget?.(event.target)) return
            this.closeContextMenu()
        },
        /**
         * 在菜单外触发新的右键时关闭当前菜单
         * @param event 鼠标事件
         */
        handleDocumentContextMenu(event: MouseEvent) {
            if (!this.contextMenu.visible) return
            const menuRef = this.$refs.contextMenu as
                | { containsTarget?: (target: EventTarget | null) => boolean }
                | undefined
            if (menuRef?.containsTarget?.(event.target)) return
            this.closeContextMenu()
        },
        /**
         * 通过 Esc 关闭菜单
         * @param event 键盘事件
         */
        handleDocumentKeydown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                this.closeContextMenu()
            }
        },
        /** 复制当前节点链接 */
        async copyNodeLink() {
            if (!this.contextMenu.node) return
            const link = buildUnitLink(getNodeLabel(this.contextMenu.node), this.contextMenu.node.id)
            await copyTextToClipboard(link)
            this.closeContextMenu()
        },
        /** 在控制台输出当前节点数据 */
        printNodeToConsole() {
            if (!this.contextMenu.node) return
            console.log(this.contextMenu.node)
            this.closeContextMenu()
        },
    },
})

/**
 * 构建默认展开集合
 * @param units 根节点列表
 * @param selectedId 当前选中 ID
 */
function buildDefaultExpanded(units: UnitNode[], selectedId: string | null): Set<string> {
    const expanded = new Set<string>()
    for (const node of units) {
        expanded.add(node.id)
    }

    if (selectedId) {
        const path = findPathToId(units, selectedId)
        if (path) {
            for (const node of path) {
                expanded.add(node.id)
            }
        }
    }

    return expanded
}

/**
 * 查找从根到目标节点的路径
 * @param units 根节点列表
 * @param targetId 目标节点 ID
 */
function findPathToId(units: UnitNode[], targetId: string): UnitNode[] | null {
    for (const node of units) {
        if (node.id === targetId) return [node]

        if (node.children && node.children.length > 0) {
            const childPath = findPathToId(node.children, targetId)
            if (childPath) return [node, ...childPath]
        }
    }

    return null
}

/**
 * 构建指定节点的绝对访问链接
 * @param id 节点 ID
 */
function buildUnitLink(name: string, id: string): string {
    return `[${name}](/units/${id})`
}

/**
 * 将文本写入剪贴板，浏览器权限失败时退回 textarea 方案
 * @param text 要复制的文本
 */
async function copyTextToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text)
        return
    } catch {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "true")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
    }
}
</script>

<style lang="css">
/* UnitTree 容器样式 — CSS 变量供子组件使用 */
.UnitTree {
    --unit-tree-bg: transparent;
    --unit-tree-text: var(--starmap-nav-item-text);
    --unit-tree-text-selected: var(--starmap-nav-item-text-selected);
    --unit-tree-sub-text: #595990a6;
    --unit-tree-sub-text-selected: #595990dc;

    --unit-tree-muted: rgba(31, 35, 40, 0.55);
    --unit-tree-hover: rgb(232 235 242);
    --unit-tree-selected: var(--starmap-nav-item-bk-selected);
    --unit-tree-selected-border: rgba(59, 130, 246, 0.45);
    --unit-tree-icon: var(--starmap-button-icon-text);
    --unit-tree-arrow: rgba(31, 35, 40, 0.6);
    --unit-tree-row-bg: var(--starmap-nav-background);

    --unit-tree-button-hover: rgb(94 94 198 / 20%);

    :root.is-dark-theme & {
        --unit-tree-muted: rgba(220, 225, 235, 0.55);
        --unit-tree-hover: rgb(43 48 93 / 49%);
        --unit-tree-selected-border: rgba(94, 155, 255, 0.45);
        --unit-tree-arrow: rgba(220, 225, 235, 0.6);
        --unit-tree-button-hover: rgba(144, 144, 255, 0.2);

        --unit-tree-sub-text: #9696e98f;
        --unit-tree-sub-text-selected: #7683f3;
    }
}

.UnitTree-Empty {
    color: var(--unit-tree-muted);
    padding: 10px 12px;
}
</style>
