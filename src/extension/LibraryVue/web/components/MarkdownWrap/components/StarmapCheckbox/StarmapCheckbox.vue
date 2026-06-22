<template>
    <label class="starmap-checkbox-container" :class="{ 'is-checked': modelValue }">
        <input
            type="checkbox"
            :checked="modelValue"
            @change="onChange"
            class="starmap-checkbox-input"
        />
        <span class="starmap-checkbox-inner">
            <hd-icon icon="ri:check-line" class="starmap-checkbox-check" />
        </span>
        <span class="starmap-checkbox-label" v-if="$slots.default || label">
            <slot>{{ label }}</slot>
        </span>
    </label>
</template>

<style>
.starmap-checkbox-container {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    font-family: var(--starmap-content-font), sans-serif;
    font-size: 14px;
    color: var(--starmap-nav-item-text);
    transition: color 0.2s ease;
    gap: 8px;

    .is-dark-theme & {
        color: #adb5cf;
    }

    &:hover {
        color: var(--starmap-nav-item-text-selected);

        .starmap-checkbox-inner {
            border-color: var(--starmap-nav-item-text-selected);
            background: rgba(245, 247, 250, 0.5);
            
            .is-dark-theme & {
                background: rgba(45, 51, 104, 0.1);
            }
        }
    }

    /* 隐藏原始 Checkbox */
    .starmap-checkbox-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
        margin: 0;
    }

    /* 自定义美化的 Checkbox 外框 */
    .starmap-checkbox-inner {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(220, 223, 230, 0.8);
        border-radius: 6px;
        background: #fff;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-sizing: border-box;

        .is-dark-theme & {
            background: #1e1e2e;
            border-color: rgba(60, 60, 90, 0.8);
        }
    }

    /* 勾选图标样式 */
    .starmap-checkbox-check {
        font-size: 13px;
        color: #fff;
        transform: scale(0);
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* 选中时的状态 */
    &.is-checked {
        color: var(--starmap-nav-item-text-selected);

        .starmap-checkbox-inner {
            background: var(--starmap-nav-item-text-selected);
            border-color: var(--starmap-nav-item-text-selected);
            box-shadow: 0 2px 6px rgba(63, 72, 179, 0.2);
            
            .is-dark-theme & {
                background: #505dff;
                border-color: #505dff;
            }
        }

        .starmap-checkbox-check {
            transform: scale(1);
        }
    }

    /* 聚焦样式 */
    .starmap-checkbox-input:focus-visible + .starmap-checkbox-inner {
        outline: none;
        border-color: var(--starmap-nav-item-text-selected);
        box-shadow: 0 0 0 3px rgba(63, 72, 179, 0.25);
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    name: "StarmapCheckbox",
    props: {
        /** 双向绑定勾选状态 */
        modelValue: {
            type: Boolean,
            default: false,
        },
        /** 旁边的文本描述（也支持默认插槽） */
        label: {
            type: String,
            default: "",
        },
    },
    emits: ["update:modelValue"],
    methods: {
        /** 切换勾选状态，并触发数据更新 */
        onChange(event: Event) {
            const target = event.target as HTMLInputElement
            this.$emit("update:modelValue", target.checked)
        },
    },
})
</script>
