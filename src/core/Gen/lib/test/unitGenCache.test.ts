import { describe, expect, test, beforeEach, afterEach } from "vitest"
import path from "node:path"
import fs from "node:fs"
import fsex from "fs-extra"
import {
    UNIT_GEN_CACHE_VERSION,
    collectUnitCoreInputMtimes,
    tryGetFreshUnitGenStamp,
    writeUnitGenStamp,
    readUnitGenStamp,
} from "../unitGenCache"
import type { CodeUnit } from "../../CodeUnit"

const tmpRoot = path.resolve(__dirname, "./tmp-unit-gen-cache")

function makeUnit(overrides?: Partial<{ id: string; readme: string; mainVue?: string }>): CodeUnit {
    const id = overrides?.id || "demo-unit"
    const unitPath = path.join(tmpRoot, "out", "units", id)
    const readmePath = path.join(tmpRoot, "src", id, "readme.md")
    const mainVue = overrides?.mainVue

    fsex.ensureDirSync(path.dirname(readmePath))
    fsex.ensureDirSync(unitPath)
    fs.writeFileSync(readmePath, overrides?.readme || "# Demo\n")

    let mainComponentFsNode: any
    if (mainVue) {
        const vuePath = path.join(tmpRoot, "src", id, "Comp.vue")
        fs.writeFileSync(vuePath, mainVue)
        mainComponentFsNode = { fileFullPath: vuePath }
    }

    return {
        id,
        unitPath,
        readmeFullPath: readmePath,
        mainComponentFsNode,
        indexCodeFsNode: undefined,
        readmeImportDependencyPaths: [],
    } as unknown as CodeUnit
}

describe("unitGenCache", () => {
    beforeEach(() => {
        fsex.removeSync(tmpRoot)
        fsex.ensureDirSync(tmpRoot)
    })

    afterEach(() => {
        fsex.removeSync(tmpRoot)
    })

    test("写入 stamp 后可判定为新鲜并恢复 deps", async () => {
        const unit = makeUnit()
        // 模拟已生成输出
        fs.writeFileSync(path.join(unit.unitPath, "readme.vue"), "<template></template>")
        fs.writeFileSync(path.join(unit.unitPath, "unit.vue"), "<template></template>")
        fs.writeFileSync(path.join(unit.unitPath, "metadata.ts"), "export default {}")

        const depPath = path.join(tmpRoot, "src", "demo-unit", "extra.ts")
        fs.writeFileSync(depPath, "export const x = 1")

        await writeUnitGenStamp(unit, [depPath])

        const stamp = await tryGetFreshUnitGenStamp(unit)
        expect(stamp).not.toBeNull()
        expect(stamp!.v).toBe(UNIT_GEN_CACHE_VERSION)
        expect(stamp!.deps).toContain(path.resolve(depPath))
    })

    test("readme 变更后 stamp 失效", async () => {
        const unit = makeUnit()
        fs.writeFileSync(path.join(unit.unitPath, "readme.vue"), "<template></template>")
        fs.writeFileSync(path.join(unit.unitPath, "unit.vue"), "<template></template>")
        fs.writeFileSync(path.join(unit.unitPath, "metadata.ts"), "export default {}")

        await writeUnitGenStamp(unit, [])
        expect(await tryGetFreshUnitGenStamp(unit)).not.toBeNull()

        // 修改 readme 使 mtime 变化
        await new Promise((r) => setTimeout(r, 20))
        fs.writeFileSync(unit.readmeFullPath, "# Demo changed\n")

        expect(await tryGetFreshUnitGenStamp(unit)).toBeNull()
    })

    test("缺少输出文件时不可跳过", async () => {
        const unit = makeUnit()
        await writeUnitGenStamp(unit, [])
        // 没有 readme.vue 等输出
        expect(await tryGetFreshUnitGenStamp(unit)).toBeNull()
    })

    test("collectUnitCoreInputMtimes 包含 readme 与主组件", async () => {
        const unit = makeUnit({ mainVue: "<template></template>" })
        const inputs = await collectUnitCoreInputMtimes(unit)
        expect(Object.keys(inputs)).toContain(unit.readmeFullPath)
        expect(Object.keys(inputs)).toContain(unit.mainComponentFsNode!.fileFullPath)
    })

    test("readUnitGenStamp 版本不匹配时返回 null", async () => {
        const unit = makeUnit()
        const stampPath = path.join(unit.unitPath, "gen-stamp.json")
        fs.writeFileSync(
            stampPath,
            JSON.stringify({ v: UNIT_GEN_CACHE_VERSION - 1, inputs: {}, deps: [] }, null, 2),
        )
        expect(await readUnitGenStamp(unit)).toBeNull()
    })
})
