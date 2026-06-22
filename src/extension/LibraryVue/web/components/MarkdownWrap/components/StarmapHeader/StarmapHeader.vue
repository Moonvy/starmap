<template>
    <div class="Starmap-Header-Container" v-if="label">
        <div class="Starmap-PageHeader-IconWrap" v-if="icon">
            <hd-icon :icon="icon" class="Starmap-PageHeader-Icon"></hd-icon>
        </div>
        <div class="Starmap-PageHeader-TextWrap">
            <h1 class="Starmap-PageHeader-Title">{{ label }}</h1>
            <div class="Starmap-PageHeader-SubTitle" v-if="subLabel">{{ subLabel }}</div>
        </div>
    </div>
</template>

<style scoped>
.Starmap-Header-Container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 8px;
    margin-left: -52px;
}

.Starmap-PageHeader-IconWrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: var(--starmap-button-icon-text);
    box-shadow: inset 0 0 0 1px var(--starmap-nav-shadow);
    background: var(--starmap-nav-background);
}

.Starmap-PageHeader-Icon {
    font-size: 24px;
}

.Starmap-PageHeader-TextWrap {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
}

.Starmap-PageHeader-Title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--starmap-nav-logo);
}

.Starmap-PageHeader-SubTitle {
    display: flex;
    align-items: center;
    font-size: 20px;
    color: var(--starmap-nav-item-text);
    padding-left: 4px;

    &::before {
        content: "";
        display: inline-block;
        width: 1px;
        height: 14px;
        background: var(--md-text-gray-color);
        margin-right: 8px;
        opacity: 0.5;
    }
}

@media (max-width: 1100px) {
    .Starmap-Header-Container {
        .Starmap-PageHeader-IconWrap {
            visibility: hidden;
        }
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { CodeUnitJSON } from "../../../../../../../core/Gen/lib/unitTreeToJSON"

export default defineComponent({
    name: "StarmapHeader",
    inject: {
        codeUnit: {
            from: "codeUnit",
            default: () => null,
        },
    },
    computed: {
        /**
         * 检查是否有子节点
         */
        hasChildren(): boolean {
            // @ts-ignore
            const unit = (this.codeUnit as CodeUnitJSON | null) || (window.__starmap__?.codeUnit as CodeUnitJSON | null)
            return (unit?.children?.length ?? 0) > 0
        },
        /**
         * 获取当前 Page 的图标
         */
        icon(): string {
            // @ts-ignore
            const unit = (this.codeUnit as CodeUnitJSON | null) || (window.__starmap__?.codeUnit as CodeUnitJSON | null)
            if (!unit) return ""

            const iconClass = unit.metadata?.iconClass ?? unit.metadata?.icon
            if (typeof iconClass === "string" && iconClass.trim()) {
                const icon = iconClass.trim()
                // 自动将 ri- 格式转换为 ri: 格式以完美兼容
                if (icon.startsWith("ri-")) {
                    return "ri:" + icon.slice(3)
                }
                return icon
            }

            // 根目录的 unit 默认图标为 ri:article-fill
            if (unit.id === "starmap-project-root" || unit.id === "startmap-project-root") {
                return "ri:article-fill"
            }

            if (this.hasChildren) {
                return "ri:folder-2-line"
            }

            return "ri:folder-3-line"
        },
        /**
         * 获取当前 Page 的标题
         */
        label(): string {
            // @ts-ignore
            const unit = (this.codeUnit as CodeUnitJSON | null) || (window.__starmap__?.codeUnit as CodeUnitJSON | null)
            if (!unit) return ""
            const metadata = unit.metadata
            let label = metadata?.headMainTitle ?? metadata?.title ?? unit.dirName ?? "Untitled"
            label = label.trim()
            if (label === ".") {
                return "Readme"
            }
            return label
        },
        /**
         * 获取当前 Page 的副标题
         */
        subLabel(): string | void {
            // @ts-ignore
            const unit = (this.codeUnit as CodeUnitJSON | null) || (window.__starmap__?.codeUnit as CodeUnitJSON | null)
            if (!unit) return undefined
            const metadata = unit.metadata
            let subLabel = metadata?.headSubTitle
            return subLabel?.trim() || undefined
        },
    },
})
</script>
