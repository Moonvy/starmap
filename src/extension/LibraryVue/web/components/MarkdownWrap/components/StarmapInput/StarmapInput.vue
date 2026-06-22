<template>
    <div class="starmap-input-container">
        <input
            :type="type"
            :value="modelValue"
            @input="onInput"
            :placeholder="placeholder"
            class="starmap-input-field"
        />
    </div>
</template>

<style>
.starmap-input-container {
    display: inline-block;
    vertical-align: middle;
    width: 100%;
    max-width: 240px;
    margin: 0.5em;
}

.starmap-input-field {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--starmap-nav-item-text);
    background: #fff;
    border: 1px solid rgba(220, 223, 230, 0.8);
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-sizing: border-box;

    .is-dark-theme & {
        background: #1e1e2e;
        border-color: rgba(60, 60, 90, 0.8);
        color: #adb5cf;
    }

    &::placeholder {
        color: rgba(140, 150, 175, 0.5);
    }

    &:hover {
        border-color: var(--starmap-nav-item-text-selected);
    }

    &:focus {
        outline: none;
        border-color: var(--starmap-nav-item-text-selected);
        box-shadow: 0 0 0 3px rgba(63, 72, 179, 0.15);
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    name: "StarmapInput",
    props: {
        /** 输入值 */
        modelValue: {
            type: [String, Number],
            default: "",
        },
        /** 是否自动转换为数值类型 */
        number: {
            type: Boolean,
            default: false,
        },
        /** 输入框的原生类型 */
        type: {
            type: String,
            default: "text",
        },
        /** 占位符提示文本 */
        placeholder: {
            type: String,
            default: "请输入...",
        },
    },
    emits: ["update:modelValue"],
    methods: {
        /** 监听输入事件，处理数值转换，并触发数据更新 */
        onInput(event: Event) {
            const target = event.target as HTMLInputElement
            let value: string | number = target.value

            if (this.number) {
                const parsed = parseFloat(value)
                value = isNaN(parsed) ? value : parsed
            }

            this.$emit("update:modelValue", value)
        },
    },
})
</script>
