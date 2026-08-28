import { describe, test, expect } from "vitest"
import {
    isColorValue,
    colorToHex6,
    formatColorValue,
    parseCssVars,
    updateCssVarInContent,
} from "../cssVarsParser"

describe("cssVarsParser 测试", () => {
    test("颜色值有效性判断 (isColorValue)", () => {
        expect(isColorValue("#fff")).toBe(true)
        expect(isColorValue("#3b82f6")).toBe(true)
        expect(isColorValue("rgb(67, 80, 109)")).toBe(true)
        expect(isColorValue("rgba(255, 255, 255, 0.5)")).toBe(true)
        expect(isColorValue("hsl(210, 100%, 50%)")).toBe(true)
        expect(isColorValue("oklch(0.6 0.25 140)")).toBe(true)
        expect(isColorValue("transparent")).toBe(true)
        expect(isColorValue("red")).toBe(true)

        expect(isColorValue("14px")).toBe(false)
        expect(isColorValue("calc(100% - 20px)")).toBe(false)
        expect(isColorValue("bold")).toBe(false)
    })

    test("颜色转换为 hex6 (colorToHex6)", () => {
        expect(colorToHex6("#fff")).toBe("#ffffff")
        expect(colorToHex6("#3b82f6")).toBe("#3b82f6")
        expect(colorToHex6("rgb(255, 0, 0)")).toBe("#ff0000")
        expect(colorToHex6("rgb(67, 80, 109)")).toBe("#43506d")
    })

    test("颜色格式化回原格式 (formatColorValue)", () => {
        expect(formatColorValue("rgb(0, 0, 0)", "#ff0000")).toBe("rgb(255, 0, 0)")
        expect(formatColorValue("rgba(0, 0, 0, 0.8)", "#ff0000")).toBe("rgba(255, 0, 0, 0.8)")
        expect(formatColorValue("#000000", "#ff0000")).toBe("#ff0000")
    })

    test("解析 CSS 内容中的注释和变量 (parseCssVars)", () => {
        const css = `
/* 基础颜色变量 */
:root {
    --c-primary: #3b82f6;
    --c-action-bk: rgb(67, 80, 109); /* 操作按钮背景 */
    --font-size-base: 14px;
}

/* 暗色主题 */
.theme-dark {
    --c-bg: #1e1e2e;
}
        `
        const entries = parseCssVars(css)
        expect(entries.length).toBeGreaterThan(0)

        const varPrimary = entries.find((e) => e.name === "--c-primary")
        expect(varPrimary).toBeDefined()
        expect(varPrimary?.value).toBe("#3b82f6")
        expect(varPrimary?.isColor).toBe(true)

        const varAction = entries.find((e) => e.name === "--c-action-bk")
        expect(varAction).toBeDefined()
        expect(varAction?.value).toBe("rgb(67, 80, 109)")
        expect(varAction?.isColor).toBe(true)
        expect(varAction?.inlineComment).toBe("操作按钮背景")

        const varFontSize = entries.find((e) => e.name === "--font-size-base")
        expect(varFontSize).toBeDefined()
        expect(varFontSize?.value).toBe("14px")
        expect(varFontSize?.isColor).toBe(false)
    })

    test("精准替换 CSS 变量值 (updateCssVarInContent)", () => {
        const originalCss = `
/* 基础颜色变量 */
:root {
    --c-primary: #3b82f6;
    --c-action-bk: rgb(67, 80, 109); /* 操作按钮背景 */
    --font-size-base: 14px;
}
        `
        const updated = updateCssVarInContent(originalCss, "--c-action-bk", "rgb(100, 120, 150)")
        expect(updated).toContain("--c-action-bk: rgb(100, 120, 150); /* 操作按钮背景 */")
        expect(updated).toContain("/* 基础颜色变量 */")
        expect(updated).toContain("--c-primary: #3b82f6;")
        expect(updated).toContain("--font-size-base: 14px;")
    })
})
