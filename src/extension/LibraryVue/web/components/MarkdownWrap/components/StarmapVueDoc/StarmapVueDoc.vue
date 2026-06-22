<template>
    <div class="StarmapVueDoc">
        <template v-if="props && props.length > 0">
            <div class="section-label">
                Props <span class="sub-label">({{ props.length }})</span>
            </div>
            <div class="props-table">
                <div v-for="prop in props" :key="prop.name" class="prop-item">
                    <div
                        class="prop-row1"
                        :class="{ clickable: prop.description }"
                        @click="prop.description && toggleExpand(prop.name)"
                        :aria-expanded="prop.description ? isExpanded(prop.name) : undefined"
                    >
                        <span class="prop-name">
                            <code>{{ prop.name }}</code>
                        </span>

                        <div class="prop-types">
                            <code v-if="prop.type" class="type-badge">{{ prop.type.name }}</code>
                            <code v-if="prop.defaultValue" class="default-badge">= {{ prop.defaultValue.value }}</code>
                            <span v-if="prop.required" class="required-badge">必填</span>
                        </div>

                        <div class="prop-short-desc" :class="{ expanded: isExpanded(prop.name) }">
                            <div :class="['short-desc', { expanded: isExpanded(prop.name) }]">
                                {{ prop.description }}
                            </div>
                        </div>

                        <div
                            v-if="prop.description"
                            class="toggle-icon"
                            :class="{ open: isExpanded(prop.name) }"
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
                        </div>
                    </div>

                    <transition name="expand">
                        <div v-show="prop.description && isExpanded(prop.name)" class="prop-row2 prop-desc">
                            <pre class="desc-content">{{ getDescText(prop.description) }}</pre>
                            <div v-if="prop.values" class="values-content">
                                <span class="title">可选值：</span> <span v-html="getValueText(prop.values)"></span>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </template>

        <template v-if="events && events.length > 0">
            <div class="section-label" :class="{ 'section-gap': props && props.length > 0 }">
                Events <span class="sub-label">({{ events.length }})</span>
            </div>
            <div class="props-table">
                <div v-for="event in events" :key="event.name" class="prop-item">
                    <div
                        class="prop-row1"
                        :class="{ clickable: event.description }"
                        @click="event.description && toggleExpand('event:' + event.name)"
                        :aria-expanded="event.description ? isExpanded('event:' + event.name) : undefined"
                    >
                        <span class="prop-name event-name">
                            <code><span class="event-at">@</span>{{ event.name }}</code>
                        </span>

                  
                        <div class="prop-short-desc" :class="{ expanded: isExpanded('event:' + event.name) }">
                            <div :class="['short-desc', { expanded: isExpanded('event:' + event.name) }]">
                                {{ event.description }}
                            </div>
                        </div>

                        <div
                            v-if="event.description"
                            class="toggle-icon"
                            :class="{ open: isExpanded('event:' + event.name) }"
                            aria-hidden="true"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                    </div>

                    <transition name="expand">
                        <div v-show="event.description && isExpanded('event:' + event.name)" class="prop-row2 prop-desc">
                            <pre class="desc-content">{{ getDescText(event.description) }}</pre>
                            <template v-if="event.properties && event.properties.length">
                                <div class="event-properties">
                                    <span class="title">载荷：</span>
                                    <div
                                        v-for="ep in event.properties"
                                        :key="ep.name"
                                        class="event-prop-item"
                                    >
                                        <code class="event-prop-name">{{ ep.name }}</code>
                                        <template v-if="ep.type && ep.type.names && ep.type.names.length">
                                            <code
                                                v-for="tn in ep.type.names"
                                                :key="tn"
                                                class="type-badge"
                                            >{{ tn }}</code>
                                        </template>
                                        <span v-if="ep.description" class="event-prop-desc">{{ ep.description }}</span>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </transition>
                </div>
            </div>
        </template>

        <template v-if="slots && slots.length > 0">
            <div class="section-label" :class="{ 'section-gap': (props && props.length > 0) || (events && events.length > 0) }">
                Slots <span class="sub-label">({{ slots.length }})</span>
            </div>
            <div class="props-table">
                <div v-for="slot in slots" :key="slot.name" class="prop-item">
                    <div
                        class="prop-row1"
                        :class="{ clickable: slot.description }"
                        @click="slot.description && toggleExpand('slot:' + slot.name)"
                        :aria-expanded="slot.description ? isExpanded('slot:' + slot.name) : undefined"
                    >
                        <span class="prop-name slot-name">
                            <code><span class="slot-hash">#</span>{{ slot.name }}</code>
                        </span>

                        <div class="prop-types">
                            <template v-if="slot.bindings && slot.bindings.length">
                                <code
                                    v-for="binding in slot.bindings"
                                    :key="binding.name"
                                    class="type-badge"
                                >{{ binding.name }}</code>
                            </template>
                        </div>

                        <div class="prop-short-desc" :class="{ expanded: isExpanded('slot:' + slot.name) }">
                            <div :class="['short-desc', { expanded: isExpanded('slot:' + slot.name) }]">
                                {{ slot.description }}
                            </div>
                        </div>

                        <div
                            v-if="slot.description"
                            class="toggle-icon"
                            :class="{ open: isExpanded('slot:' + slot.name) }"
                            aria-hidden="true"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                    </div>

                    <transition name="expand">
                        <div v-show="slot.description && isExpanded('slot:' + slot.name)" class="prop-row2 prop-desc">
                            <pre class="desc-content">{{ getDescText(slot.description) }}</pre>
                            <template v-if="slot.bindings && slot.bindings.length">
                                <div class="event-properties">
                                    <span class="title">插槽绑定：</span>
                                    <div
                                        v-for="binding in slot.bindings"
                                        :key="binding.name"
                                        class="event-prop-item"
                                    >
                                        <code class="event-prop-name">{{ binding.name }}</code>
                                        <code v-if="binding.type" class="type-badge">{{ binding.type.name }}</code>
                                        <span v-if="binding.description" class="event-prop-desc">{{ binding.description }}</span>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </transition>
                </div>
            </div>
        </template>
    </div>
</template>

<style>
.StarmapVueDoc {
    --doc-font: var(--starmap-content-font);
    --doc-code-font: var(--starmap-code-font);
    --doc-border: #e3e8f1;
    --doc-head-bk: #f4f6fb;
    --doc-item-bk-hover: color-mix(in srgb, var(--doc-head-bk) 70%, transparent);
    --doc-row-border: #eaecf2;
    --doc-code-bk: rgb(232 236 244);
    --doc-code-text: rgb(7 38 96);
    --doc-required-bk: #fff0f0;
    --doc-required-text: #c0392b;
    --doc-type-bk: #eff3fa;
    --doc-type-text: #3a5fa0;
    --doc-default-bk: #f3f0ff;
    --doc-default-text: #5b3fa0;
    --doc-label-text: #8a91a8;
    --doc-desc-text: #4a5568;

    .is-dark-theme & {
        --doc-border: #2a2d3e;
        --doc-head-bk: #1e2035;
        --doc-head-text: #8a91a8;
        --doc-row-border: #252840;
        --doc-code-bk: rgb(32 36 54);
        --doc-code-text: rgb(165 185 230);
        --doc-required-bk: #3a1a1a;
        --doc-required-text: #e06c75;
        --doc-type-bk: #1e2840;
        --doc-type-text: #7aaddf;
        --doc-default-bk: #1e1a40;
        --doc-default-text: #a98ade;
        --doc-label-text: #5e657a;
        --doc-desc-text: #a0aab8;
    }

    font-family: var(--doc-font);
    margin-top: 1.5em;

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

    .props-table {
        width: 100%;
        border: 1px solid var(--doc-border);
        border-radius: 8px;
        overflow: hidden;
        font-size: 13px;
    }

    .prop-item {
        padding: 10px 14px;
        border-bottom: 1px solid var(--doc-row-border);
        display: flex;
        flex-direction: column;

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background: var(--doc-item-bk-hover);
        }
    }

    .prop-desc.prop-row2 {
        padding-left: 5px;
        padding-top: 10px;
        font-size: 14px;
        .desc-content {
            margin: 0;
        }
    }

    .prop-row1 {
        display: flex;
        align-items: center;
        flex: none;
        gap: 6px;
    }

    .prop-row1.clickable {
        cursor: pointer;
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
    }

    .toggle-icon.open {
        transform: rotate(180deg);
        color: var(--doc-type-text);
    }

    /* expand/collapse transition using max-height + opacity */
    .expand-enter-active,
    .expand-leave-active {
        transition:
            max-height 0.28s ease,
            opacity 0.28s ease,
            padding 0.28s ease;
        overflow: hidden;
    }
    .expand-enter-from,
    .expand-leave-to {
        max-height: 0;
        opacity: 0;
        padding-top: 0;
        padding-bottom: 0;
    }
    .expand-enter-to,
    .expand-leave-from {
        max-height: 800px; /* large enough for most descriptions */
        opacity: 1;
    }

    .prop-row2 {
        font-size: 12.5px;
        color: var(--doc-desc-text);
        line-height: 1.5;
        padding-left: 2px;
    }

    .prop-name {
        width: 120px;
        flex: none;
        code {
            display: inline-flex;
            align-items: center;
            color: var(--doc-code-text);
            background: var(--doc-code-bk);
            padding: 2px 10px;
            line-height: 1.6;
            border-radius: 4px;
            font-family: var(--doc-code-font);
            font-size: 13px;
            font-weight: 600;
        }
    }

    .prop-types {
        width: 280px;
        display: flex;
        place-items: center;
        gap: 8px;
        flex-wrap: nowrap;
        flex: none;
    }

    .prop-short-desc {
        display: flex;
        flex-wrap: nowrap;
        overflow: hidden;

        &.expanded {
            display: none;
        }

        .short-desc {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .required-badge {
        font-size: 10px;
        font-weight: 600;
        color: var(--doc-required-text);
        background: var(--doc-required-bk);
        padding: 2px 5px;
        border-radius: 4px;
        letter-spacing: 0.02em;
        font-size: 12px;
    }

    .type-badge {
        font-family: var(--doc-code-font);
        font-size: 13px;
        color: var(--doc-type-text);
        background: var(--doc-type-bk);
        padding: 1px 6px;
        border-radius: 4px;
    }

    .values-content {
        color: var(--doc-type-text);
        margin-top: 8px;
    }

    .default-badge {
        font-family: var(--doc-code-font);
        font-size: 13px;
        color: var(--doc-default-text);
        background: var(--doc-default-bk);
        padding: 1px 6px;
        border-radius: 4px;
    }

    .section-gap {
        margin-top: 1.2em;
    }

    .event-name {
        width: 160px;
        code {
            color: var(--doc-type-text);
            background: var(--doc-type-bk);
        }
        .event-at {
            opacity: 0.55;
            margin-right: 1px;
        }
    }

    .event-properties {
        margin-top: 8px;
        color: var(--doc-desc-text);
        .title {
            font-size: 13px;
            color: var(--doc-label-text);
            display: block;
            margin-bottom: 4px;
        }
    }

    .event-prop-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        .event-prop-name {
            font-family: var(--doc-code-font);
            font-size: 13px;
            color: var(--doc-code-text);
            background: var(--doc-code-bk);
            padding: 1px 6px;
            border-radius: 4px;
        }
        .event-prop-desc {
            font-size: 13px;
            color: var(--doc-desc-text);
        }
    }

    .slot-name {
        width: 160px;
        code {
            color: #5a7a3a;
            background: #eef5e8;
        }
        .slot-hash {
            opacity: 0.55;
            margin-right: 1px;
        }

        .is-dark-theme & code {
            color: #8dc87a;
            background: #1e2e1a;
        }
    }
}
</style>

<script lang="ts">
import { defineComponent } from "vue"
import type { PropDescriptor, EventDescriptor, SlotDescriptor } from "vue-docgen-api"

export default defineComponent({
    name: "StarmapVueDoc",
    props: {},

    data() {
        return {
            vueMetadata: (window as any).__starmap__?.vueMetadata as any,
            expanded: {} as Record<string, boolean>,
        }
    },

    computed: {
        props(): PropDescriptor[] {
            return this.vueMetadata?.props ?? []
        },

        events(): EventDescriptor[] {
            return this.vueMetadata?.events ?? []
        },

        slots(): SlotDescriptor[] {
            return this.vueMetadata?.slots ?? []
        },
    },

    methods: {
        toggleExpand(name?: string) {
            if (!name) return
            // Vue 3 proxy supports new props on data objects
            this.expanded[name] = !this.expanded[name]
        },

        isExpanded(name?: string) {
            return !!(name && this.expanded && this.expanded[name])
        },

        /** 处理描述文本，去除首尾空白行/空格，并将每行的公共缩进对齐（去除） */
        getDescText(rawDesc?: string) {
            if (!rawDesc) return ""
            // 统一换行符并拆分为行
            const lines = rawDesc.replace(/\r\n/g, "\n").split("\n")
            // 去除首尾空行
            while (lines.length && lines[0].trim() === "") lines.shift()
            while (lines.length && lines[lines.length - 1].trim() === "") lines.pop()
            if (lines.length === 0) return ""

            // 计算最小公共缩进。
            // 逻辑：如果第一行是简短标题且没有缩进，而后续行有缩进（如示例），
            // 则以第二行及之后的非空行为基准计算最小缩进，从而对齐文本。
            const subsequent = lines.slice(1).filter((l) => l.trim() !== "")
            const indents = (subsequent.length ? subsequent : lines).map((l) => {
                const m = l.match(/^[ \t]*/)
                return m ? m[0].replace(/\t/g, "    ").length : 0
            })
            const minIndent = indents.length ? Math.min(...indents) : 0
            const re = new RegExp("^[ \t]{0," + minIndent + "}")

            // 去除每行的公共缩进并返回合并文本
            return lines.map((l) => l.replace(re, "")).join("\n")
        },

        getValueText(value?: string[]) {
            if (!value) return ""
            return value.map((x) => `<code>${x}</code>`).join("  ")
        },
    },
})
</script>
