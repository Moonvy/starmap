<template>
    <Teleport to="body">
        <Transition name="UnitTreeContextMenu-Fade">
            <div
                v-if="visible && node"
                ref="menuRoot"
                class="UnitTreeContextMenu"
                :style="menuStyle"
                @contextmenu.prevent
            >
                <button class="UnitTreeContextMenu-Action" type="button" @click="$emit('copy-link')">
                    <span class="UnitTreeContextMenu-ActionLabel">复制 Markdown 链接</span>
                </button>

       
                <button class="UnitTreeContextMenu-Action" type="button" @click="$emit('print-node')">
                    <span class="UnitTreeContextMenu-ActionLabel">控制台显示</span>
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
import type { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"

type UnitNode = CodeUnitJSON

export default defineComponent({
    name: "UnitTreeContextMenu",
    emits: ["copy-link", "print-node"],
    props: {
        visible: {
            type: Boolean,
            default: false,
        },
        x: {
            type: Number,
            required: true,
        },
        y: {
            type: Number,
            required: true,
        },
        node: {
            type: Object as PropType<UnitNode | null>,
            default: null,
        },
    },
    computed: {
        /** 菜单定位样式 */
        menuStyle(): Record<string, string> {
            const { x, y } = normalizeContextMenuPosition(this.x, this.y)
            return {
                left: x + "px",
                top: y + "px",
            }
        },
    },
    methods: {
        /**
         * 判断给定目标是否位于菜单内部
         * @param target 事件目标
         */
        containsTarget(target: EventTarget | null): boolean {
            const menuRoot = this.$refs.menuRoot as HTMLElement | undefined
            if (!menuRoot || !(target instanceof Node)) return false
            return menuRoot.contains(target)
        },
    },
})

/**
 * 规范化右键菜单坐标，避免超出视口
 * @param clientX 鼠标横坐标
 * @param clientY 鼠标纵坐标
 */
function normalizeContextMenuPosition(clientX: number, clientY: number): { x: number; y: number } {
    const menuWidth = 184
    const menuHeight = 96
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    return {
        x: Math.max(12, Math.min(clientX, viewportWidth - menuWidth - 12)),
        y: Math.max(12, Math.min(clientY, viewportHeight - menuHeight - 12)),
    }
}
</script>

<style lang="css">
.UnitTreeContextMenu-Fade-enter-active,
.UnitTreeContextMenu-Fade-leave-active {
    transition:
        opacity 0.18s ease,
        transform 0.18s ease;
}

.UnitTreeContextMenu-Fade-enter-from,
.UnitTreeContextMenu-Fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
}

.UnitTreeContextMenu {
    position: fixed;
    z-index: 9999;
    width: 176px;
    padding: 4px;
    border-radius: 10px;
    background: var(--starmap-nav-background);

    box-shadow:
        0 8px 24px rgb(22 28 45 / 14%),
        0 1px 3px rgb(22 28 45 / 10%);
    font-family: var(--starmap-base-font);

    :root.is-dark-theme & {
        border-color: rgb(140 155 255 / 8%);
        box-shadow:
            0 10px 28px rgb(0 0 0 / 30%),
            0 1px 2px rgb(0 0 0 / 22%);
    }
}

.UnitTreeContextMenu-Action {
    width: 100%;
    min-height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease;
}

.UnitTreeContextMenu-Action:hover {
    background: rgb(64 102 244 / 12%);

    :root.is-dark-theme & {
        background: rgb(131 145 255 / 14%);
    }
}

.UnitTreeContextMenu-ActionLabel {
    color: var(--starmap-nav-logo);
    font-size: 13px;
}
</style>
