<template>
    <div class="Starmap-PageTabs-container">
        <!-- 标签头 -->
        <div class="Starmap-PageTabs">
            <div class="Starmap-PageTabs-scroll" ref="scrollArea">
                <div
                    v-for="tab in tabs"
                    :key="tab.value"
                    class="Starmap-PageTabs-item"
                    :class="{ 'is-active': modelValue === tab.value }"
                    @click="selectTab(tab.value)"
                >
                    <hd-icon v-if="tab.icon" :icon="tab.icon" class="Starmap-PageTabs-icon" />
                    <span class="Starmap-PageTabs-label">{{ tab.title }}</span>
                </div>
                <div class="Starmap-PageTabs-indicator" :class="{ 'is-ready': isReady }" :style="indicatorStyle"></div>
            </div>
        </div>
        <!-- 内容区域 -->
        <div class="Starmap-PageTabs-content">
            <slot />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"

export interface IPageTab {
    title: string
    value: string | number
    icon?: string
}

export default defineComponent({
    name: "PageTabs",
    props: {
        /** 绑定的选中值 (v-model) */
        modelValue: {
            type: [String, Number] as PropType<string | number>,
            required: false,
            default: "readme",
        },
    },
    emits: ["update:modelValue", "change"],
    data() {
        return {
            tabs: [] as IPageTab[],
            isReady: false,
            indicatorStyle: {
                width: "0px",
                transform: "translateX(0px)",
                opacity: "0",
            },
        }
    },
    watch: {
        modelValue() {
            this.updateIndicator()
        },
        tabs: {
            deep: true,
            handler() {
                this.updateIndicator()
            },
        },
    },
    mounted() {
        window.addEventListener("resize", this.updateIndicator)
        this.$nextTick(() => {
            this.updateIndicator()
            // 延迟一点点再次更新，确保一些由于布局重新计算后的位置准确
            setTimeout(() => {
                this.updateIndicator()
                // 标记为已就绪，从而开启指示器的过渡动画
                this.$nextTick(() => {
                    this.isReady = true
                })
            }, 100)
        })
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.updateIndicator)
    },
    provide() {
        return {
            pageTabs: this,
        }
    },
    methods: {
        /**
         * 点击切换标签页
         * @param value 被点击的标签页值
         */
        selectTab(value: string | number) {
            if (this.modelValue !== value) {
                this.$emit("update:modelValue", value)
                this.$emit("change", value)
            }
        },
        /**
         * 注册一个新的标签页
         */
        addTab(tab: IPageTab) {
            this.tabs.push(tab)
            // 如果只有一项且没有选中值，默认选中第一项
            if (this.tabs.length === 1 && this.modelValue === undefined) {
                this.selectTab(tab.value)
            }
        },
        /**
         * 移除一个标签页
         */
        removeTab(value: string | number) {
            const index = this.tabs.findIndex((t) => t.value === value)
            if (index !== -1) {
                this.tabs.splice(index, 1)
            }
        },
        /**
         * 更新已有标签页的信息
         */
        updateTab(value: string | number, newTab: IPageTab) {
            const index = this.tabs.findIndex((t) => t.value === value)
            if (index !== -1) {
                this.tabs.splice(index, 1, newTab)
            }
        },
        /**
         * 更新指示器位置
         */
        updateIndicator() {
            this.$nextTick(() => {
                const scrollArea = this.$refs.scrollArea as HTMLElement
                if (!scrollArea) return
                const activeEl = scrollArea.querySelector(".Starmap-PageTabs-item.is-active") as HTMLElement
                if (activeEl) {
                    this.indicatorStyle = {
                        width: `${activeEl.offsetWidth}px`,
                        transform: `translateX(${activeEl.offsetLeft}px)`,
                        opacity: "1",
                    }
                    const scrollLeft = scrollArea.scrollLeft
                    const scrollRight = scrollLeft + scrollArea.clientWidth
                    const elLeft = activeEl.offsetLeft
                    const elRight = elLeft + activeEl.offsetWidth
                    if (elLeft < scrollLeft) {
                        scrollArea.scrollTo({ left: elLeft - 20, behavior: "smooth" })
                    } else if (elRight > scrollRight) {
                        scrollArea.scrollTo({ left: elRight - scrollArea.clientWidth + 20, behavior: "smooth" })
                    }
                } else {
                    this.indicatorStyle.opacity = "0"
                }
            })
        },
    },
})
</script>

<style>
.Starmap-PageTabs-container {
    display: flex;
    flex-direction: column;
    width: auto;
    height: auto;
    flex: auto;
    position: relative;
    overflow: hidden;
}

.Starmap-PageTabs {
    display: flex;
    place-items: center;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05); /* 更加柔和的底线 */
    padding: 8px 16px;
    height: 52px;
    user-select: none;
    font-family: var(--starmap-base-font);
    flex: none;
    position: absolute;
    width: 100%;
    top: 0;
    box-sizing: border-box;
    z-index: 100;
    pointer-events: none;
    background-color: transparent;
    place-content: flex-end;
}

.is-dark-theme .Starmap-PageTabs {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.Starmap-PageTabs-scroll {
    display: flex;
    flex-direction: row;
    position: relative;
    max-width: fit-content; /* 包裹内容 */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    pointer-events: auto;
    padding: 4px;
    background-color: var(--starmap-control-bk);
    border-radius: 10px;
    gap: 2px;
}

.is-dark-theme .Starmap-PageTabs-scroll {
    background-color: rgb(21 21 32);
    border: 1px solid #22263d;
}

.Starmap-PageTabs-scroll::-webkit-scrollbar {
    display: none;
}

.Starmap-PageTabs-item {
    display: flex;
    place-items: center;
    place-content: center;
    gap: 6px;
    padding: 12px;
    height: 28px;
    box-sizing: border-box;
    cursor: pointer;
    color: var(--starmap-nav-item-text);
    position: relative;
    transition: color 0.15s ease-in-out;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    pointer-events: auto;
    flex-shrink: 0;
    z-index: 2;
    opacity: 0.7;
    text-transform: capitalize;
}

.Starmap-PageTabs-item.is-active {
    color: var(--starmap-nav-item-text);
    opacity: 1;
}

.Starmap-PageTabs-indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    background-color: #ffffff; /* Shadcn 风格白色背景按钮 */
    border-radius: 7px;
    pointer-events: none;
    z-index: 1;
    box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.1),
        0 1px 2px rgba(0, 0, 0, 0.06);
}

.Starmap-PageTabs-indicator.is-ready {
    transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.is-dark-theme .Starmap-PageTabs-indicator {
     background-color: #27273f;
    border: 1px solid #32324a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.Starmap-PageTabs-icon {
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -3px;
}

.Starmap-PageTabs-content {
    flex: auto;
    position: relative;
    overflow: hidden;
    overflow-y: auto;
    margin-top: 54px;
}
</style>
