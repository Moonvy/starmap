import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { outputReadmeVue } from "../outputReadmeVue"

describe("outputReadmeVue", () => {
    test("应该在生成 readme.vue 时注入 unitVueCode（包含 sample 组件）", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-readme-vue-test-"))
        const unitDir = path.join(tempDir, "src", "Surface")
        const sampleDir = path.join(unitDir, "sample")
        const outputDir = path.join(tempDir, ".starmap", "units", "surface")
        const readmeVuePath = path.join(outputDir, "readme.vue")

        try {
            fs.mkdirSync(sampleDir, { recursive: true })
            fs.mkdirSync(outputDir, { recursive: true })

            const readmeContent = `# Surface\n\n<SurfacePreview />\n`
            const readmeFilePath = path.join(unitDir, "readme.md")
            fs.writeFileSync(readmeFilePath, readmeContent)
            fs.writeFileSync(path.join(sampleDir, "SurfacePreview.vue"), "<template><div>Preview</div></template>")

            const mockUnit = {
                id: "surface",
                dirFullPath: unitDir,
                dirName: "Surface",
                unitPath: outputDir,
                readmeFsNode: {
                    fileFullPath: readmeFilePath,
                    fileRelativePath: "src/Surface/readme.md",
                    readMarkdown: async () => ({
                        content: readmeContent,
                        metadata: {},
                    }),
                },
                gen: {
                    allUnits: {
                        flat: [],
                    },
                    starmapCore: {
                        config: {
                            rootPath: tempDir,
                        },
                    },
                },
            } as any

            await outputReadmeVue(mockUnit, readmeVuePath)

            const generatedCode = fs.readFileSync(readmeVuePath, "utf-8")

            // 验证生成的 readme.vue 是否包含 sample 组件的 import 以及 components 声明
            expect(generatedCode).toContain("SurfacePreview.vue")
            expect(generatedCode).toContain('"SurfacePreview":')
            expect(generatedCode).toContain("<StarmapMarkdownWrap>")
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })

    test("应该为 markdown 中的 vue @preview 生成独立 .vue 文件并在 readme.vue 中引用", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-readme-vue-preview-test-"))
        const unitDir = path.join(tempDir, "src", "AbSingleView")
        const outputDir = path.join(tempDir, ".starmap", "units", "abstract-ab-single-view")
        const readmeVuePath = path.join(outputDir, "readme.vue")

        try {
            fs.mkdirSync(unitDir, { recursive: true })
            fs.mkdirSync(outputDir, { recursive: true })

            const readmeContent = `# AbSingleView\n\n\`\`\`vue @preview\n<template>\n    <AbSingleView :views="views" ref="AbSingleView" />\n</template>\n<script>\nimport LoginPage from "./pages/LoginPage.vue"\nexport default {\n    data() { return { views: [] } }\n}\n</script>\n\`\`\`\n`
            const readmeFilePath = path.join(unitDir, "readme.md")
            fs.writeFileSync(readmeFilePath, readmeContent)

            const mockUnit = {
                id: "abstract-ab-single-view",
                dirFullPath: unitDir,
                dirName: "AbSingleView",
                unitPath: outputDir,
                readmeFsNode: {
                    fileFullPath: readmeFilePath,
                    fileRelativePath: "src/AbSingleView/readme.md",
                    readMarkdown: async () => ({
                        content: readmeContent,
                        metadata: {},
                    }),
                },
                gen: {
                    allUnits: {
                        flat: [],
                    },
                    starmapCore: {
                        config: {
                            rootPath: tempDir,
                        },
                    },
                },
            } as any

            await outputReadmeVue(mockUnit, readmeVuePath)

            const generatedCode = fs.readFileSync(readmeVuePath, "utf-8")

            // 验证生成的 readme.vue 是否正确引入了生成的独立组件，而没有在 template 中出现未隔离的 <script>
            expect(generatedCode).toMatch(/import InlinePreview_\w+ from ".+\.vue"/)
            expect(generatedCode).toMatch(/components:\s*\{[\s\S]*InlinePreview_\w+/)
            expect(generatedCode).toMatch(/<template v-slot:preview><InlinePreview_\w+ \/><\/template>/)

            // 检查输出目录下是否生成了对应的 .vue 文件
            const generatedFiles = fs.readdirSync(outputDir)
            const previewFiles = generatedFiles.filter((f) => f.startsWith("InlinePreview_") && f.endsWith(".vue"))
            expect(previewFiles.length).toBe(1)

            const previewFileContent = fs.readFileSync(path.join(outputDir, previewFiles[0]), "utf-8")
            expect(previewFileContent).toContain("<AbSingleView :views=\"views\" ref=\"AbSingleView\" />")
            expect(previewFileContent).toContain(path.resolve(unitDir, "./pages/LoginPage.vue").replace(/\\/g, "/"))
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })
})
