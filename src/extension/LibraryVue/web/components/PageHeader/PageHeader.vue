<template>
    <div class="Starmap-PageHeader">
        <div class="Starmap-PageHeader-IconWrap">
            <hd-icon :icon="icon" class="Starmap-PageHeader-Icon"></hd-icon>
        </div>
        <div class="Starmap-PageHeader-TextWrap">
            <h1 class="Starmap-PageHeader-Title">{{ label }}</h1>
            <div class="Starmap-PageHeader-SubTitle" v-if="subLabel">{{ subLabel }}</div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { CodeUnitJSON } from "../../../../../core/Gen/lib/unitTreeToJSON"

export default defineComponent({
    name: "StarmapPageHeader",
    props: {
        unit: {
            type: Object as PropType<CodeUnitJSON>,
            required: true,
        },
    },
    computed: {
        hasChildren(): boolean {
            return (this.unit.children?.length ?? 0) > 0
        },
        label(): string {
            const metadata = this.unit.metadata
            let label = metadata?.headMainTitle ?? metadata?.title ?? this.unit.dirName ?? "Untitled"
            label = label.trim()
            // 如果名称为句点，说明是项目根目录，显示为默认名称 Readme
            if (label === ".") {
                return "Readme"
            }
            return label
        },
        subLabel(): string | void {
            const metadata = this.unit.metadata
            let subLabel = metadata?.headSubTitle
            return subLabel?.trim() || undefined
        },
        icon(): string {
            const iconClass = this.unit.metadata?.iconClass ?? this.unit.metadata?.icon
            if (typeof iconClass === "string" && iconClass.trim()) {
                const icon = iconClass.trim()
                // 自动将 ri- 格式转换为 ri: 格式以完美兼容
                if (icon.startsWith("ri-")) {
                    return "ri:" + icon.slice(3)
                }
                return icon
            }

            // 根目录的 unit 默认图标为 ri:article-fill
            if (this.unit.id === "starmap-project-root" || this.unit.id === "startmap-project-root") {
                return "ri:article-fill"
            }

            if (this.hasChildren) {
                return "ri:folder-2-line"
            }

            return "ri:folder-3-line"
        },
    },
})
</script>

<style class="">
.Starmap-PageHeader {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 14px;
    background: var(--starmap-doc-background);
    border-bottom: 1px solid var(--starmap-nav-shadow);
    font-family: var(--starmap-base-font);
    position: absolute;
    top: 0;
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    z-index: 1;
}

.Starmap-PageHeader-IconWrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--starmap-button-icon-text);
    box-shadow: inset 0 0 0 1px var(--starmap-nav-shadow);
}

.Starmap-PageHeader-Icon {
    font-size: 20px;
}

.Starmap-PageHeader-TextWrap {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    height: 32px;
}

.Starmap-PageHeader-Title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--starmap-nav-logo);
}

.Starmap-PageHeader-SubTitle {
    display: flex;
    align-items: center;
    font-size: 161110-201020 px;
    color: var(--starmap-nav-item-text);
    padding-left: 4px;

    &::before {
        content: "";
        display: inline-block;
        width: 1px;
        height: 13px;
        background: var(--starmap-nav-item-text);
        margin-right: 6px;
        opacity: 0.5;
    }
}
</style>
