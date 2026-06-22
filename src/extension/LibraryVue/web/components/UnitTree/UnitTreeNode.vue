<template>
    <li class="UnitTree-Node" :data-sort="node.metadata.sort">
        <!-- 哨兵元素：用于 IntersectionObserver 检测父级是否吸顶 -->
        <div v-if="hasChildren" ref="sentinel" class="UnitTree-Sentinel"></div>
        <div
            class="UnitTree-Row"
            :class="{
                'is-selected': isSelected,
                'is-parent': hasChildren,
                'is-sticky-parent': isStickyParent,
                'is-stuck': isStuck,
            }"
            :style="rowStyle"
            :title="node.dirPath"
            @click="handleSelect"
            @dblclick="handleDblClick"
            @contextmenu.prevent="handleContextMenu"
        >
            <button
                v-if="hasChildren"
                class="UnitTree-Expand"
                :class="{ 'is-open': isExpanded }"
                type="button"
                @click="handleToggle"
            >
                <hd-icon :icon="expandIcon"></hd-icon>
            </button>
            <span v-else class="UnitTree-ExpandPlaceholder"></span>
            <hd-icon class="UnitTree-Icon" :icon="icon"></hd-icon>
            <span class="UnitTree-Label">
                {{ label }}
                <div class="sub-label" v-if="subLabel">{{ subLabel }}</div>
            </span>
        </div>
        <!-- 使用 CSS grid 过渡实现展开/收起动画 -->
        <div v-if="hasChildren" class="UnitTree-ChildrenWrap" :class="{ 'is-open': isExpanded }">
            <ul class="UnitTree-Children">
                <UnitTreeNode
                    v-for="child in sortedChildren"
                    :key="child.id"
                    :node="child"
                    :level="level + 1"
                    :expanded-ids="expandedIds"
                    :selected-id="selectedId"
                    :selected-ancestor-ids="selectedAncestorIds"
                    :always-sticky="alwaysSticky"
                    @toggle="$emit('toggle', $event)"
                    @select="$emit('select', $event)"
                    @contextmenu="$emit('contextmenu', $event)"
                />
            </ul>
        </div>
    </li>
</template>

<style lang="css">
/* UnitTree 节点样式 — 不使用 scoped，确保递归子组件也能应用 */

.UnitTree-List,
.UnitTree-Children {
    list-style: none;
    margin: 0;
    padding: 0;
}

.UnitTree-Row {
    display: flex;
    position: relative;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 8px;
    place-items: center;
    cursor: pointer;
    transition:
        background 0.18s ease,
        box-shadow 0.18s ease;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 500;
    font-family: var(--starmap-base-font);
    margin: 1px 0;
    border-radius: 8px;
    corner-shape: squircle;
    user-select: none;
    color: var(--unit-tree-text);
    white-space: nowrap;
}

.UnitTree-Row.is-selected,
.UnitTree-Row.is-selected:hover {
    color: var(--unit-tree-text-selected);
    background: var(--unit-tree-selected);
    .UnitTree-Label .sub-label {
        color: var(--unit-tree-sub-text-selected);
    }
}

/* 哨兵元素 — 零高度，仅用于 IntersectionObserver 检测吸顶 */
.UnitTree-Sentinel {
    height: 1px;
    margin: 0 0 -1px 0;
    pointer-events: none;
    visibility: hidden;
}

/* 父级节点默认背景（不吸顶） */
.UnitTree-Row.is-parent {
    background: var(--unit-tree-row-bg, #ffffff);
}

/* 只有选中项的祖先才会吸顶 — 通过 z-index 确保只显示最深层的父级 */
.UnitTree-Row.is-sticky-parent {
    position: sticky;
    top: 0;
    background: var(--unit-tree-row-bg, #ffffff);
}

/* 吸顶时去掉圆角，贴合容器边缘 */
.UnitTree-Row.is-sticky-parent.is-stuck:not(.is-selected) {
    border-radius: 0;

    &::before {
        content: "";
        position: absolute;
        bottom: 0;
        height: 1px;
        width: 100%;
        --unit-stuck-line-color: rgb(99 124 184 / 13%);
        background: linear-gradient(
            90deg,
            transparent 0%,
            var(--unit-stuck-line-color) 10%,
            var(--unit-stuck-line-color) 50%,
            var(--unit-stuck-line-color) 90%,
            transparent 100%
        );
    }
}

/* 父级节点选中时覆盖 sticky 背景色，保持与非文件夹节点一致 */
.UnitTree-Row.is-parent.is-selected {
    color: var(--unit-tree-text-selected);
    background: var(--unit-tree-selected);
}

.UnitTree-Row:hover {
    background: var(--unit-tree-hover);
}

.UnitTree-Expand,
.UnitTree-ExpandPlaceholder {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 22px;
}

.UnitTree-Expand {
    border: none;
    background: transparent;
    color: var(--unit-tree-arrow);
    cursor: pointer;
    padding: 0;
    border-radius: 4px;
    transition: background 0.15s ease;
}

/* 展开按钮 hover 反馈 */
.UnitTree-Expand:hover {
    background: var(--unit-tree-button-hover);
}

.UnitTree-Expand hd-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

/* 展开时箭头图标旋转 90° */
.UnitTree-Expand.is-open hd-icon {
    transform: rotate(90deg);
}

.UnitTree-Icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 16px;
    color: var(--unit-tree-icon);
}

.UnitTree-Label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 32px;
    display: flex;
    .sub-label {
        font-size: 12px;
        margin-left: auto;
        font-weight: normal;
        color: var(--unit-tree-sub-text);
    }
}

/* 展开/收起动画 — 使用 CSS grid-template-rows 过渡 */
.UnitTree-ChildrenWrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.2s ease;
}

.UnitTree-ChildrenWrap.is-open {
    grid-template-rows: 1fr;
}

.UnitTree-ChildrenWrap > .UnitTree-Children {
    overflow: hidden;
    min-height: 0;
}
</style>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
import type { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"
import { sortUnitNodes } from "./sortUnitNodes"

type UnitNode = CodeUnitJSON

export default defineComponent({
    name: "UnitTreeNode",
    components: {},
    props: {
        node: {
            type: Object as PropType<UnitNode>,
            required: true,
        },
        level: {
            type: Number,
            required: true,
        },
        expandedIds: {
            type: Object as PropType<Set<string>>,
            required: true,
        },
        selectedId: {
            type: String as PropType<string | null>,
            default: null,
        },
        /** 选中节点的所有祖先 ID 集合，用于控制哪些父级节点吸顶 */
        selectedAncestorIds: {
            type: Object as PropType<Set<string>>,
            default: () => new Set(),
        },
        /** 是否总是启用 sticky 吸顶效果（不限于选中项的祖先） */
        alwaysSticky: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["toggle", "select", "contextmenu"],
    data() {
        return {
            /** 是否处于吸顶状态 */
            isStuck: false,
            /** IntersectionObserver 实例引用 */
            _observer: null as IntersectionObserver | null,
        }
    },
    mounted() {
        // 为父级节点设置 IntersectionObserver 检测吸顶状态
        if (this.hasChildren && this.$refs.sentinel) {
            const scrollContainer = (this.$el as HTMLElement).closest(".tree-box")
            this._observer = new IntersectionObserver(
                ([entry]) => {
                    // 哨兵不可见时说明父级已吸顶
                    this.isStuck = !entry.isIntersecting
                },
                { root: scrollContainer, threshold: 0 },
            )
            this._observer.observe(this.$refs.sentinel as Element)
        }
    },
    beforeUnmount() {
        this._observer?.disconnect()
    },
    computed: {
        hasChildren(): boolean {
            return (this.node.children?.length ?? 0) > 0
        },
        /** 当前节点的已排序子节点列表 */
        sortedChildren(): UnitNode[] {
            return sortUnitNodes(this.node.children)
        },
        isExpanded(): boolean {
            return this.expandedIds.has(this.node.id)
        },
        isSelected(): boolean {
            return this.selectedId === this.node.id
        },
        /** 是否是选中节点的祖先（只有祖先才会吸顶） */
        isSelectedAncestor(): boolean {
            return this.selectedAncestorIds.has(this.node.id)
        },
        /** 是否应该应用 sticky 吸顶效果（alwaysSticky 时所有父级吸顶，否则只有选中项的祖先） */
        isStickyParent(): boolean {
            return this.hasChildren && (this.alwaysSticky || this.isSelectedAncestor)
        },
        label(): string {
            return getNodeLabel(this.node)
        },
        subLabel(): string | void {
            return getNodeSubLabel(this.node)
        },
        /** 行样式：缩进 + 吸顶层级 */
        rowStyle(): Record<string, string> {
            const style: Record<string, string> = {
                paddingLeft: String(this.level * 20 + 8) + "px",
            }
            // z-index 随层级递增，使深层父级覆盖浅层父级
            if (this.hasChildren) {
                style.zIndex = String(this.level + 1)
            }
            return style
        },
        /** 节点图标，使用 hd-icon 格式（如 ri:folder-open-line） */
        icon(): string {
            return resolveIcon(this.node, this.hasChildren, this.isExpanded)
        },
        /** 展开/收起箭头图标（始终使用同一图标，通过 CSS 旋转实现动画） */
        expandIcon(): string {
            return "ri:arrow-right-s-line"
        },
    },
    methods: {
        /**
         * 切换节点展开状态
         * @param event 鼠标事件
         */
        handleToggle(event: MouseEvent) {
            event.stopPropagation()
            if (!this.hasChildren) return
            this.$emit("toggle", this.node.id)
        },
        /**
         * 选中当前节点（单击只选中，不展开/收起）
         */
        handleSelect() {
            this.$emit("select", this.node.id)
        },
        /**
         * 双击行时切换展开/收起
         */
        handleDblClick() {
            if (this.hasChildren) {
                this.$emit("toggle", this.node.id)
            }
        },
        /**
         * 触发节点右键菜单
         * @param event 鼠标事件
         */
        handleContextMenu(event: MouseEvent) {
            event.stopPropagation()
            this.$emit("contextmenu", { event, node: this.node })
        },
    },
})

/**
 * 获取节点显示名称
 */
export function getNodeLabel(node: UnitNode): string {
    const metadata = node.metadata
    let label = metadata?.headMainTitle ?? metadata?.title ?? node.dirName ?? "Untitled"
    label = label.trim()
    // 如果名称为句点，说明是项目根目录，显示为默认名称 Readme
    if (label === ".") {
        return "Readme"
    }
    return label
}

/**
 * 获取节点副标题（如 headSubTitle 或 subtitle）
 */
function getNodeSubLabel(node: UnitNode): string | void {
    const metadata = node.metadata
    let subLabel = metadata?.headSubTitle
    return subLabel?.trim() || undefined
}

/**
 * 解析节点图标，返回 hd-icon 格式的图标名（如 ri:folder-open-line）
 * @param node 代码单元节点
 * @param hasChildren 是否有子节点
 * @param isExpanded 是否展开
 */
function resolveIcon(node: UnitNode, hasChildren: boolean, isExpanded: boolean): string {
    const iconClass = node.metadata?.iconClass ?? node.metadata?.icon
    if (typeof iconClass === "string" && iconClass.trim()) {
        const icon = iconClass.trim()
        // 自动将 ri- 格式转换为 ri: 格式以完美兼容
        if (icon.startsWith("ri-")) {
            return "ri:" + icon.slice(3)
        }
        return icon
    }

    // 根目录的 unit 默认图标为 ri:article-fill
    if (node.id === "starmap-project-root" || node.id === "startmap-project-root") {
        return "ri:article-fill"
    }

    if (hasChildren) {
        return isExpanded ? "ri:folder-open-line" : "ri:folder-2-line"
    }

    return "ri:folder-3-line"
}
</script>
