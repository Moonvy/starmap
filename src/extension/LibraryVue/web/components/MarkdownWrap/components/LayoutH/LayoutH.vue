<template>
    <div
        class="markdown-content-layout-horizontal"
        :class="{
            'flex-left': left,
            'flex-right': right,
            'flex-full': full,
        }"
    >
        <slot> </slot>
    </div>
</template>
<style>
.starmap-markdown-render {
    .markdown-content-layout-horizontal {
        display: flex;
        justify-content: flex-start;
        gap: 1em;
        &.flex-left {
            & > :first-child {
                flex: 1;
            }
            & > :last-child {
                flex: 0;
            }
        }
        &.flex-right {
            & > :first-child {
                flex: 0;
            }
            & > :last-child {
                flex: 1;
            }
        }
        &.flex-full {
            & > * {
                flex: auto;
            }
        }
    }
}
</style>
<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    name: "LayoutH",
    props: {
        /** 左侧内容宽度拉伸，右侧内容固定 */
        left: { type: Boolean, default: false },
        /** 右侧内容宽度拉伸，左侧内容固定 */
        right: { type: Boolean, default: false },
        /** 全部子内容填满容器（宽度拉伸） */
        full: { type: Boolean, default: true },
    },
})
</script>
