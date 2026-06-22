<template>
    <div v-if="params.length > 0 || returnDoc" class="StarmapDocParams">
        <div v-if="params.length > 0" class="section-label">
            Params <span class="sub-label">({{ params.length }})</span>
        </div>

        <div v-if="params.length > 0" class="params-panel">
            <div class="params-list">
                <div
                    v-for="param in params"
                    :key="param.name"
                    class="param-group"
                    :class="{ expanded: isExpanded(param.name) }"
                >
                    <div
                        class="param-item root"
                        :class="{ clickable: hasChildren(param) }"
                        @click="hasChildren(param) && toggleExpand(param.name)"
                    >
                        <div class="param-main">
                            <div class="param-head">
                                <span class="param-name">
                                    <code>{{ getLeafName(param.name) }}</code>
                                </span>

                                <div class="param-types">
                                    <code v-for="type in getTypeParts(param.type)" :key="type" class="type-badge">
                                        {{ type }}
                                    </code>
                                </div>

                                <span v-if="hasChildren(param)" class="children-count">
                                    {{ param.children?.length }} 项
                                </span>

                                <span
                                    v-if="hasChildren(param)"
                                    class="toggle-icon"
                                    :class="{ open: isExpanded(param.name) }"
                                    aria-hidden="true"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M6 9l6 6 6-6"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg>
                                </span>
                            </div>

                            <div v-if="param.description" class="param-desc">
                                {{ param.description }}
                            </div>
                        </div>
                    </div>

                    <transition name="expand">
                        <div v-show="hasChildren(param) && isExpanded(param.name)" class="child-list">
                            <div
                                v-for="(child, childIndex) in param.children"
                                :key="child.name"
                                class="param-item nested"
                                :class="{ last: childIndex === (param.children?.length || 0) - 1 }"
                            >
                                <span class="branch-line" aria-hidden="true"></span>
                                <div class="param-main">
                                    <div class="param-head">
                                        <span class="param-name">
                                            <code>{{ getLeafName(child.name) }}</code>
                                        </span>

                                        <div class="param-types">
                                            <code
                                                v-for="type in getTypeParts(child.type)"
                                                :key="type"
                                                class="type-badge"
                                            >
                                                {{ type }}
                                            </code>
                                        </div>
                                    </div>

                                    <div v-if="child.description" class="param-desc">
                                        {{ child.description }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </div>

        <div v-if="returnDoc" class="section-label returns-label" :class="{ 'section-gap': params.length > 0 }">
            Returns
        </div>

        <div v-if="returnDoc" class="params-panel returns-panel">
            <div class="param-group" :class="{ expanded: isExpanded(returnKey) }">
                <div
                    class="param-item root"
                    :class="{ clickable: hasChildren(returnDoc) }"
                    @click="hasChildren(returnDoc) && toggleExpand(returnKey)"
                >
                    <div class="param-main">
                        <div class="param-head">
                            <span class="param-name return-name">
                                <code>return</code>
                            </span>

                            <div class="param-types">
                                <code v-for="type in getTypeParts(returnDoc.type)" :key="type" class="type-badge">
                                    {{ type }}
                                </code>
                            </div>

                            <span v-if="hasChildren(returnDoc)" class="children-count">
                                {{ returnDoc.children?.length }} 项
                            </span>

                            <span
                                v-if="hasChildren(returnDoc)"
                                class="toggle-icon"
                                :class="{ open: isExpanded(returnKey) }"
                                aria-hidden="true"
                            >
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M6 9l6 6 6-6"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    />
                                </svg>
                            </span>
                        </div>

                        <div v-if="returnDoc.description" class="param-desc">
                            {{ returnDoc.description }}
                        </div>
                    </div>
                </div>

                <transition name="expand">
                    <div v-show="hasChildren(returnDoc) && isExpanded(returnKey)" class="child-list">
                        <div
                            v-for="(child, childIndex) in returnDoc.children"
                            :key="child.name"
                            class="param-item nested"
                            :class="{ last: childIndex === (returnDoc.children?.length || 0) - 1 }"
                        >
                            <span class="branch-line" aria-hidden="true"></span>
                            <div class="param-main">
                                <div class="param-head">
                                    <span class="param-name">
                                        <code>{{ getLeafName(child.name) }}</code>
                                    </span>

                                    <div class="param-types">
                                        <code v-for="type in getTypeParts(child.type)" :key="type" class="type-badge">
                                            {{ type }}
                                        </code>
                                    </div>
                                </div>

                                <div v-if="child.description" class="param-desc">
                                    {{ child.description }}
                                </div>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>

<style>
.StarmapDocParams {
    --doc-font: var(--starmap-content-font);
    --doc-code-font: var(--starmap-code-font);
    --doc-border: #e3e8f1;
    --doc-head-bk: #f4f6fb;
    --doc-item-bk-hover: color-mix(in srgb, var(--doc-head-bk) 70%, transparent);
    --doc-row-border: #eaecf2;
    --doc-code-bk: rgb(232 236 244);
    --doc-code-text: rgb(7 38 96);
    --doc-type-bk: #eff3fa;
    --doc-type-text: #3a5fa0;
    --doc-label-text: #8a91a8;
    --doc-desc-text: #4a5568;
    --doc-muted-text: #9aa3b7;
    --doc-root-bk: #fbfcff;

    .is-dark-theme & {
        --doc-border: #2a2d3e;
        --doc-head-bk: #1e2035;
        --doc-row-border: #252840;
        --doc-code-bk: rgb(32 36 54);
        --doc-code-text: rgb(165 185 230);
        --doc-type-bk: #1e2840;
        --doc-type-text: #7aaddf;
        --doc-label-text: #5e657a;
        --doc-desc-text: #a0aab8;
        --doc-muted-text: #697186;
        --doc-root-bk: #181a2a;
    }

    font-family: var(--doc-font);
    margin-top: 1.5em;
    margin-bottom: 1.5em;

    .section-label {
        display: inline-flex;
        place-items: center;
        font-size: 16px;
        font-family: "Roboto Mono", monospace;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--doc-label-text);
        margin-bottom: 8px;

        .sub-label {
            font-size: 13px;
            margin-left: 4px;
            letter-spacing: 0;
        }
    }

    .params-panel {
        width: 100%;
        border: 1px solid var(--doc-border);
        border-radius: 8px;
        overflow: hidden;
        font-size: 13px;
        background: var(--doc-root-bk);
    }

    .section-gap {
        margin-top: 1.2em;
    }

    .param-group {
        border-bottom: 1px solid var(--doc-row-border);

        &:last-child {
            border-bottom: none;
        }
    }

    .param-item {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 11px 14px;
        background: var(--doc-root-bk);
        transition: background 0.18s ease;

        &:hover {
            background: var(--doc-item-bk-hover);
        }

        &.nested {
            padding-left: 24px;
            background: color-mix(in srgb, var(--doc-head-bk) 42%, var(--doc-root-bk));
        }

        &.root {
            .param-name code {
                color: var(--doc-type-text);
                background: var(--doc-type-bk);
            }
        }

        &.clickable {
            cursor: pointer;
        }
    }

    .param-main {
        flex: 1;
        min-width: 0;
    }

    .param-head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
    }

    .children-count {
        color: var(--doc-muted-text);
        font-size: 12px;
        margin-left: 2px;
    }

    .param-name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;

        code {
            display: inline-flex;
            align-items: center;
            max-width: 100%;
            color: var(--doc-code-text);
            background: var(--doc-code-bk);
            padding: 2px 10px;
            line-height: 1.6;
            border-radius: 4px;
            font-family: var(--doc-code-font);
            font-size: 13px;
            font-weight: 600;
            overflow-wrap: anywhere;
        }
    }

    .return-name code {
        color: #5a7a3a !important;
        background: #eef5e8 !important;

        .is-dark-theme & {
            color: #8dc87a !important;
            background: #1e2e1a !important;
        }
    }

    .branch-line {
        position: relative;
        width: 12px;
        height: 22px;
        flex: none;
        margin-top: 1px;

        &::after {
            content: "";
            position: absolute;
            background: var(--doc-row-border);
        }

        &::after {
            left: 3px;
            top: 10px;
            width: 9px;
            height: 1px;
        }
    }

    .param-types {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        min-width: 0;
    }

    .type-badge {
        font-family: var(--doc-code-font);
        font-size: 12.5px;
        color: var(--doc-type-text);
        background: var(--doc-type-bk);
        padding: 2px 7px;
        border-radius: 4px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        line-height: 1.45;
    }

    .param-desc {
        color: var(--doc-desc-text);
        line-height: 1.5;
        min-width: 0;
        overflow-wrap: anywhere;
        margin-top: 7px;
    }

    .toggle-icon {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        color: var(--doc-label-text);
        transition:
            transform 0.25s ease,
            color 0.2s ease;
        flex: none;

        &.open {
            transform: rotate(180deg);
            color: var(--doc-type-text);
        }
    }

    .child-list {
        position: relative;
        border-top: 1px solid var(--doc-row-border);

        &::before {
            content: "";
            position: absolute;
            left: 27px;
            top: 0;
            bottom: 22px;
            width: 1px;
            background: var(--doc-row-border);
            z-index: 1;
        }

        .param-item {
            position: relative;
            z-index: 2;
        }
    }

    .expand-enter-active,
    .expand-leave-active {
        transition:
            max-height 0.28s ease,
            opacity 0.24s ease;
        overflow: hidden;
    }

    .expand-enter-from,
    .expand-leave-to {
        max-height: 0;
        opacity: 0;
    }

    .expand-enter-to,
    .expand-leave-from {
        max-height: 900px;
        opacity: 1;
    }

    @media (max-width: 720px) {
        .param-item {
            padding: 10px 12px;
        }

        .param-item.nested {
            padding-left: 16px;
        }
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"

interface DocParam {
    /** 参数名 */
    name: string
    /** 参数类型文本 */
    type: string
    /** 参数说明 */
    description: string
    /** 子参数 */
    children?: DocParam[]
}

interface DocReturn {
    /** 返回值类型文本 */
    type: string
    /** 返回值说明 */
    description: string
    /** 返回值对象的下一层属性 */
    children?: DocParam[]
}

export default defineComponent({
    name: "StarmapDocParams",
    props: {
        paramsJson: {
            type: String,
            default: "[]",
        },
        returnsJson: {
            type: String,
            default: "",
        },
    },

    computed: {
        params(): DocParam[] {
            try {
                const parsed = JSON.parse(this.paramsJson)
                return Array.isArray(parsed) ? parsed : []
            } catch {
                return []
            }
        },

        returnDoc(): DocReturn | null {
            if (!this.returnsJson) return null
            try {
                const parsed = JSON.parse(this.returnsJson)
                return parsed && typeof parsed === "object" ? parsed : null
            } catch {
                return null
            }
        },
    },

    data() {
        return {
            expanded: {} as Record<string, boolean>,
            returnKey: "__return__",
        }
    },

    methods: {
        /** 切换子参数展开状态
         *
         * @param name 参数名
         */
        toggleExpand(name: string) {
            this.expanded[name] = !this.expanded[name]
        },

        /** 判断参数是否已展开
         *
         * @param name 参数名
         */
        isExpanded(name: string) {
            return !!this.expanded[name]
        },

        /** 判断参数是否有子参数
         *
         * @param param 参数信息
         */
        hasChildren(param: DocParam) {
            return !!param.children?.length
        },

        /** 获取参数名最后一段，用于突出当前字段
         *
         * @param name 完整参数名
         */
        getLeafName(name: string) {
            return name.split(".").at(-1) || name
        },

        /** 获取参数父路径，用于弱化显示层级来源
         *
         * @param name 完整参数名
         */
        getParentPath(name: string) {
            const parts = name.split(".")
            parts.pop()
            return parts.join(".")
        },

        /** 拆分交叉类型片段
         *
         * @param type 参数类型
         */
        getTypeParts(type: string) {
            return type
                .split("<br>")
                .map((part) => part.trim())
                .filter(Boolean)
        },
    },
})
</script>
