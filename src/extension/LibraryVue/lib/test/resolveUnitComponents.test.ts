import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { resolveUnitComponents } from "../resolveUnitComponents"
import { createUnitComponentCode } from "../createUnitComponentCode"
import { createGlobalComponentsCode } from "../createGlobalComponentsCode"

describe("resolveUnitComponents", () => {
    test("应该能够解析 CodeUnit 目录下 sample 文件夹中的 vue 组件", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-sample-test-"))
        const unitDir = path.join(tempDir, "src", "Style", "Surface")
        const sampleDir = path.join(unitDir, "sample")

        try {
            fs.mkdirSync(sampleDir, { recursive: true })
            fs.writeFileSync(path.join(unitDir, "readme.md"), "# Surface")
            fs.writeFileSync(path.join(sampleDir, "SurfacePreview.vue"), "<template><div>Preview</div></template>")
            fs.writeFileSync(path.join(sampleDir, "helper.ts"), "export const a = 1")

            const mockUnit = {
                dirFullPath: unitDir,
                dirName: "Surface",
            } as any

            const entries = await resolveUnitComponents(mockUnit)

            expect(entries).toEqual([
                {
                    name: "SurfacePreview",
                    importPath: path.join(sampleDir, "SurfacePreview.vue"),
                },
            ])
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })

    test("应该支持递归解析 sample 子目录中的 vue 组件并忽略非 vue 文件", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-sample-nested-"))
        const unitDir = path.join(tempDir, "src", "Components", "Button")
        const sampleDir = path.join(unitDir, "sample")
        const nestedSampleDir = path.join(sampleDir, "variants")

        try {
            fs.mkdirSync(nestedSampleDir, { recursive: true })
            fs.writeFileSync(path.join(unitDir, "readme.md"), "# Button")
            fs.writeFileSync(path.join(sampleDir, "ButtonBasic.vue"), "<template><div>Basic</div></template>")
            fs.writeFileSync(path.join(nestedSampleDir, "ButtonSpecial.vue"), "<template><div>Special</div></template>")
            fs.writeFileSync(path.join(nestedSampleDir, "notes.md"), "# Notes")

            const mockUnit = {
                dirFullPath: unitDir,
                dirName: "Button",
            } as any

            const entries = await resolveUnitComponents(mockUnit)

            expect(entries).toHaveLength(2)
            expect(entries.find((e) => e.name === "ButtonBasic")).toEqual({
                name: "ButtonBasic",
                importPath: path.join(sampleDir, "ButtonBasic.vue"),
            })
            expect(entries.find((e) => e.name === "ButtonSpecial")).toEqual({
                name: "ButtonSpecial",
                importPath: path.join(nestedSampleDir, "ButtonSpecial.vue"),
            })
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })

    test("应该能同时解析主同名组件、index.ts 导出组件以及 sample 组件", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-sample-mix-"))
        const packageRoot = path.join(tempDir, "packages", "ui")
        const unitDir = path.join(packageRoot, "src", "Surface")
        const sampleDir = path.join(unitDir, "sample")

        try {
            fs.mkdirSync(sampleDir, { recursive: true })
            fs.writeFileSync(path.join(packageRoot, "package.json"), '{"name":"@test/ui"}')
            fs.writeFileSync(path.join(unitDir, "Surface.vue"), "<template><div>Surface</div></template>")
            fs.writeFileSync(path.join(sampleDir, "SurfacePreview.vue"), "<template><div>Preview</div></template>")

            const mockUnit = {
                dirFullPath: unitDir,
                dirName: "Surface",
            } as any

            const entries = await resolveUnitComponents(mockUnit)

            expect(entries).toEqual([
                {
                    name: "Surface",
                    importPath: path.join(unitDir, "Surface.vue"),
                },
                {
                    name: "SurfacePreview",
                    importPath: path.join(sampleDir, "SurfacePreview.vue"),
                },
            ])

            // 验证 createUnitComponentCode 生成的代码
            const unitCode = await createUnitComponentCode(mockUnit)
            expect(unitCode.importCode).toContain("Surface.vue")
            expect(unitCode.importCode).toContain("SurfacePreview.vue")
            expect(unitCode.componentsCode).toContain('"Surface":')
            expect(unitCode.componentsCode).toContain('"SurfacePreview":')

            // 验证 createGlobalComponentsCode 生成的代码
            const globalCode = await createGlobalComponentsCode([mockUnit], tempDir)
            expect(globalCode).toContain('name: "Surface"')
            expect(globalCode).toContain('name: "SurfacePreview"')
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })
})
