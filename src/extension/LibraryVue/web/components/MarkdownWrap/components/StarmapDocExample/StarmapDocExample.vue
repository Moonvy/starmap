<template>
    <div class="StarmapDocExample">
        <div class="section-label">Example</div>
        <slot />
    </div>
</template>

<style>
.StarmapDocExample {
    --doc-font: var(--starmap-content-font);
    --doc-label-text: #8a91a8;

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
    }

    > .StarmapCodeWrap,
    > .StarmapCodeWrap .code-warp-box {
        margin-top: 0;
    }
}

.is-dark-theme .StarmapDocExample {
    --doc-label-text: #5e657a;
}
</style>

<script lang="ts">
import { defineComponent } from "vue"

export default defineComponent({
    name: "StarmapDocExample",
})
</script>
