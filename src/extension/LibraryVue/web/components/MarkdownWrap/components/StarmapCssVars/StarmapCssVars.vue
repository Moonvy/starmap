<template>
    <div class="starmap-css-vars-wrap" :class="{ 'is-editing': isEditing }" :style="rootStyle">
        <!-- 头部工具栏 -->
        <div class="starmap-css-vars-header">
            <div class="header-left">
                <span class="file-badge">
                    <hd-icon icon="ri:palette-line" class="file-icon" />
                    <span class="file-title">{{ displayTitle }}</span>
                </span>
                <span class="vars-count" v-if="varCount > 0">{{ varCount }} 个变量</span>
            </div>

            <div class="header-right">
                <!-- 搜索框 -->
                <div class="search-box" v-if="varCount > 4">
                    <hd-icon icon="ri:search-line" class="search-icon" />
                    <input
                        type="text"
                        v-model="searchQuery"
                        placeholder="搜索变量名或注释..."
                        class="search-input"
                    />
                    <button
                        v-if="searchQuery"
                        class="clear-search-btn"
                        @click="searchQuery = ''"
                        title="清空搜索"
                    >
                        <hd-icon icon="ri:close-line" />
                    </button>
                </div>

                <!-- 编辑开关 -->
                <label class="edit-toggle" :class="{ 'is-active': isEditing }" title="切换实时编辑模式">
                    <input type="checkbox" v-model="isEditing" class="edit-toggle-checkbox" />
                    <span class="toggle-slider">
                        <hd-icon icon="ri:edit-2-line" class="toggle-icon" />
                    </span>
                    <span class="toggle-label">编辑变量</span>
                </label>

                <!-- 实时保存状态反馈提示 -->
                <transition name="fade">
                    <span class="status-tip tip-saving" v-if="saving">
                        <hd-icon icon="ri:loader-4-line" class="is-spinning" />
                        写回中...
                    </span>
                    <span class="status-tip tip-saved" v-else-if="saveStatus === 'saved'">
                        <hd-icon icon="ri:checkbox-circle-fill" />
                        已写回文件
                    </span>
                    <span class="status-tip tip-error" v-else-if="saveStatus === 'error'">
                        <hd-icon icon="ri:error-warning-fill" />
                        {{ errorMessage || "保存失败" }}
                    </span>
                </transition>
            </div>
        </div>

        <!-- 主体列表区域 -->
        <div class="starmap-css-vars-body">
            <div v-if="loading" class="loading-state">
                <hd-icon icon="ri:loader-4-line" class="loading-spinner is-spinning" />
                <span>正在加载 CSS 变量...</span>
            </div>

            <div v-else-if="errorMessage && entries.length === 0" class="error-state">
                <hd-icon icon="ri:error-warning-line" class="error-icon" />
                <span>加载失败: {{ errorMessage }}</span>
            </div>

            <div v-else-if="filteredEntries.length === 0" class="empty-state">
                <hd-icon icon="ri:inbox-line" class="empty-icon" />
                <span>未找到匹配的 CSS 变量</span>
            </div>

            <div v-else class="vars-list">
                <template v-for="item in filteredEntries" :key="item.id">
                    <!-- 注释块 -->
                    <div v-if="item.type === 'comment'" class="item-comment-block">
                        <span class="comment-prefix">/*</span>
                        <span class="comment-content">{{ item.comment }}</span>
                        <span class="comment-suffix">*/</span>
                    </div>

                    <!-- 选择器标签 -->
                    <div v-else-if="item.type === 'selector'" class="item-selector-block">
                        <span class="selector-tag">{{ item.selector }}</span>
                    </div>

                    <!-- CSS 变量行 -->
                    <div v-else-if="item.type === 'var'" class="var-row" :class="{ 'is-color-var': item.isColor }">
                        <!-- 色块指示器 -->
                        <div class="var-swatch-col">
                            <div
                                v-if="item.isColor"
                                class="color-swatch-wrapper"
                                :title="isEditing ? '点击调整颜色' : item.value"
                                @click="triggerColorPicker(item.id)"
                            >
                                <div class="color-swatch-checkerboard">
                                    <div
                                        class="color-swatch-fill"
                                        :style="{ backgroundColor: item.value }"
                                    ></div>
                                </div>
                                <input
                                    v-if="isEditing"
                                    :ref="`picker_${item.id}`"
                                    type="color"
                                    :value="getHexColor(item.value)"
                                    @input="onColorPickerChange(item, $event)"
                                    class="hidden-color-input"
                                />
                            </div>
                            <div v-else class="non-color-icon" title="常规变量">
                                <hd-icon icon="ri:equalizer-line" />
                            </div>
                        </div>

                        <!-- 变量名称 -->
                        <div class="var-name-col" @click="copyText(item.name!, `name_${item.id}`)">
                            <code class="var-name-text">{{ item.name }}</code>
                            <button
                                class="copy-btn"
                                :class="{ 'is-copied': copiedKey === `name_${item.id}` }"
                                :title="copiedKey === `name_${item.id}` ? '已复制' : '复制变量名'"
                            >
                                <hd-icon :icon="copiedKey === `name_${item.id}` ? 'ri:check-line' : 'ri:file-copy-line'" />
                            </button>
                        </div>

                        <!-- 冒号分隔符 -->
                        <div class="var-colon">:</div>

                        <!-- 变量值（展示或编辑） -->
                        <div class="var-value-col">
                            <div v-if="isEditing" class="var-value-edit-wrap">
                                <input
                                    type="text"
                                    :value="item.value"
                                    @input="onVarValueInput(item, $event)"
                                    class="var-value-input"
                                    :placeholder="item.name"
                                />
                            </div>
                            <div
                                v-else
                                class="var-value-display-wrap"
                                @click="copyText(item.value!, `val_${item.id}`)"
                            >
                                <code class="var-value-text">{{ item.value }}</code>
                                <button
                                    class="copy-btn"
                                    :class="{ 'is-copied': copiedKey === `val_${item.id}` }"
                                    :title="copiedKey === `val_${item.id}` ? '已复制' : '复制变量值'"
                                >
                                    <hd-icon :icon="copiedKey === `val_${item.id}` ? 'ri:check-line' : 'ri:file-copy-line'" />
                                </button>
                            </div>
                        </div>

                        <!-- 行内注释说明 -->
                        <div class="var-comment-col" v-if="item.inlineComment">
                            <span class="inline-comment-text">/* {{ item.inlineComment }} */</span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<style>
.starmap-css-vars-wrap {
    margin: 1.5em 0;
    border-radius: 12px;
    border: 1px solid rgba(220, 226, 235, 0.9);
    background: #ffffff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    font-family: var(--starmap-content-font), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: all 0.25s ease;

    .is-dark-theme & {
        background: #181825;
        border-color: rgba(60, 65, 95, 0.8);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    &.is-editing {
        border-color: rgba(99, 102, 241, 0.6);
        box-shadow: 0 6px 24px rgba(99, 102, 241, 0.12);

        .is-dark-theme & {
            border-color: rgba(129, 140, 248, 0.6);
            box-shadow: 0 6px 24px rgba(99, 102, 241, 0.2);
        }
    }

    /* 头部栏 */
    .starmap-css-vars-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 18px;
        background: rgba(248, 250, 252, 0.9);
        border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        gap: 12px;
        flex-wrap: wrap;

        .is-dark-theme & {
            background: rgba(30, 30, 46, 0.85);
            border-bottom-color: rgba(60, 65, 95, 0.8);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;

            .file-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-weight: 600;
                font-size: 13.5px;
                color: #1e293b;

                .is-dark-theme & {
                    color: #e2e8f0;
                }

                .file-icon {
                    font-size: 16px;
                    color: #6366f1;

                    .is-dark-theme & {
                        color: #818cf8;
                    }
                }

                .file-title {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }
            }

            .vars-count {
                font-size: 11.5px;
                padding: 2px 7px;
                border-radius: 20px;
                background: rgba(99, 102, 241, 0.1);
                color: #4f46e5;
                font-weight: 500;

                .is-dark-theme & {
                    background: rgba(129, 140, 248, 0.15);
                    color: #a5b4fc;
                }
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-left: auto;

            .search-box {
                position: relative;
                display: flex;
                align-items: center;

                .search-icon {
                    position: absolute;
                    left: 9px;
                    font-size: 14px;
                    color: #94a3b8;
                    pointer-events: none;
                }

                .search-input {
                    padding: 5px 26px 5px 28px;
                    font-size: 12.5px;
                    border-radius: 6px;
                    border: 1px solid rgba(203, 213, 225, 0.8);
                    background: #ffffff;
                    color: #334155;
                    width: 150px;
                    transition: all 0.2s ease;

                    &:focus {
                        outline: none;
                        width: 190px;
                        border-color: #6366f1;
                        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
                    }

                    .is-dark-theme & {
                        background: #11111b;
                        border-color: rgba(71, 85, 105, 0.6);
                        color: #cbd5e1;

                        &:focus {
                            border-color: #818cf8;
                        }
                    }
                }

                .clear-search-btn {
                    position: absolute;
                    right: 6px;
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 0;
                    font-size: 13px;

                    &:hover {
                        color: #475569;
                    }
                }
            }

            /* 编辑切换开关 */
            .edit-toggle {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                user-select: none;
                font-size: 13px;
                font-weight: 500;
                color: #64748b;
                transition: color 0.2s ease;

                .is-dark-theme & {
                    color: #94a3b8;
                }

                &:hover {
                    color: #4f46e5;
                    .is-dark-theme & {
                        color: #a5b4fc;
                    }
                }

                &.is-active {
                    color: #4f46e5;
                    .is-dark-theme & {
                        color: #818cf8;
                    }

                    .toggle-slider {
                        background: #6366f1;
                        border-color: #6366f1;

                        .toggle-icon {
                            color: #ffffff;
                        }
                    }
                }

                .edit-toggle-checkbox {
                    position: absolute;
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    border: 1px solid rgba(203, 213, 225, 0.9);
                    background: #ffffff;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

                    .is-dark-theme & {
                        background: #1e1e2e;
                        border-color: rgba(71, 85, 105, 0.6);
                    }

                    .toggle-icon {
                        font-size: 13px;
                        color: #64748b;
                    }
                }
            }

            /* 操作按钮 */
            .actions-group {
                display: flex;
                align-items: center;
                gap: 6px;

                .btn-action {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 10px;
                    font-size: 12.5px;
                    font-weight: 500;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s ease;

                    &:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    &.btn-reset {
                        background: rgba(241, 245, 249, 0.9);
                        color: #475569;
                        border-color: rgba(203, 213, 225, 0.6);

                        .is-dark-theme & {
                            background: rgba(45, 45, 65, 0.8);
                            color: #cbd5e1;
                            border-color: rgba(70, 75, 105, 0.6);
                        }

                        &:not(:disabled):hover {
                            background: #e2e8f0;
                            color: #1e293b;
                        }
                    }

                    &.btn-save {
                        background: #e0e7ff;
                        color: #4338ca;
                        border-color: #c7d2fe;

                        .is-dark-theme & {
                            background: rgba(79, 70, 229, 0.2);
                            color: #c7d2fe;
                            border-color: rgba(99, 102, 241, 0.4);
                        }

                        &.has-changes {
                            background: #6366f1;
                            color: #ffffff;
                            border-color: #6366f1;
                            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);

                            &:not(:disabled):hover {
                                background: #4f46e5;
                            }
                        }
                    }
                }
            }

            /* 状态提示 */
            .status-tip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                font-weight: 500;

                &.tip-saved {
                    color: #10b981;
                }

                &.tip-error {
                    color: #ef4444;
                }
            }
        }
    }

    /* 主体内容 */
    .starmap-css-vars-body {
        padding: 8px 0;
        max-height: 650px;
        overflow-y: auto;

        .loading-state,
        .error-state,
        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 32px 16px;
            font-size: 13.5px;
            color: #64748b;

            .is-dark-theme & {
                color: #94a3b8;
            }
        }

        .error-state {
            color: #ef4444;
            .error-icon {
                font-size: 18px;
            }
        }

        .vars-list {
            display: flex;
            flex-direction: column;

            /* 注释块 */
            .item-comment-block {
                padding: 12px 18px 6px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12.5px;
                color: #64748b;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 4px;
                border-top: 1px dashed rgba(226, 232, 240, 0.8);
                margin-top: 6px;

                &:first-child {
                    border-top: none;
                    margin-top: 0;
                }

                .is-dark-theme & {
                    color: #94a3b8;
                    border-top-color: rgba(60, 65, 95, 0.6);
                }

                .comment-prefix,
                .comment-suffix {
                    color: #94a3b8;
                    opacity: 0.7;
                }

                .comment-content {
                    color: #475569;
                    .is-dark-theme & {
                        color: #cbd5e1;
                    }
                }
            }

            /* 选择器 */
            .item-selector-block {
                padding: 6px 18px 2px;

                .selector-tag {
                    display: inline-block;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 11.5px;
                    font-weight: 600;
                    color: #8b5cf6;
                    background: rgba(139, 92, 246, 0.1);
                    padding: 1px 6px;
                    border-radius: 4px;

                    .is-dark-theme & {
                        color: #c4b5fd;
                        background: rgba(139, 92, 246, 0.2);
                    }
                }
            }

            /* 变量行 */
            .var-row {
                display: flex;
                align-items: center;
                padding: 7px 18px;
                gap: 12px;
                transition: background 0.15s ease;
                border-bottom: 1px solid rgba(241, 245, 249, 0.6);

                .is-dark-theme & {
                    border-bottom-color: rgba(40, 40, 60, 0.5);
                }

                &:last-child {
                    border-bottom: none;
                }

                &:hover {
                    background: rgba(248, 250, 252, 0.8);

                    .is-dark-theme & {
                        background: rgba(35, 35, 55, 0.5);
                    }

                    .copy-btn {
                        opacity: 1;
                    }
                }

                /* 色块列 */
                .var-swatch-col {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;

                    .color-swatch-wrapper {
                        position: relative;
                        width: 24px;
                        height: 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        overflow: hidden;
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        transition: transform 0.15s ease, box-shadow 0.15s ease;

                        &:hover {
                            transform: scale(1.1);
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                        }

                        .is-dark-theme & {
                            border-color: rgba(255, 255, 255, 0.15);
                        }

                        .color-swatch-checkerboard {
                            width: 100%;
                            height: 100%;
                            background-image: linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                                linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                                linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                                linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
                            background-size: 8px 8px;
                            background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
                        }

                        .color-swatch-fill {
                            width: 100%;
                            height: 100%;
                        }

                        .hidden-color-input {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            opacity: 0;
                            cursor: pointer;
                            border: none;
                            padding: 0;
                            margin: 0;
                        }
                    }

                    .non-color-icon {
                        font-size: 15px;
                        color: #94a3b8;
                    }
                }

                /* 变量名列 */
                .var-name-col {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    width: var(--var-name-col-width, auto);
                    min-width: var(--var-name-col-width, auto);
                    flex-shrink: 0;
                    cursor: pointer;

                    .var-name-text {
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                        font-size: 13px;
                        font-weight: 600;
                        color: #0f172a;

                        .is-dark-theme & {
                            color: #f1f5f9;
                        }
                    }
                }

                .var-colon {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 13px;
                    color: #94a3b8;
                    user-select: none;
                }

                /* 变量值列 */
                .var-value-col {
                    flex: 1;
                    min-width: 160px;

                    .var-value-display-wrap {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        cursor: pointer;

                        .var-value-text {
                            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                            font-size: 13px;
                            color: #0284c7;
                            font-weight: 500;

                            .is-dark-theme & {
                                color: #38bdf8;
                            }
                        }
                    }

                    .var-value-edit-wrap {
                        .var-value-input {
                            width: 100%;
                            max-width: 280px;
                            padding: 4px 8px;
                            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                            font-size: 12.5px;
                            border-radius: 6px;
                            border: 1px solid #cbd5e1;
                            background: #ffffff;
                            color: #0f172a;
                            transition: all 0.2s ease;

                            &:focus {
                                outline: none;
                                border-color: #6366f1;
                                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                            }

                            .is-dark-theme & {
                                background: #11111b;
                                border-color: #475569;
                                color: #f8fafc;

                                &:focus {
                                    border-color: #818cf8;
                                }
                            }
                        }
                    }
                }

                /* 行内注释说明 */
                .var-comment-col {
                    margin-left: auto;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 12px;
                    color: #94a3b8;
                    white-space: nowrap;

                    .inline-comment-text {
                        color: #64748b;
                        .is-dark-theme & {
                            color: #94a3b8;
                        }
                    }
                }

                /* 复制按钮 */
                .copy-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    padding: 0;
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    border-radius: 4px;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.15s ease;

                    &:hover {
                        color: #6366f1;
                        background: rgba(99, 102, 241, 0.1);
                    }

                    &.is-copied {
                        opacity: 1;
                        color: #10b981;
                    }
                }
            }
        }
    }

    /* 动画 */
    .is-spinning {
        animation: starmap-spin 1s linear infinite;
    }

    @keyframes starmap-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.25s ease;
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }
}
</style>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { debounce } from "es-toolkit"
import {
    parseCssVars,
    updateCssVarInContent,
    colorToHex6,
    formatColorValue,
    isColorValue,
    CssVarEntry,
} from "./lib/cssVarsParser"

export default defineComponent({
    name: "StarmapCssVars",
    inject: {
        codeUnit: {
            default: null,
        },
    },
    props: {
        /** CSS 文件路径，支持相对路径或绝对路径 */
        src: {
            type: String,
            required: true,
        },
        /** 自定义展示标题，默认使用文件名 */
        title: {
            type: String,
            default: "",
        },
    },
    data() {
        return {
            loading: true,
            saving: false,
            saveStatus: "idle" as "idle" | "saving" | "saved" | "error",
            errorMessage: "",
            resolvedFilePath: "",
            originalContent: "",
            currentContent: "",
            entries: [] as CssVarEntry[],
            isEditing: false,
            searchQuery: "",
            hasChanges: false,
            copiedKey: "",
            _statusTimer: null as any,
            _debouncedSave: null as any,
        }
    },
    computed: {
        /** 计算展示用的标题 */
        displayTitle(): string {
            if (this.title) return this.title
            const pathStr = this.src || ""
            const fileName = pathStr.split("/").pop()?.split("\\").pop() || "var.css"
            return fileName
        },
        /** 变量总数统计 */
        varCount(): number {
            return this.entries.filter((item) => item.type === "var").length
        },
        /** 计算所有变量名中最长的字符长度 */
        maxNameLength(): number {
            const varEntries = this.entries.filter((item) => item.type === "var")
            if (varEntries.length === 0) return 0
            return Math.max(...varEntries.map((item) => item.name?.length || 0))
        },
        /** 根据最宽的变量名计算变量名列宽度 */
        nameColWidth(): string {
            if (this.maxNameLength === 0) return "160px"
            // 等宽字体字符宽度约为 8.2px，预留 36px 放置复制按钮和 padding 间距
            const width = Math.max(140, Math.ceil(this.maxNameLength * 8.2 + 36))
            return `${width}px`
        },
        /** 根容器动态样式，注入列宽变量 */
        rootStyle(): Record<string, string> {
            return {
                "--var-name-col-width": this.nameColWidth,
            }
        },
        /** 过滤后的条目列表（支持搜索过滤） */
        filteredEntries(): CssVarEntry[] {
            const query = this.searchQuery.trim().toLowerCase()
            if (!query) return this.entries

            return this.entries.filter((item) => {
                if (item.type === "var") {
                    const nameMatch = item.name?.toLowerCase().includes(query)
                    const valMatch = item.value?.toLowerCase().includes(query)
                    const commentMatch = item.comment?.toLowerCase().includes(query)
                    return nameMatch || valMatch || commentMatch
                }
                if (item.type === "comment") {
                    return item.comment?.toLowerCase().includes(query)
                }
                if (item.type === "selector") {
                    return item.selector?.toLowerCase().includes(query)
                }
                return false
            })
        },
    },
    watch: {
        src: {
            handler() {
                this.loadCssFile()
            },
            immediate: true,
        },
    },
    created() {
        // 创建防抖实时写回函数，300ms 无新输入后自动保存写回
        this._debouncedSave = debounce(() => {
            this.saveChanges()
        }, 300)
    },
    methods: {
        /** 解析并获取目标文件的绝对/标准路径 */
        resolveTargetFilePath(): string {
            if (!this.src) return ""
            // 如果已经是绝对路径（以 / 或 盘符开头）
            if (this.src.startsWith("/") || /^[a-zA-Z]:\\/.test(this.src)) {
                return this.src
            }
            // 从注入的 codeUnit 提取 dirPath 辅助解析
            const unit = this.codeUnit as any
            if (unit && unit.dirPath) {
                return `${unit.dirPath}/${this.src}`.replace(/\/+/g, "/")
            }
            return this.src
        },

        /** 从服务端读取 CSS 文件并解析 */
        async loadCssFile() {
            this.loading = true
            this.errorMessage = ""
            this.resolvedFilePath = this.resolveTargetFilePath()

            try {
                const url = `/__starmap_api/read-file?path=${encodeURIComponent(this.resolvedFilePath)}`
                const res = await fetch(url)
                const contentType = res.headers.get("content-type") || ""

                let data: any
                if (contentType.includes("application/json")) {
                    data = await res.json()
                } else {
                    const text = await res.text()
                    throw new Error(
                        res.status === 404
                            ? "API 接口未找到 (404)，请重启 Starmap 开发服务器以加载最新插件"
                            : `接口返回非 JSON 响应 (${res.status}): ${text.slice(0, 100)}`
                    )
                }

                if (!res.ok || !data.success) {
                    throw new Error(data.message || `HTTP ${res.status}`)
                }

                this.originalContent = data.content
                this.currentContent = data.content
                if (data.fullPath) {
                    this.resolvedFilePath = data.fullPath
                }

                this.entries = parseCssVars(data.content)
                this.hasChanges = false
            } catch (err: any) {
                console.warn("[StarmapCssVars] 读取 CSS 文件失败:", err)
                this.errorMessage = err.message || "无法读取 CSS 文件"
            } finally {
                this.loading = false
            }
        },

        /** 获取适配 <input type="color"> 的 6 位 Hex 颜色 */
        getHexColor(val?: string): string {
            return colorToHex6(val || "#000000")
        },

        /** 触发隐藏的拾色器 */
        triggerColorPicker(id: string) {
            if (!this.isEditing) return
            const pickerRef = this.$refs[`picker_${id}`] as any
            const el = Array.isArray(pickerRef) ? pickerRef[0] : pickerRef
            if (el && typeof el.click === "function") {
                el.click()
            }
        },

        /** 调色板颜色修改响应 */
        onColorPickerChange(item: CssVarEntry, event: Event) {
            const target = event.target as HTMLInputElement
            const newHex = target.value
            const formatted = formatColorValue(item.value || "", newHex)

            this.updateVarValue(item, formatted)
        },

        /** 变量文本输入框响应 */
        onVarValueInput(item: CssVarEntry, event: Event) {
            const target = event.target as HTMLInputElement
            const val = target.value
            this.updateVarValue(item, val)
        },

        /** 更新变量值，并同步更新解析条目与 CSS 文本，触发实时自动写回 */
        updateVarValue(item: CssVarEntry, newValue: string) {
            if (!item.name) return
            item.value = newValue
            item.isColor = isColorValue(newValue)

            // 精准更新当前 CSS 文本
            this.currentContent = updateCssVarInContent(this.currentContent, item.name, newValue)
            this.hasChanges = this.currentContent !== this.originalContent

            // 编辑模式下实时防抖写回文件
            if (this.isEditing) {
                this.saveStatus = "saving"
                this._debouncedSave?.()
            }
        },

        /** 保存并写回 CSS 文件 */
        async saveChanges() {
            if (!this.hasChanges || this.saving) return
            this.saving = true
            this.saveStatus = "saving"
            this.errorMessage = ""

            try {
                const res = await fetch("/__starmap_api/write-file", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        path: this.resolvedFilePath,
                        content: this.currentContent,
                    }),
                })

                const contentType = res.headers.get("content-type") || ""
                let data: any
                if (contentType.includes("application/json")) {
                    data = await res.json()
                } else {
                    const text = await res.text()
                    throw new Error(`接口返回非 JSON 响应 (${res.status}): ${text.slice(0, 100)}`)
                }

                if (!res.ok || !data.success) {
                    throw new Error(data.message || `HTTP ${res.status}`)
                }

                this.originalContent = this.currentContent
                this.hasChanges = false
                this.showStatus("saved")
            } catch (err: any) {
                console.error("[StarmapCssVars] 实时保存失败:", err)
                this.errorMessage = err.message || "写回文件失败"
                this.showStatus("error")
            } finally {
                this.saving = false
            }
        },

        /** 展示短暂的状态反馈 */
        showStatus(status: "idle" | "saving" | "saved" | "error") {
            this.saveStatus = status
            if (this._statusTimer) clearTimeout(this._statusTimer)
            if (status === "saved" || status === "error") {
                this._statusTimer = setTimeout(() => {
                    this.saveStatus = "idle"
                }, 3000)
            }
        },

        /** 复制文本到剪贴板 */
        copyText(text: string, key: string) {
            if (!text) return
            navigator.clipboard?.writeText(text).then(() => {
                this.copiedKey = key
                setTimeout(() => {
                    if (this.copiedKey === key) this.copiedKey = ""
                }, 1500)
            })
        },
    },
})
</script>
