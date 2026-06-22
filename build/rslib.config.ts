import { defineConfig } from "@rslib/core"
export default defineConfig({
    source: {
        entry: {
            index: "src/index.ts",
            cli: "src/cli.ts",
        },
    },
    lib: [
        {
            format: "esm",
            syntax: ["node 24"],
            dts: true,
            autoExternal: true,
        },
    ],
    output: {
        target: "node",
        externals: [],
        filenameHash: false,
    },
    resolve: {
        alias: {},
    },
})
