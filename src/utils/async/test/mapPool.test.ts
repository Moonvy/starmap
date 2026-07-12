import { describe, expect, test } from "vitest"
import { mapPool } from "../mapPool"

describe("mapPool", () => {
    test("保持结果顺序且全部完成", async () => {
        const result = await mapPool([3, 1, 2], 2, async (n) => {
            await new Promise((r) => setTimeout(r, n * 5))
            return n * 10
        })
        expect(result).toEqual([30, 10, 20])
    })

    test("并发数限制生效", async () => {
        let running = 0
        let maxRunning = 0

        await mapPool([1, 2, 3, 4, 5, 6], 2, async () => {
            running++
            maxRunning = Math.max(maxRunning, running)
            await new Promise((r) => setTimeout(r, 20))
            running--
        })

        expect(maxRunning).toBeLessThanOrEqual(2)
        expect(maxRunning).toBeGreaterThanOrEqual(1)
    })

    test("空列表返回空数组", async () => {
        const result = await mapPool([], 4, async (x) => x)
        expect(result).toEqual([])
    })
})
