import path from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

import { getLibraryVueRoot, getPackageRoot } from "../../../utils/packagePath"

export default defineConfig({
    appType: "spa",
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag.startsWith("hd-"),
                },
            },
        }),
    ],
    resolve: {
        alias: {
            "~web": path.resolve(getLibraryVueRoot(), "web"),
            "@moonvy/starmap/node_modules": path.resolve(getPackageRoot(), "node_modules"),
        },
    },
    server: {
        watch: {
            ignored: ["!**/node_modules/.starmap/**"],
        },
    },
})
