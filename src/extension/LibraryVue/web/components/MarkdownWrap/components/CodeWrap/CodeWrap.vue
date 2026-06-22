<template>
    <div
        class="StarmapCodeWrap"
        :class="{
            'mode-preview': mode == 'preview',
            'is-collapsed': isCollapsed,
        }"
        :modifer
    >
        <div class="preview-warp-box" v-if="mode == 'preview'">
            <slot name="preview"></slot>
        </div>
        <div class="code-warp-box" :class="{ 'has-scrollbar': hasCodeWrapScrollBar, 'is-expanded': expandCodeBox }">
            <div class="title-bar" v-if="title">
                <hd-icon v-if="icon" :icon="icon"></hd-icon>
                <span>{{ title }}</span>
            </div>

            <div class="actions-bar">
                <!-- 展开按钮 -->
                <button
                    v-if="hasCodeWrapScrollBar || expandCodeBox"
                    @click="expandCodeBox = !expandCodeBox"
                    :title="expandCodeBox ? '收起代码' : '展开代码'"
                >
                    <hd-icon :icon="expandCodeBox ? 'ri:contract-up-down-line' : 'ri:expand-up-down-line'"></hd-icon>
                </button>
                <!-- 复制按钮 -->
                <button :title="isCopied ? '已复制' : '复制代码'" @click="copyCode" :class="{ 'is-copied': isCopied }">
                    <hd-icon :icon="isCopied ? 'ri:check-line' : 'ri:file-copy-line'"></hd-icon>
                </button>
                <div class="code-lang-display" v-if="lang">{{ lang }}</div>
            </div>

            <slot></slot>
            <div class="has-scrollbar-mask" v-if="hasCodeWrapScrollBar && !expandCodeBox">
                <button @click="expandCodeBox = true">
                    <hd-icon icon="ri:expand-up-down-line"></hd-icon>
                    展开
                </button>
            </div>
        </div>
    </div>
</template>

<style>
.StarmapCodeWrap {
    position: relative;
    margin: 1em 0;

    &.is-collapsed {
        pre.shiki {
            overflow: hidden;
        }
    }

    &.full .code-warp-box {
        max-height: none;
    }

    &.min .code-warp-box:not(.is-expanded) {
        height: 32px;
        .has-scrollbar-mask,
        pre code {
            display: none;
        }
    }

    .title-bar {
        display: flex;
        align-items: center;
        flex: none;
        gap: 6px;
        padding: 0px 16px;
        height: 32px;
        box-sizing: border-box;
        font-size: 13px;
        font-weight: 500;
        color: rgba(90, 100, 125, 0.9);
        background: rgba(213, 221, 239, 0.25);
        text-shadow: 0 1px rgba(255, 255, 255, 0.9);
        hd-icon {
            font-size: 16px;
        }
    }
}

.starmap-markdown-render {
    .code-warp-box {
        .actions-bar {
            position: absolute;
            top: 0;
            right: 0px;
            height: 30px;
            z-index: 1;
            display: flex;
            place-items: center;
            gap: 2px;

            button {
                display: flex;
                flex: none;
                place-items: center;
                place-content: center;
                border-radius: 6px;
                height: 24px;
                width: 24px;
                border: none;
                border-top: none;
                background: var(--md-code-bk-color);
                transition: all 0.15s ease;
                color: rgba(118, 130, 159, 0.6);
                text-shadow: 0 1px rgba(255, 255, 255, 0.9);
                cursor: pointer;
                font-size: 15px;
                position: relative;

                &:hover {
                    background: rgba(213, 221, 239, 0.5);
                }

                &:active {
                    background: rgba(202, 210, 228, 0.8);
                }
                hd-icon {
                    font-size: 15px;
                    font-weight: bold;
                }

                /** 隐藏的点击范围，多 4px 点击范围 */
                &::before {
                    content: "";
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    bottom: -4px;
                    left: -4px;
                }
            }

            .code-lang-display {
                color: rgba(118, 130, 159, 0.74);
                text-shadow: 0 1px rgba(255, 255, 255, 0.9);
                /* background: rgba(213, 221, 239, 0.5); */
                /* border: 1px solid rgba(213, 221, 239, 1); */
                border-radius: 9px;
                padding: 0 10px;
                padding-left: 6px;
                height: 100%;
                display: flex;
                align-items: center;
                font-family: "Roboto Mono", monospace;
                font-size: 12px;
                font-weight: 400;
                letter-spacing: 0;
                height: 22px;
                margin-right: 4px;
            }
        }

        .has-scrollbar-mask {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 100px;
            background: linear-gradient(
                to bottom,
                transparent 0%,
                rgba(245, 246, 252, 0.9) 40%,
                rgba(245, 246, 252, 1)
            );
            display: flex;
            justify-content: center;
            align-items: end;
            padding-bottom: 1em;

            button {
                border-radius: 9999px;
                padding: 0.5rem 1.25rem;
                padding-left: 0.8em;
                gap: 0.4em;
                border: none;
                background: #3a3a658c;
                transition: all 0.15s ease;
                color: #fff;
                cursor: pointer;
                font-size: 16px;
                box-shadow: 0 4px 16px #2a2d4310;
                display: flex;
                place-items: center;
                place-content: center;

                &:hover {
                    background: #03011ec4;
                }
            }
        }
    }
}

/* 夜间模式 */
.is-dark-theme .StarmapCodeWrap {
    .title-bar {
        color: rgba(155, 168, 195, 0.9);
        background: rgba(28, 32, 52, 0.7);
        text-shadow: none;
    }
}

.is-dark-theme .starmap-markdown-render {
    .code-warp-box {
        .actions-bar {
            button {
                color: rgba(138, 150, 178, 0.7);
                text-shadow: none;

                &:hover {
                    background: rgba(38, 44, 70, 0.7);
                }

                &:active {
                    background: rgba(48, 55, 85, 0.9);
                }
            }

            .code-lang-display {
                color: rgba(138, 150, 178, 0.74);
                text-shadow: none;
            }
        }

        .has-scrollbar-mask {
            background: linear-gradient(to bottom, transparent 0%, rgb(28 32 52 / 92%) 40%, rgb(28 32 52));
        }
    }
}

.is-dark-theme .starmap-markdown-render .mode-preview {
    .preview-warp-box {
        background: #191927;
        border-color: rgb(28 32 52);
    }

    &[modifer="left"],
    &[modifer="right"] {
        background-color: rgb(28 32 52);
    }
}

.starmap-markdown-render .mode-preview {
    border-radius: 14px;
    margin-top: 1em;

    .code-warp-box {
        border-radius: 0 0 12px 12px;
        margin-top: 0;
    }

    .preview-warp-box {
        background: #fff;
        padding: 16px 20px;
        border-radius: 12px 12px 0 0;
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        border: 3px solid rgb(245 246 252);
        border-bottom: none;
    }

    /* 水平布局 */
    &[modifer="left"],
    &[modifer="right"] {
        display: flex;
        justify-content: flex-start;
        gap: 1em;
        background-color: rgb(245 246 252);
        border-radius: 14px;
        overflow: hidden;

        & > * {
            flex: auto;
            border: none;
        }
        .preview-warp-box {
            border-radius: 12px;
            margin: 4px;
        }
    }
    &[modifer="right"] {
        flex-direction: row-reverse;
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    name: "StarmapCodeWrap",
    props: {
        /**
         * 显示模式
         *
         * - default: 默认模式
         * - preview: 预览模式
         */
        mode: {
            type: String,
        },

        /**
         * 显示修饰符
         *
         * - left:  水平显示，展示框在左
         * - right: 水平显示，展示框在右
         */
        modifer: {
            type: String,
        },

        /**
         * 标题
         */
        title: {
            type: String,
        },

        /**
         * 标题图标
         */
        icon: {
            type: String,
        },
    },
    data() {
        return {
            lang: "",
            // 代码框是否显示滚动条
            hasCodeWrapScrollBar: false,
            // 是否已展开代码框
            expandCodeBox: false,
            // 是否已复制代码
            isCopied: false,
        }
    },
    mounted() {
        this.init()
    },
    beforeUnmount() {
        if ((this as any).resizeObserver) {
            ;(this as any).resizeObserver.disconnect()
        }
    },
    methods: {
        /**
         * 复制代码
         * 获取 shiki 代码框的文本内容并将其写入到系统剪贴板中
         */
        async copyCode() {
            const codeEl = this.$el.querySelector("pre.shiki")
            if (codeEl && codeEl.textContent) {
                try {
                    // textContent 会保留代码块中的格式和换行
                    await navigator.clipboard.writeText(codeEl.textContent)
                    this.isCopied = true
                    // 2秒后重置复制状态图标
                    setTimeout(() => {
                        this.isCopied = false
                    }, 2000)
                } catch (err) {
                    console.error("复制失败: ", err)
                }
            }
        },

        init() {
            // 读取 lang
            const codeEl = this.$el.querySelector("pre.shiki")
            if (codeEl) {
                setTimeout(() => {
                    this.lang = codeEl.getAttribute("data-language")

                    // 检测代码框是否显示滚动条 code-warp-box
                    const checkScroll = () => {
                        if (this.$el && this.$el.classList.contains("full")) {
                            this.hasCodeWrapScrollBar = false
                            return
                        }
                        if (this.$el && this.$el.classList.contains("min")) {
                            this.hasCodeWrapScrollBar = true
                            return
                        }
                        const scrollHeight = codeEl.scrollHeight
                        const clientHeight = codeEl.clientHeight
                        this.hasCodeWrapScrollBar = scrollHeight > clientHeight
                    }

                    checkScroll()

                    // 监听大小变化以更新滚动条状态
                    const observer = new ResizeObserver(checkScroll)
                    observer.observe(codeEl)
                    ;(this as any).resizeObserver = observer
                }, 0)
            }
        },
    },

    computed: {
        isCollapsed() {
            return this.hasCodeWrapScrollBar && !this.expandCodeBox
        },
    },
})
</script>
