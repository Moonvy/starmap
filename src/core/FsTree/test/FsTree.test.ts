import path from "node:path"
import fs from "node:fs"
import { FsTree, FsNode } from ".."

// 在 test/dist 下创建真实的测试文件目录结构
const distPath = path.resolve(__dirname, "dist")

/** 辅助函数：在 dist 下创建文件 */
function writeFile(relativePath: string, content: string) {
    const fullPath = path.join(distPath, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
}

beforeAll(() => {
    // 清理并重建 dist 测试目录
    fs.rmSync(distPath, { recursive: true, force: true })
    fs.mkdirSync(distPath, { recursive: true })

    // 创建测试文件结构
    writeFile("readme.md", "# Hello World")
    writeFile("package.json", JSON.stringify({ name: "test-project", version: "1.0.0" }))
    writeFile("src/index.ts", "export const hello = 'world'")
    writeFile("src/utils/helper.ts", "export function add(a: number, b: number) { return a + b }")
    writeFile("src/utils/format.ts", "export function fmt(s: string) { return s.trim() }")
    writeFile("docs/guide.md", "# Guide")
})

afterAll(() => {
    // 测试完成后清理 dist 目录
    fs.rmSync(distPath, { recursive: true, force: true })
})

describe("FsTree", () => {
    test("构造函数：正确设置 rootPath 选项", () => {
        const tree = new FsTree(distPath)
        expect(tree.options.rootPath).toBe(distPath)
    })

    test("resolvePath：相对路径解析为绝对路径", () => {
        const tree = new FsTree(distPath)
        const resolved = tree.resolvePath("src/index.ts")
        expect(resolved).toBe(path.resolve(distPath, "src/index.ts"))
    })

    test("resolvePath：绝对路径原样返回", () => {
        const tree = new FsTree(distPath)
        const absPath = "/tmp/some-file.ts"
        expect(tree.resolvePath(absPath)).toBe(absPath)
    })

    test("getFiles：单一文件路径返回单个 FsNode", () => {
        const tree = new FsTree(distPath)
        const nodes = tree.scanFiles("package.json")
        expect(nodes).toHaveLength(1)
        expect(nodes[0]).toBeInstanceOf(FsNode)
        expect(nodes[0].fileFullPath).toBe(path.resolve(distPath, "package.json"))
    })

    test("getFiles：相同路径返回缓存的 FsNode 实例", () => {
        const tree = new FsTree(distPath)
        const nodes1 = tree.scanFiles("package.json")
        const nodes2 = tree.scanFiles("package.json")
        expect(nodes1[0]).toBe(nodes2[0])
    })

    test("getFiles：通配符匹配多个文件", () => {
        const tree = new FsTree(distPath)
        const nodes = tree.scanFiles("src/utils/*.ts")
        expect(nodes).toHaveLength(2)
        const names = nodes.map((n) => path.basename(n.fileFullPath)).sort()
        expect(names).toEqual(["format.ts", "helper.ts"])
    })

    test("getFiles：递归通配符匹配所有 .ts 文件", () => {
        const tree = new FsTree(distPath)
        const nodes = tree.scanFiles("**/*.ts")
        expect(nodes).toHaveLength(3)
        const names = nodes.map((n) => path.basename(n.fileFullPath)).sort()
        expect(names).toEqual(["format.ts", "helper.ts", "index.ts"])
    })

    test("getFiles：通配符无匹配时返回空数组", () => {
        const tree = new FsTree(distPath)
        const nodes = tree.scanFiles("nonexistent-dir/**/*.xyz")
        expect(nodes).toHaveLength(0)
    })
})

describe("FsNode", () => {
    test("fileRelativePath：返回相对于 rootPath 的路径", () => {
        const tree = new FsTree(distPath)
        const node = tree.scanFiles("src/index.ts")[0]
        expect(node.fileRelativePath).toBe("src/index.ts")
    })

    test("readText：读取文件文本内容", async () => {
        const tree = new FsTree(distPath)
        const node = tree.scanFiles("package.json")[0]
        const text = await node.readText()
        const json = JSON.parse(text)
        expect(json.name).toBe("test-project")
        expect(json.version).toBe("1.0.0")
    })

    test("readText：多次读取返回缓存内容（同一引用）", async () => {
        const tree = new FsTree(distPath)
        const node = tree.scanFiles("readme.md")[0]
        const text1 = await node.readText()
        const text2 = await node.readText()
        // 缓存命中时应返回完全相同的字符串引用
        expect(text1).toBe(text2)
        expect(text1).toBe("# Hello World")
    })

    test("readBuffer：读取文件二进制内容", async () => {
        const tree = new FsTree(distPath)
        const node = tree.scanFiles("readme.md")[0]
        const buffer = await node.readBuffer()
        expect(buffer).toBeInstanceOf(ArrayBuffer)
        expect(buffer.byteLength).toBe("# Hello World".length)
    })

    test("changeCache：mtime 变化时清除缓存", async () => {
        const tree = new FsTree(distPath)
        const node = tree.scanFiles("readme.md")[0]

        // 先读取一次以填充缓存
        const text1 = await node.readText()
        expect(text1).toBe("# Hello World")

        // 模拟 mtime 变化，触发缓存失效
        node.changeCache(Date.now() + 99999)

        // 修改文件内容
        fs.writeFileSync(node.fileFullPath, "# Updated", "utf-8")

        // 缓存已失效，再次读取应从磁盘获取新内容
        const text2 = await node.readText()
        expect(text2).toBe("# Updated")
    })
})
