import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { createGlobalComponentsCode } from "../createGlobalComponentsCode"

describe("createGlobalComponentsCode", () => {
    test("只收集 package.json 所属包内的组件，并对同名组件去重", async () => {
        const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "starmap-global-components-"))
        const packageRoot = path.join(projectRoot, "packages", "demo")
        const packageComponentDir = path.join(packageRoot, "src", "Artboard")
        const looseComponentDir = path.join(projectRoot, "docs", "Loose")

        try {
            fs.mkdirSync(packageComponentDir, { recursive: true })
            fs.mkdirSync(looseComponentDir, { recursive: true })
            fs.writeFileSync(path.join(packageRoot, "package.json"), '{"name":"demo"}')
            fs.writeFileSync(path.join(packageComponentDir, "Artboard.vue"), "<template />")
            fs.writeFileSync(
                path.join(packageComponentDir, "index.ts"),
                'export { default as Artboard } from "./Artboard.vue"',
            )
            fs.writeFileSync(path.join(looseComponentDir, "Loose.vue"), "<template />")

            const code = await createGlobalComponentsCode(
                [
                    { dirFullPath: packageComponentDir, dirName: "Artboard" } as any,
                    { dirFullPath: looseComponentDir, dirName: "Loose" } as any,
                ],
                projectRoot,
            )

            expect(code.match(/name: "Artboard"/g)).toHaveLength(1)
            expect(code).toContain("Artboard.vue")
            expect(code).not.toContain("Loose.vue")
        } finally {
            fs.rmSync(projectRoot, { recursive: true, force: true })
        }
    })
})
