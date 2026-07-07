<template>
    <div class="Starmap-Markdown-Wrap starmap-markdown-render" :class="{ 'is-toc-pinned': isTocPinned }" @click="handleLinkClick">
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
    watch: {
        // 监听路由的 hash 变化以触发滚动定位
        "$route.hash": {
            handler(newHash) {
                this.scrollToHash(newHash)
            },
            immediate: true,
        },
    },
    methods: {
        /**
         * 拦截并处理 Markdown 中的 a 标签点击，以在 History 模式下通过 SPA 进行路由导航而防止页面重新加载
         */
        handleLinkClick(e: MouseEvent) {
            const target = e.target as HTMLElement
            const anchor = target.closest("a")
            if (!anchor) return

            const href = anchor.getAttribute("href")
            if (!href) return

            // 判断如果是指向 /units/ 的本地链接，则由 vue-router 托管导航
            if (href.startsWith("/units/")) {
                e.preventDefault()
                this.$router.push(href).catch((err) => {
                    console.error("[Starmap] SPA 导航失败，退回至默认硬链接跳转:", err)
                    window.location.href = href
                })
            }
        },
        /**
         * 处理目录组件布局改变的事件
         * @param state 包含目录布局相关的状态对象
         */
        handleTocLayoutChange(state: { isCollapsed: boolean; isPinned: boolean; isEffectivePinned: boolean }) {
            this.isTocPinned = state.isEffectivePinned
        },
        /**
         * 滚动定位到指定的 hash 锚点元素位置
         * @param hash 锚点字符串，如 "#arrayremove"
         */
        scrollToHash(hash: string) {
            if (!hash) return
            // 解码并剥离首字符 '#'
            const id = decodeURIComponent(hash.startsWith("#") ? hash.slice(1) : hash)
            if (!id) return

            this.$nextTick(() => {
                // 延迟执行以确保内容在 DOM 中完成渲染更新
                setTimeout(() => {
                    const el = this.$el.querySelector(`[id="${id}"]`) || document.getElementById(id)
                    if (!el) return

                    // 递归查找最近的可滚动容器
                    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
                        if (!node) return window
                        if (node.tagName === "BODY" || node.tagName === "HTML") return window
                        const overflowY = window.getComputedStyle(node).overflowY
                        if (overflowY === "auto" || overflowY === "scroll") return node
                        return getScrollParent(node.parentElement)
                    }

                    const scrollParent = getScrollParent(el)
                    const offset = 80 // 给顶部 PageTabs 等预留出安全空间

                    if (scrollParent === window) {
                        const top = el.getBoundingClientRect().top + window.scrollY - offset
                        window.scrollTo({ top, behavior: "smooth" })
                    } else {
                        const parentEl = scrollParent as HTMLElement
                        const parentRect = parentEl.getBoundingClientRect()
                        const elRect = el.getBoundingClientRect()
                        const top = elRect.top - parentRect.top + parentEl.scrollTop - offset
                        parentEl.scrollTo({ top, behavior: "smooth" })
                    }
                }, 150)
            })
        },
    },
})
</script>
