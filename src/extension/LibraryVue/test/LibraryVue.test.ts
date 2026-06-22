import { describe, expect, test, vi, beforeEach } from "vitest"
import path from "node:path"
import { StarmapCoreEvents } from "../../../core/events"
import { LibraryVue } from "../LibraryVue"

vi.mock("../lib/outputTemplate", () => ({
    outputTemplate: vi.fn(),
}))

vi.mock("../vite/createViteServer", () => ({
    createViteServer: vi.fn(),
}))

vi.mock("node:child_process", () => ({
    exec: vi.fn((cmd, options, callback) => {
        const cb = typeof options === "function" ? options : callback
        if (cb) {
            cb(null, { stdout: "mocked install" })
        }
    }),
}))

vi.mock("../lib/createGlobalComponentsCode", () => ({
    createGlobalComponentsCode: vi.fn(async () => ""),
}))

vi.mock("fs-extra", () => ({
    default: {
        copySync: vi.fn(),
        existsSync: vi.fn(() => true),
    },
}))

vi.mock("@parcel/watcher", () => ({
    subscribe: vi.fn(),
}))

vi.mock("../../../utils/fs/outputFileWithCache", () => ({
    outputFileWithCache: vi.fn(),
}))

interface ITestEventHub {
    on: (event: string, handler: (payload: any) => any) => void
    emitAsync: (event: string, payload: any) => Promise<void>
}

function createTestEventHub(): ITestEventHub {
    const handlers = new Map<string, Array<(payload: any) => any>>()

    return {
        on(event, handler) {
            const list = handlers.get(event) ?? []
            list.push(handler)
            handlers.set(event, list)
        },
        async emitAsync(event, payload) {
            const list = handlers.get(event) ?? []
            for (const handler of list) {
                await handler(payload)
            }
        },
    }
}

describe("LibraryVue", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test("generateTree 事件应该刷新根路由文件", async () => {
        const { outputTemplate } = await import("../lib/outputTemplate")
        const { outputFileWithCache } = await import("../../../utils/fs/outputFileWithCache")
        const eventHub = createTestEventHub()
        const outputDir = "/tmp/starmap-output"
        const newUnitId = "docs-src-u8fc7u6ee4u5668u4e0eu64cdu4f5cu7b26"

        const core = {
            logger: {
                log: vi.fn(),
                debug: vi.fn(),
                error: vi.fn(),
            },
            config: {
                outputDir,
            },
            eventHub,
            gen: {
                allUnits: {
                    flat: [],
                },
            },
        } as any

        await LibraryVue()(core)

        core.gen.allUnits.flat.push({ id: newUnitId })

        await eventHub.emitAsync(StarmapCoreEvents.generateTree, {
            gen: core.gen,
            starmapCore: core,
        })

        expect(outputTemplate).toHaveBeenCalledWith(
            "router.ts",
            path.join(outputDir, "router.ts"),
            expect.objectContaining({
                routes: expect.stringContaining(`/units/${newUnitId}`),
            }),
        )

        expect(outputFileWithCache).toHaveBeenCalledWith(
            path.join(outputDir, "package.json"),
            expect.stringContaining('"name": "@moonvy/starmap-output"')
        )
    })
})