<template>
    <div class="Starmap-Markdown-Wrap starmap-markdown-render" :class="{ 'is-toc-pinned': isTocPinned }">
        <StarmapHeader />
        <slot />
        <Toc @layout-change="handleTocLayoutChange" />
    </div>
</template>

<style scoped>
@media (min-width: 921px) {
    .Starmap-Markdown-Wrap.is-toc-pinned {
        padding-right: 240px;
        max-width: 1080px;
        width: 920px;
    }

    /* 屏幕小于 1400px */
    @media (max-width: 1400px) {
        .Starmap-Markdown-Wrap {
            width: 620px;
        }
        .Starmap-Markdown-Wrap.is-toc-pinned {
            width: 900px; /* 620px + 280px */
            max-width: 100%;
        }
    }

    /* 屏幕小于 1100px */
    @media (max-width: 1100px) {
        .Starmap-Markdown-Wrap {
            width: 620px;
        }
        .Starmap-Markdown-Wrap.is-toc-pinned {
            width: 900px; /* 620px + 280px */
            max-width: 100%;
        }
    }
}

@media (max-width: 920px) {
    .Starmap-Markdown-Wrap {
        width: 100%;
        max-width: 600px; /* 置顶导航和移动端模式下最大宽 600px 并自适应收缩 */

        .Starmap-Header-Container {
            margin-left: 0;
        }
    }
}
</style>

<script lang="ts">
import "./markdown.css"
import "markdown-it-github-alerts/styles/github-colors-light.css"
import "markdown-it-github-alerts/styles/github-colors-dark-media.css"
import "markdown-it-github-alerts/styles/github-base.css"

import { defineComponent } from "vue"
import Toc from "./components/Toc/Toc.vue"
import StarmapHeader from "./components/StarmapHeader/StarmapHeader.vue"

export default defineComponent({
    name: "StarmapMarkdownWrap",
    components: {
        Toc,
        StarmapHeader,
    },
    props: {},
    data() {
        return {
            isTocPinned: false,
        }
    },
    methods: {
        /**
         * 处理目录组件布局改变的事件
         * @param state 包含目录布局相关的状态对象
         */
        handleTocLayoutChange(state: { isCollapsed: boolean; isPinned: boolean; isEffectivePinned: boolean }) {
            this.isTocPinned = state.isEffectivePinned
        },
    },
})
</script>
