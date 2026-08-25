<template>
    <!-- 根布局：侧边栏 + 内容区域 -->
    <div class="Starmap-Root" :class="{ 'is-resizing': isResizing, 'is-collapsed': isCollapsed }">
        <aside class="Starmap-Root__sidebar" :style="{ width: isCollapsed ? '' : sidebarWidth + 'px' }">
            <div class="title-bar">
                <div class="project-icon">
                    <img :src="projectIconUrl" />
                </div>
                <div class="project-name">{{ projectName }}</div>

                <div class="buttons">
                    <button class="sidebar-expand-button" @click="toggleSidebar">
                        <hd-icon icon="ri-side-bar-fill" />
                    </button>
                </div>
            </div>
            <div class="tree-box">
                <UnitTree
                    :units="unitsTree"
                    :initial-selected-id="selectedId"
                    :always-sticky="alwaysSticky"
                    @navigate="handleNavigate"
                />
            </div>
            <div class="foot-bar">
                <div class="buttons">
                    <button class="dark-mode-button" @click="toggleTheme">
                        <hd-icon :icon="isDarkTheme ? 'ri-sun-fill' : 'ri-moon-fill'" />
                    </button>
                    <button class="help-button" :class="{ active: isHelpActive }" @click="openHelp">
                        <hd-icon icon="ri-book-2-fill" />
                    </button>
                </div>
            </div>
        </aside>
        <main class="Starmap-Root__content">
            <router-view />
        </main>
        <!-- 拖拽手柄：absolute 定位，不占布局空间 -->
        <div
            v-if="!isCollapsed"
            class="Starmap-Root__resize-handle"
            :style="{ left: sidebarWidth + 'px' }"
            @mousedown.prevent="onResizeStart"
        >
            <div class="Starmap-Root__resize-handle-line"></div>
        </div>

        <!-- 页面根组件：支持用户在配置中自定义的 rootComponents -->
        <component
            v-for="(comp, idx) in resolvedRootComponents"
            :is="comp"
            :key="idx"
        />
    </div>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue"
import { fmt } from "fzz"
import UnitTree from "../components/UnitTree/UnitTree.vue"
import starmapIcon from "../public/assets/starmap-icon.svg"

/** 侧边栏宽度范围限制 */
const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 600
const SIDEBAR_DEFAULT_WIDTH = 300

/**
 * 规范化用户配置的根组件，避免 Vue 将组件定义转换为响应式对象
 * @param components 用户配置中的根组件列表
 */
function normalizeRootComponents(components: any): any[] {
    if (!Array.isArray(components)) return []

    return components.map((item: any) => {
        const component = item && typeof item === "object" && item.component ? item.component : item
        return component && typeof component === "object" ? markRaw(component) : component
    })
}

export default defineComponent({
    components: { UnitTree },
    data() {
        return {
            /** 侧栏目录树数据：初始从全局读取，热更新时通过 starmap:meta-updated 同步 */
            unitsTree: window.__starmap__?.unitsTree ?? [],
            /** 根元数据快照，保证 projectName / alwaysSticky 等也能随热更新刷新 */
            rootMetadata: window.__starmap__?.rootMetadata ?? null,
            /** 根组件列表，从全局配置中获取 */
            rootComponents: normalizeRootComponents(window.__starmap__?.__root_components__),
            sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
            isResizing: false,
            isCollapsed: false,
            isDarkTheme: false,
        }
    },
    methods: {
        /**
         * 从 window.__starmap__ 同步目录树与根元数据
         * metadata.ts / unit.vue 在 HMR 或导航时会 dispatch starmap:meta-updated
         */
        syncFromGlobalMeta() {
            this.unitsTree = window.__starmap__?.unitsTree ?? []
            this.rootMetadata = window.__starmap__?.rootMetadata ?? null
            this.rootComponents = normalizeRootComponents(window.__starmap__?.__root_components__)
        },
        toggleTheme() {
            this.isDarkTheme = !this.isDarkTheme
            document.documentElement.classList.toggle("is-dark-theme", this.isDarkTheme)
        },
        toggleSidebar() {
            this.isCollapsed = !this.isCollapsed
        },
        openHelp() {
            this.handleNavigate("starmap-usege")
        },
        /**
         * SPA 导航：通过 vue-router 跳转到对应 Unit 页面
         * 如果路由错误，则硬跳转
         * @param id 目标 Unit 节点 ID
         */
        handleNavigate(id: string) {
            if (id === this.selectedId) return
            this.$router.push(`/units/${id}`).catch(() => {
                window.location.hash = `#/units/${id}`
            })
        },
        /** 开始拖拽：记录初始位置，绑定全局事件 */
        onResizeStart(e: MouseEvent) {
            this.isResizing = true
            const startX = e.clientX
            const startWidth = this.sidebarWidth

            const onMouseMove = (e: MouseEvent) => {
                const delta = e.clientX - startX
                const newWidth = startWidth + delta
                // 限制在最小/最大宽度范围内
                this.sidebarWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth))
            }

            const onMouseUp = () => {
                this.isResizing = false
                document.removeEventListener("mousemove", onMouseMove)
                document.removeEventListener("mouseup", onMouseUp)
            }

            document.addEventListener("mousemove", onMouseMove)
            document.addEventListener("mouseup", onMouseUp)
        },
    },
    mounted() {
        console.log(...fmt("🌟 <Starmap> mounted.", { __starmap__: window.__starmap__ }))
        // Initialize theme state from html class if it exists from previous load
        this.isDarkTheme = document.documentElement.classList.contains("is-dark-theme")
        // 监听热更新：units-tree.json 变更后 metadata 模块会 dispatch 此事件
        window.addEventListener("starmap:meta-updated", this.syncFromGlobalMeta)
        // 挂载时再同步一次，避免 metadata 脚本在 app mount 之后才完成时拿到空树
        this.syncFromGlobalMeta()
    },
    beforeUnmount() {
        window.removeEventListener("starmap:meta-updated", this.syncFromGlobalMeta)
    },
    computed: {
        /** 当前选中的 Unit ID，从路由路径中获取 */
        selectedId(): string | undefined {
            const path = this.$route.path
            if (path.startsWith("/units/")) {
                return path.substring("/units/".length)
            }
            return undefined
        },
        projectName() {
            return this.rootMetadata?.projectName ?? "Starmap"
        },
        projectIconUrl() {
            return starmapIcon
        },
        /** 树列表是否总是启用 sticky 吸顶效果 */
        alwaysSticky(): boolean {
            return this.rootMetadata?.uiTreeDirAlwaysSticky ?? false
        },
        isHelpActive(): boolean {
            return this.selectedId === "starmap-usege"
        },
        /** 解析后的根组件列表 */
        resolvedRootComponents(): any[] {
            return this.rootComponents || []
        },
    },
})
</script>

<style>
.Starmap-Root {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    min-height: 100vh;
    padding: 0;
    box-sizing: border-box;
}

/* 拖拽时禁用文本选择和 iframe 指针事件 */
.Starmap-Root.is-resizing {
    cursor: col-resize;
    user-select: none;
}
.Starmap-Root.is-resizing iframe {
    pointer-events: none;
}

.Starmap-Root__sidebar {
    display: flex;
    flex-direction: column;
    background: var(--starmap-nav-background);
    border-right: 1px solid transparent;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    box-sizing: border-box;

    &::before {
        content: "";
        position: absolute;
        top: 0;
        left: auto;
        right: -4px;
        width: 4px;
        height: 100%;
        box-shadow: var(--starmap-nav-shadow);
    }

    .title-bar {
        flex: none;
        padding: 14px;
        display: flex;
        align-items: center;

        .project-icon {
            width: 28px;
            height: 28px;
            margin-right: 8px;
            display: flex;
            align-items: center;
            justify-content: center;

            img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
        }
        .project-name {
            color: var(--starmap-nav-logo);
            font-weight: bolder;
            font-size: 18px;
            font-family: var(--starmap-base-font);
            white-space: nowrap;
        }
    }

    .buttons {
        display: flex;
        margin-left: auto;
        gap: 4px;

        button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: transparent;
            border: none;
            border-radius: 6px;
            color: var(--starmap-button-icon-text, #40408d);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 18px;
            box-sizing: border-box;
            flex: none;

            &:hover {
                background-color: rgba(64, 64, 141, 0.08);
            }

            &:active {
                background-color: rgba(64, 64, 141, 0.15);
                transform: scale(0.96);
            }

            &.active {
                background-color: rgba(64, 64, 141, 0.12);
            }

            hd-icon {
                width: 1em;
                height: 1em;
                display: grid;
                place-items: center;
            }
        }
    }

    .tree-box {
        flex: auto;
        overflow: hidden;
        overflow-y: scroll;
        padding-left: 8px;
        padding-bottom: 4px;

        &::-webkit-scrollbar-thumb {
            background-color: var(--starmap-nav-scroll-thumb-bk);
            border: 7px solid var(--starmap-nav-background);
            border-radius: 10px;
            transition: all 0.5s;
        }

        &::-webkit-scrollbar-thumb:hover {
            background-color: var(--starmap-nav-scroll-thumb-bk-hover);
        }

        &::-webkit-scrollbar {
            width: 18px;
            height: 18px;
        }
    }

    .foot-bar {
        flex: none;
        padding: 8px 14px;
        padding-top: 3px;
        margin-top: auto;
        box-shadow: -10px 0 10px 5px var(--starmap-nav-background);
        z-index: 1;
    }
}

/* 拖拽手柄：absolute 定位，不占布局空间，跟随 sidebarWidth 定位 */
.Starmap-Root__resize-handle {
    position: absolute;
    top: 0;
    height: 100%;
    width: 8px;
    margin-left: -4px;
    cursor: col-resize;
    z-index: 10;
    display: flex;
    align-items: stretch;
    justify-content: center;
}

.Starmap-Root__resize-handle-line {
    width: 2px;
    background: transparent;
    border-radius: 1px;
    transition: background 0.15s ease;
}

.Starmap-Root__resize-handle:hover .Starmap-Root__resize-handle-line,
.Starmap-Root.is-resizing .Starmap-Root__resize-handle-line {
    background: rgba(31, 111, 200, 0.5);
}

.Starmap-Root__content {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: var(--starmap-doc-background);
}

/* 侧边栏收起状态 */
.Starmap-Root.is-collapsed .Starmap-Root__sidebar {
    width: 48px !important;
    transition: width 0.2s cubic-bezier(0.2, 0, 0, 1);
    overflow: hidden;
}

.Starmap-Root:not(.is-resizing) .Starmap-Root__sidebar {
    transition: width 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.Starmap-Root.is-collapsed .project-name,
.Starmap-Root.is-collapsed .project-icon,
.Starmap-Root.is-collapsed .tree-box {
    display: none;
}

.Starmap-Root.is-collapsed .Starmap-Root__sidebar .title-bar {
    padding: 12px 0;
    justify-content: center;
}

.Starmap-Root.is-collapsed .foot-bar {
    padding: 12px 0;
}

.Starmap-Root.is-collapsed .buttons {
    margin-left: 0;
    flex-direction: column;
    align-items: center;
}

@media (max-width: 600px) {
    .Starmap-Root {
        grid-template-columns: 1fr;
    }

    .Starmap-Root__sidebar {
        width: 100% !important;
        border-right: none;
        border-bottom: 1px solid rgba(31, 35, 40, 0.08);
        padding-right: 0;
        padding-bottom: 12px;
        display: flex;
    }

    .Starmap-Root__resize-handle {
        display: none;
    }
}

.is-dark-theme .Starmap-Root__sidebar {
    & .buttons {
        & button {
            &.active {
                background-color: rgb(134 134 217 / 18%);
            }
        }
    }
}
</style>
