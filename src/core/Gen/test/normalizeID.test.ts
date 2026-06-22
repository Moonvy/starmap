import { normalizeID } from "../lib/normalizeID"

describe("normalizeID", () => {
    test("应该支持基本的数字和字母，并且全部转为小写，处理驼峰", () => {
        expect(normalizeID("HelloWorld-123")).toBe("hello-world-123")
    })

    test("应该将不支持的 ASCII 字符替换为中划线", () => {
        expect(normalizeID("hello_world")).toBe("hello-world")
        expect(normalizeID("foo.bar")).toBe("foo-bar")
        expect(normalizeID("my name is bob")).toBe("my-name-is-bob")
    })

    test("应该移除首尾的无效 ASCII 字符产生的中划线", () => {
        expect(normalizeID("_-hello_world-_")).toBe("hello-world")
        expect(normalizeID("---abc---")).toBe("abc")
        expect(normalizeID("  spaces  ")).toBe("spaces")
    })

    test("不支持的连续特殊字符应该转换为对应数量的中划线", () => {
        expect(normalizeID("hello...world")).toBe("hello---world")
        expect(normalizeID("hello!@#world")).toBe("hello---world")
    })

    test("应该支持 Unicode 中文字符并转换为 16 进制编码前缀为 u", () => {
        // "你" -> 4f60, "好" -> 597d
        expect(normalizeID("你好")).toBe("u4f60u597d")
        // "中" -> 4e2d, "文" -> 6587, "测" -> 6d4b, "试" -> 8bd5
        expect(normalizeID("中文ID_测试")).toBe("u4e2du6587id-u6d4bu8bd5")
    })

    test("应该支持 Emoji 表情符并转换为相应的 Unicode 编码", () => {
        // "✨" -> 2728
        expect(normalizeID("starmap✨")).toBe("starmapu2728")
        // "🚀" -> 1f680
        expect(normalizeID("🚀hello")).toBe("u1f680hello")
    })

    test("空字符串应该返回空", () => {
        expect(normalizeID("")).toBe("")
    })

    test("例子", () => {
        expect(normalizeID("UnitTreeLabel")).toBe("unit-tree-label")
        expect(normalizeID("action-a")).toBe("action-a")
        expect(normalizeID("normalizeID")).toBe("normalize-id")
        expect(normalizeID("Display/zIcon")).toBe("display-z-icon")
    })
})
