<template>
    <div
        class="starmap-toc"
        :class="{ 'is-collapsed': isCollapsed, 'is-hover': isHover, 'is-pinned': isPinned }"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
    >
        <div class="toc-container">
            <!-- 头部控制栏 -->
            <div v-if="isCollapsed" class="toc-header">
                <div
                    class="toc-pin-button"
                    :class="{ 'is-pinned': isPinned }"
                    @click="togglePin"
                    :title="isPinned ? '取消固定目录' : '固定目录'"
                >
                    <hd-icon icon="ri-side-bar-fill" />
                </div>
            </div>
            <!-- 轨道与进度指示器 -->
            <div class="toc-track" v-show="!isCollapsed || isHover || isPinned">
                <div class="toc-progress-indicator" :style="indicatorStyle"></div>
            </div>
            <div
                v-for="(item, index) in visibleTocList"
                :key="item.id + index"
                class="toc-item"
                :class="{ 'is-active': activeId === item.id }"
                :style="{
                    paddingLeft:
                        isCollapsed && !isHover && !isPinned ? '0px' : (item.level - minLevel) * 14 + 24 + 'px',
                }"
                @click="scrollTo(item.id)"
            >
                <div class="toc-indicator"></div>
                <span class="toc-text">{{ item.text }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue"

const MinMode_Width = 1600

export default defineComponent({
    name: "StarmapToc",
    data() {
        return {
            tocList: [] as Array<{ id: string; text: string; level: number }>,
            activeId: "",
            isCollapsed: typeof window !== "undefined" ? window.innerWidth < MinMode_Width : false,
            isHover: false,
            isPinned: localStorage.getItem("starmap_toc_pinned") === "true",
            minLevel: 1,
            isScrollingTo: false,
            scrollTimeout: null as ReturnType<typeof setTimeout> | null,
            hoverTimeout: null as ReturnType<typeof setTimeout> | null,
            observer: null as IntersectionObserver | null,
            resizeObserver: null as ResizeObserver | null,
            mutationObserver: null as MutationObserver | null,
        }
    },
    computed: {
        /**
         * 获取当前可见的标题列表（树折叠逻辑）
         * 每次只显示当前 active 标题所属的顶级标题（自动展开），其他顶级标题会被折叠只显示顶级标题
         */
        visibleTocList(): Array<{ id: string; text: string; level: number; parentId?: string }> {
            let currentParentId = ""
            // 1. 为每个标题分配它所属的顶级标题 ID
            const listWithParent = this.tocList.map((item) => {
                if (item.level === this.minLevel) {
                    currentParentId = item.id
                }
                return {
                    ...item,
                    parentId: currentParentId,
                }
            })

            // 2. 找到当前活动标题所属的顶级标题 ID
            const activeItem = listWithParent.find((item) => item.id === this.activeId)
            const activeParentId = activeItem ? activeItem.parentId : ""

            // 3. 过滤出需要展示的标题：所有的顶级标题，以及处于当前活跃顶级标题下的子标题
            return listWithParent.filter((item) => {
                if (item.level === this.minLevel) {
                    return true
                }
                return item.parentId === activeParentId
            })
        },
        /**
         * 获取当前活动标题在可见列表中的索引
         */
        activeIndex(): number {
            return this.visibleTocList.findIndex((item) => item.id === this.activeId)
        },
        /**
         * 计算指示器的移动样式
         */
        indicatorStyle(): Record<string, string> {
            const index = this.activeIndex
            if (index === -1) return { opacity: "0", transform: "translateY(0px)" }
            // 每一项高度为 28px (line-height) + gap 2px = 30px 偏移量
            // 我们希望进度条的高度例如是 18px，居中对齐，所以相对顶部偏移量为 index * 30 + (28 - 18) / 2 = index * 30 + 5
            return {
                opacity: "1",
                transform: `translateY(${index * 30 + 5}px)`,
            }
        },
    },
    watch: {
        isCollapsed() {
            this.emitLayoutChange()
        },
        isPinned() {
            this.emitLayoutChange()
        },
        activeId(newId) {
            if (!newId || this.isHover || this.isScrollingTo) return

            this.$nextTick(() => {
                const container = this.$el as HTMLElement
                const index = this.activeIndex
                if (index === -1) return

                const items = container.querySelectorAll(".toc-item")
                if (index < items.length) {
                    const activeItem = items[index] as HTMLElement

                    const offsetTop = activeItem.offsetTop
                    const itemHeight = activeItem.offsetHeight
                    const containerHeight = container.clientHeight
                    const scrollTop = container.scrollTop

                    // starmap-toc 的上内边距
                    const paddingTop = 48
                    const absoluteTop = paddingTop + offsetTop

                    // 设置一个缓冲区，当元素距离视口上下边缘多少距离内时触发滚动
                    const buffer = 55

                    if (absoluteTop < scrollTop + buffer) {
                        container.scrollTo({ top: Math.max(0, absoluteTop - buffer), behavior: "smooth" })
                    } else if (absoluteTop + itemHeight > scrollTop + containerHeight - buffer) {
                        container.scrollTo({
                            top: absoluteTop + itemHeight - containerHeight + buffer,
                            behavior: "smooth",
                        })
                    }
                }
            })
        },
    },
    mounted() {
        this.initToc()
        this.initResizeObserver()
        this.initMutationObserver()

        // 使用 capture: true 可以在 window 层面捕获所有内部容器的滚动事件
        window.addEventListener("scroll", this.onScroll, { passive: true, capture: true })

        // 派发初始的布局状态事件
        this.emitLayoutChange()
    },
    beforeUnmount() {
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout)
        if (this.hoverTimeout) clearTimeout(this.hoverTimeout)
        window.removeEventListener("scroll", this.onScroll, { capture: true })
        window.removeEventListener("resize", this.checkWidth)
        if (this.observer) this.observer.disconnect()
        if (this.resizeObserver) this.resizeObserver.disconnect()
        if (this.mutationObserver) this.mutationObserver.disconnect()
    },
    methods: {
        /**
         * 切换目录的固定状态
         */
        togglePin() {
            this.isPinned = !this.isPinned
            localStorage.setItem("starmap_toc_pinned", String(this.isPinned))
        },
        /**
         * 派发布局状态改变事件，用于向父组件同步状态
         */
        emitLayoutChange() {
            this.$emit("layout-change", {
                isCollapsed: this.isCollapsed,
                isPinned: this.isPinned,
                isEffectivePinned: this.isCollapsed && this.isPinned,
            })
        },
        onMouseEnter() {
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout)
                this.hoverTimeout = null
            }
            if (this.isCollapsed) {
                this.hoverTimeout = setTimeout(() => {
                    this.isHover = true
                }, 500)
            } else {
                this.isHover = true
            }
        },
        onMouseLeave() {
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout)
                this.hoverTimeout = null
            }
            this.isHover = false
        },
        /**
         * 初始化目录
         * 扫描页面中所有的标题元素并生成目录列表，排除在 <StarmapCodeWrap> 包裹下的标题
         */
        initToc() {
            const parent = document.querySelector(".starmap-markdown-render")
            if (!parent) return

            const headers = parent.querySelectorAll("h1, h2, h3, h4, h5, h6")
            let list: Array<{ id: string; text: string; level: number }> = []

            let currentMinLevel = 6
            headers.forEach((el) => {
                // 1. 如果标题位于 StarmapCodeWrap 包裹下，则不将其计入文档目录中
                if (el.closest(".StarmapCodeWrap")) return

                if (el.id) {
                    const level = parseInt(el.tagName.replace("H", ""), 10)
                    if (level < currentMinLevel) currentMinLevel = level

                    // 去除可能的隐藏锚点字符
                    let text = el.textContent || ""
                    text = text.replace(/^#\s*/, "")

                    list.push({
                        id: el.id,
                        text: text.trim(),
                        level: level,
                    })
                }
            })

            this.minLevel = currentMinLevel

            // 限制最多显示 2 层嵌套 (例如：如果有 h1，则最多显示到 h2)
            list = list.filter((item) => item.level <= currentMinLevel + 1)

            // 简单对比是否发生实质变化，避免没变时无意义更新（防止触发动画重置）
            const newListStr = JSON.stringify(list)
            const oldListStr = JSON.stringify(this.tocList)
            if (newListStr !== oldListStr) {
                this.tocList = list
            }

            this.onScroll()
        },
        initResizeObserver() {
            this.checkWidth()
            window.addEventListener("resize", this.checkWidth)
        },
        checkWidth() {
            // 当窗口宽度较窄时自动收起
            this.isCollapsed = window.innerWidth < MinMode_Width
        },
        initMutationObserver() {
            const parent = document.querySelector(".starmap-markdown-render")
            if (!parent) return

            this.mutationObserver = new MutationObserver(() => {
                this.initToc()
            })
            // 监听 DOM 树的变化以动态更新 Toc
            this.mutationObserver.observe(parent, { childList: true, subtree: true, characterData: true })
        },
        onScroll() {
            if (!this.tocList.length) return

            // 拦截由于点击目录导致的平滑滚动触发的高亮更新，避免高亮在中间标题来回跳跃
            if (this.isScrollingTo) {
                if (this.scrollTimeout) clearTimeout(this.scrollTimeout)
                this.scrollTimeout = setTimeout(() => {
                    this.isScrollingTo = false
                    this.onScroll() // 滚动彻底停止后，做一次位置校准
                }, 100)
                return
            }

            let currentId = ""
            // 不再依赖 window.scrollY，直接使用相对于视口顶部的边界判断
            const offset = 140 // 判定线，距离视口顶部的像素

            for (let i = this.tocList.length - 1; i >= 0; i--) {
                const item = this.tocList[i]
                const el = document.getElementById(item.id)
                if (el) {
                    const rect = el.getBoundingClientRect()
                    // 如果元素的顶部滚到了判定线以上，说明我们正在阅读该部分
                    if (rect.top <= offset) {
                        currentId = item.id
                        break
                    }
                }
            }

            if (!currentId && this.tocList.length > 0) {
                currentId = this.tocList[0].id
            }

            this.activeId = currentId
        },
        scrollTo(id: string) {
            const el = document.getElementById(id)
            if (!el) return

            // 1. 立即设置高亮并阻止滚动监听的干扰
            this.activeId = id
            this.isScrollingTo = true
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout)

            // 2. 执行滚动逻辑
            // 动态寻找最近的滚动容器，兼容全屏模式、SPA内容区滚动等不同场景
            const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
                if (!node) return window
                if (node.tagName === "BODY" || node.tagName === "HTML") return window
                const overflowY = window.getComputedStyle(node).overflowY
                if (overflowY === "auto" || overflowY === "scroll") return node
                return getScrollParent(node.parentElement)
            }

            const scrollParent = getScrollParent(el)
            const offset = 80 // 给页面上方固定的 Tabs 留出空间

            if (scrollParent === window) {
                const top = el.getBoundingClientRect().top + window.scrollY - offset
                window.scrollTo({ top, behavior: "smooth" })
            } else {
                const parentEl = scrollParent as HTMLElement
                const parentRect = parentEl.getBoundingClientRect()
                const elRect = el.getBoundingClientRect()
                // 计算目标元素相对于滚动容器的相对位置
                const top = elRect.top - parentRect.top + parentEl.scrollTop - offset
                parentEl.scrollTo({ top, behavior: "smooth" })
            }
        },
    },
})
</script>

<style>
.starmap-toc {
    position: fixed;
    top: 52px;
    right: 24px;
    width: 240px;
    height: calc(100vh - 52px);
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--starmap-doc-background, rgba(255, 255, 255));
    border-radius: 0;
    padding: 48px 0;
    box-sizing: border-box;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 100;
    mask-image: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0) 0,
        rgb(0, 0, 0) 60px,
        rgb(0, 0, 0) calc(100% - 60px),
        rgba(0, 0, 0, 0) 100%
    );

    scrollbar-width: none; /* 针对 Firefox */
    &::-webkit-scrollbar {
        display: none; /* 针对 Chrome, Safari, Opera 和新版 Edge */
    }

    /* 移动端与置顶导航模式下自动隐藏 */
    @media (max-width: 920px) {
        display: none;
    }

    /* --- 子元素样式 --- */

    .toc-container {
        display: flex;
        flex-direction: column;
        gap: 2px;
        position: relative;
    }

    .toc-track {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0px; /* 轨道的位置 */
        width: 1px;
        background-color: rgba(0, 0, 0, 0.04);
        border-radius: 2px;
        z-index: 1;
        height: 100%;
    }

    .toc-progress-indicator {
        position: absolute;
        top: 0;
        left: 0px; /* 居中于 2px 的轨道，所以向左移 1px，变成 4px 宽 */
        width: 2px;
        height: 18px;
        border-radius: 4px;
        background-color: #6868be;
        transition:
            transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
            opacity 0.3s;
        box-shadow: 2px 0 8px rgba(45, 45, 114, 0.2);
    }

    /* 当上方有控制栏时，轨道和进度条向下偏移 */
    .toc-header + .toc-track {
        top: 36px;
        height: calc(100% - 36px);
    }

    .toc-item {
        position: relative;
        padding: 0px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: #7a7e84;
        font-size: 14px;
        line-height: 28px;
        transition: all 0.3s ease;

        /* 交互状态 */
        &:hover {
            color: #111827;
        }

        &.is-active {
            color: #2d2d72;
            font-weight: 600;
        }
    }

    .toc-indicator {
        display: none;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.15);
        transition: all 0.3s ease;
    }

    .toc-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        transition: opacity 0.3s ease;
    }

    /* --- 状态修饰 --- */

    /* 头部控制栏 */
    .toc-header {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 16px;
        height: 28px;
        margin-bottom: 8px;
        width: 100%;
        box-sizing: border-box;
    }

    /* 固定按钮样式 */
    .toc-pin-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        color: #7a7e84;
        cursor: pointer;
        transition: all 0.3s ease;
        border-radius: 6px;
        user-select: none;

        &:hover {
            color: #111827;
            background-color: rgba(0, 0, 0, 0.04);
        }

        &.is-pinned {
            color: #5045de;
            background-color: rgba(80, 69, 222, 0.08);

            &:hover {
                background-color: rgba(80, 69, 222, 0.15);
            }
        }

        hd-icon {
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
    }

    /* 夜间模式按钮微调 */
    .is-dark-theme & {
        .toc-pin-button {
            color: #adb5cf;

            &:hover {
                color: #b8c1ff;
                background-color: rgba(255, 255, 255, 0.06);
            }

            &.is-pinned {
                color: #b8c1ff;
                background-color: rgba(138, 130, 255, 0.15);

                &:hover {
                    background-color: rgba(138, 130, 255, 0.25);
                }
            }
        }
    }

    /* 收起模式 */
    &.is-collapsed {
        padding: 16px 0;
        width: 24px;
        right: 16px;
        background: linear-gradient(to left, rgb(104 104 104 / 5%) 40%, rgba(252, 252, 253, 0));

        /* 悬停展开 或 固定展开 */
        &.is-hover,
        &.is-pinned {
            width: 240px;
            right: 16px;
            background: var(--starmap-doc-background, rgba(255, 255, 255));

            mask-image: none;

            .is-dark-theme & {
                box-shadow: 0 2px 14px rgba(0, 0, 0, 0.3);
            }
        }

        /* 真正收起且未悬停、未固定时的内部样式覆写 */
        &:not(.is-hover):not(.is-pinned) {
            .toc-header {
                justify-content: center;
                padding: 0;
            }

            .toc-item {
                padding-left: 0 !important;
                justify-content: center;
                padding: 2px 0;

                /* 激活状态下的小圆点特效 */
                &.is-active .toc-indicator {
                    background-color: #5045de;
                    transform: scale(1.5);
                    box-shadow: 0 0 8px rgba(80, 69, 222, 0.5);
                }
            }

            .toc-indicator {
                display: block;
            }

            .toc-text {
                opacity: 0;
                width: 0;
                flex: 0;
            }
        }
    }
}
</style>
