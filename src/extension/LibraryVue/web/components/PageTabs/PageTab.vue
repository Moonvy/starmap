<template>
    <div v-show="isActive" class="Starmap-PageTab">
        <slot />
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"

export default defineComponent({
    name: "PageTab",
    // 注入父组件实例
    inject: ["pageTabs"],
    props: {
        /** 标签页标题（未设置时默认使用 value） */
        title: {
            type: String,
            required: false,
        },
        /** 标签页的值，选中时 v-model 的值 */
        value: {
            type: [String, Number] as PropType<string | number>,
            required: true,
        },
        /** 图标（可选） */
        icon: {
            type: String,
            default: undefined,
        },
    },
    computed: {
        /** 当前是否是激活状态 */
        isActive(): boolean {
            return (this.pageTabs as any).modelValue === this.value
        },
        /** 实际使用的标题 */
        resolvedTitle(): string {
            return this.title || String(this.value)
        },
    },
    watch: {
        title() {
            this.updateSelf()
        },
        value(newVal, oldVal) {
            ;(this.pageTabs as any).removeTab(oldVal)
            this.registerSelf()
        },
        icon() {
            this.updateSelf()
        },
    },
    methods: {
        /** 向父组件注册自己 */
        registerSelf() {
            if (this.pageTabs) {
                ;(this.pageTabs as any).addTab({
                    title: this.resolvedTitle,
                    value: this.value,
                    icon: this.icon,
                })
            }
        },
        /** 更新父组件中的自己信息 */
        updateSelf() {
            if (this.pageTabs) {
                ;(this.pageTabs as any).updateTab(this.value, {
                    title: this.resolvedTitle,
                    value: this.value,
                    icon: this.icon,
                })
            }
        },
    },
    mounted() {
        this.registerSelf()
    },
    beforeUnmount() {
        if (this.pageTabs) {
            ;(this.pageTabs as any).removeTab(this.value)
        }
    },
})
</script>

<style>
.Starmap-PageTab {
    width: 100%;
    height: auto;
    box-sizing: border-box;
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    place-items: center;
}
</style>
