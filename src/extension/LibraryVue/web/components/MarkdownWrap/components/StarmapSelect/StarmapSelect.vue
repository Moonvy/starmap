<template>
    <div class="starmap-select-container" :class="[mode, { 'is-open': isOpen }]" @focusout="onFocusout" tabindex="-1">
        <!-- Tab 模式 -->
        <template v-if="mode === 'tab'">
            <div class="starmap-select-tabs">
                <button
                    v-for="item in list"
                    :key="item.id"
                    type="button"
                    class="starmap-select-tab-btn"
                    :class="{ 'is-active': isItemSelected(item) }"
                    @click="selectItem(item)"
                >
                    <hd-icon v-if="item.icon" :icon="item.icon" class="tab-icon" />
                    <span class="tab-title">{{ item.title }}</span>
                </button>
            </div>
        </template>

        <!-- Dropdown (Normal) 下拉模式 -->
        <template v-else>
            <div class="starmap-select-dropdown">
                <button type="button" class="starmap-select-trigger" @click="toggleDropdown">
                    <div class="trigger-content">
                        <hd-icon v-if="activeItem?.icon" :icon="activeItem.icon" class="select-icon" />
                        <span class="select-title">{{ activeItem ? activeItem.title : "请选择..." }}</span>
                    </div>
                    <hd-icon icon="ri:arrow-down-s-line" class="arrow-icon" :class="{ 'is-flipped': isOpen }" />
                </button>
                <div class="starmap-select-menu" v-if="isOpen">
                    <button
                        v-for="item in list"
                        :key="item.id"
                        type="button"
                        class="starmap-select-menu-item"
                        :class="{ 'is-active': isItemSelected(item) }"
                        @click="selectItem(item)"
                    >
                        <hd-icon v-if="item.icon" :icon="item.icon" class="menu-item-icon" />
                        <span class="menu-item-title">{{ item.title }}</span>
                        <hd-icon v-if="isItemSelected(item)" icon="ri:check-line" class="menu-item-check" />
                    </button>
                </div>
            </div>
        </template>
    </div>
</template>

<style>
.starmap-select-container {
    display: inline-block;
    vertical-align: middle;
    outline: none;
    font-family: var(--starmap-content-font), sans-serif;

    .is-dark-theme & {
        color: #adb5cf;
    }

    /* Tab 模式样式 */
    &.tab {
        background: rgba(235, 238, 245, 0.5);
        padding: 4px;

        border-radius: 10px;
        border: 1px solid rgba(220, 223, 230, 0.6);
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);

        .is-dark-theme & {
            background: rgba(30, 30, 46, 0.6);
            border-color: rgba(50, 50, 75, 0.6);
        }

        .starmap-select-tabs {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .starmap-select-tab-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            font-size: 13px;
            font-weight: 500;
            color: var(--starmap-nav-item-text);
            border: none;
            background: transparent;
            border-radius: 7px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;

            &:hover {
                background: rgba(213, 221, 239, 0.3);
                color: var(--starmap-nav-item-text-selected);

                .is-dark-theme & {
                    background: rgba(45, 51, 104, 0.3);
                }
            }

            &.is-active {
                background: #fff;
                color: var(--starmap-nav-item-text-selected);
                box-shadow: 0 2px 6px rgba(63, 72, 179, 0.15);
                transform: translateY(-0.5px);

                .is-dark-theme & {
                    background: rgba(58, 64, 132, 0.45);
                    color: #d8ddff;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
            }

            .tab-icon {
                font-size: 15px;
            }
        }
    }

    /* Normal 下拉模式样式 */
    &.normal {
        position: relative;
        min-width: 160px;

        .starmap-select-dropdown {
            position: relative;
            width: 100%;
        }

        .starmap-select-trigger {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 500;
            color: var(--starmap-nav-item-text);
            background: #fff;
            border: 1px solid rgba(220, 223, 230, 0.8);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

            .is-dark-theme & {
                background: #1e1e2e;
                border-color: rgba(60, 60, 90, 0.8);
                color: #adb5cf;
            }

            &:hover {
                border-color: var(--starmap-nav-item-text-selected);
                background: rgba(245, 247, 250, 0.8);

                .is-dark-theme & {
                    background: #242438;
                }
            }

            &:focus {
                outline: none;
                border-color: var(--starmap-nav-item-text-selected);
                box-shadow: 0 0 0 3px rgba(63, 72, 179, 0.15);
            }

            .trigger-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .select-icon {
                font-size: 16px;
                color: var(--starmap-nav-item-text-selected);

                .is-dark-theme & {
                    color: #96a1ff;
                }
            }

            .arrow-icon {
                font-size: 16px;
                transition: transform 0.2s ease;
                color: rgba(90, 100, 125, 0.6);

                .is-dark-theme & {
                    color: rgba(173, 181, 207, 0.75);
                }

                &.is-flipped {
                    transform: rotate(180deg);
                }
            }
        }

        .starmap-select-menu {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            width: 100%;
            z-index: 100;
            background: #fff;
            border: 1px solid rgba(220, 223, 230, 0.8);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            animation: starmap-slide-down 0.2s cubic-bezier(0.4, 0, 0.2, 1);

            .is-dark-theme & {
                background: #1e1e2e;
                border-color: rgba(60, 60, 90, 0.8);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
        }

        .starmap-select-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--starmap-nav-item-text);
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            text-align: left;
            transition: all 0.15s ease;

            .is-dark-theme & {
                color: #adb5cf;
            }

            &:hover {
                background: rgba(213, 221, 239, 0.3);
                color: var(--starmap-nav-item-text-selected);

                .is-dark-theme & {
                    background: rgba(45, 51, 104, 0.3);
                }
            }

            &.is-active {
                background: var(--starmap-nav-item-bk-selected);
                color: var(--starmap-nav-item-text-selected);

                .is-dark-theme & {
                    background: rgba(58, 64, 132, 0.35);
                    color: #d8ddff;
                }
            }

            .menu-item-icon {
                font-size: 16px;
            }

            .menu-item-check {
                margin-left: auto;
                font-size: 14px;
                font-weight: bold;

                .is-dark-theme & {
                    color: #aeb8ff;
                }
            }
        }
    }
}

@keyframes starmap-slide-down {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>

<script lang="ts">
import { defineComponent, PropType } from "vue"

interface ISelectItem {
    id: string | number
    value?: any
    title: string
    icon?: string
    isDefault?: boolean // 是否为默认选中项
}

export default defineComponent({
    name: "StarmapSelect",
    props: {
        /** 双向绑定的选定值 */
        modelValue: {
            type: [String, Number, Boolean, Object],
            default: null,
        },
        /** 下拉框的数据源列表 */
        list: {
            type: Array as PropType<ISelectItem[]>,
            default: () => [],
        },
        /** 显示模式 normal (下拉) | tab (横向标签) */
        mode: {
            type: String as PropType<"normal" | "tab">,
            default: "normal",
        },
    },
    emits: ["update:modelValue"],
    watch: {
        modelValue: {
            handler() {
                this.checkAndApplyDefaultValue()
            },
            immediate: true,
        },
        list: {
            handler() {
                this.checkAndApplyDefaultValue()
            },
            deep: true,
            immediate: true,
        },
    },
    data() {
        return {
            isOpen: false,
        }
    },
    computed: {
        /** 当前选中的单项对象 */
        activeItem(): ISelectItem | undefined {
            let active = this.list.find((item) => this.isItemSelected(item))
            if (!active) {
                // 如果没有直接选中任何项，且当前绑定的 modelValue 为空，则寻找 isDefault: true 的项作为默认项
                const isModelValueEmpty =
                    this.modelValue === null || this.modelValue === undefined || this.modelValue === ""
                if (isModelValueEmpty) {
                    active = this.list.find((item) => item.isDefault)
                }
            }
            return active
        },
    },
    mounted() {
        this.checkAndApplyDefaultValue()
    },
    methods: {
        /** 展开或折叠下拉菜单 */
        toggleDropdown() {
            this.isOpen = !this.isOpen
        },
        /** 检查给定项是否为当前选中项 */
        isItemSelected(item: ISelectItem): boolean {
            const itemValue = item.value !== undefined ? item.value : item.id
            const isDirectSelected = this.modelValue === itemValue
            if (isDirectSelected) {
                return true
            }

            // 如果没有直接选中，且 modelValue 为空，那么如果是 isDefault 的项，也视为已选中
            const isModelValueEmpty =
                this.modelValue === null || this.modelValue === undefined || this.modelValue === ""
            if (isModelValueEmpty && item.isDefault) {
                // 确保 list 中没有任何其他项被直接选中（防冲突）
                const hasAnyDirectSelected = this.list.some((x) => {
                    const val = x.value !== undefined ? x.value : x.id
                    return this.modelValue === val
                })
                return !hasAnyDirectSelected
            }

            return false
        },
        /** 选中某个选项，并触发数据更新 */
        selectItem(item: ISelectItem) {
            const itemValue = item.value !== undefined ? item.value : item.id
            this.$emit("update:modelValue", itemValue)
            this.isOpen = false
        },
        /** 失去焦点时自动关闭下拉菜单 */
        onFocusout(event: FocusEvent) {
            if (!this.$el.contains(event.relatedTarget as Node)) {
                this.isOpen = false
            }
        },
        /**
         * 检查并应用默认选中项
         * 如果当前选中的值没有匹配到 list 中的任何项，且 list 中有设置 isDefault 为 true 的项，则自动将其选中并通过 nextTick 同步回父组件
         */
        checkAndApplyDefaultValue() {
            if (!this.list || this.list.length === 0) {
                return
            }

            // 检查 modelValue 是否匹配 list 中任意项
            const hasMatched = this.list.some((item) => {
                const itemValue = item.value !== undefined ? item.value : item.id
                return this.modelValue === itemValue
            })

            // 若没有匹配到任何项，寻找 isDefault 为 true 的项
            if (!hasMatched) {
                const defaultItem = this.list.find((item) => item.isDefault)
                if (defaultItem) {
                    const defaultValue = defaultItem.value !== undefined ? defaultItem.value : defaultItem.id
                    if (this.modelValue !== defaultValue) {
                        this.$nextTick(() => {
                            this.$emit("update:modelValue", defaultValue)
                        })
                    }
                }
            }
        },
    },
})
</script>
