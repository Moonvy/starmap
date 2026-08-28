import type { Plugin, ViteDevServer } from "vite"
import type { StarmapCore } from "../../../core/StarmapCore"
import path from "node:path"
import fs from "node:fs/promises"

/**
 * 为 Vite 开发服务器提供 Starmap 专用的文件读写 API 插件
 * 提供 /__starmap_api/read-file 和 /__starmap_api/write-file 接口
 */
export function starmapApiPlugin(core: StarmapCore): Plugin {
    return {
        name: "starmap:api",
        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url || "", "http://localhost")
                const pathname = url.pathname

                // 1. 读取文件接口
                if ((pathname === "/__starmap_api/read-file" || pathname.endsWith("/__starmap_api/read-file")) && req.method === "GET") {
                    const filePath = url.searchParams.get("path")
                    if (!filePath) {
                        res.statusCode = 400
                        res.setHeader("Content-Type", "application/json; charset=utf-8")
                        res.end(JSON.stringify({ success: false, message: "缺少 path 参数" }))
                        return
                    }

                    try {
                        const fullPath = path.isAbsolute(filePath)
                            ? filePath
                            : path.resolve(core.config.rootPath || process.cwd(), filePath)

                        const content = await fs.readFile(fullPath, "utf-8")
                        res.statusCode = 200
                        res.setHeader("Content-Type", "application/json; charset=utf-8")
                        res.end(JSON.stringify({ success: true, content, fullPath }))
                    } catch (error: any) {
                        res.statusCode = 500
                        res.setHeader("Content-Type", "application/json; charset=utf-8")
                        res.end(JSON.stringify({ success: false, message: error.message }))
                    }
                    return
                }

                // 2. 写入文件接口
                if ((pathname === "/__starmap_api/write-file" || pathname.endsWith("/__starmap_api/write-file")) && req.method === "POST") {
                    let body = ""
                    req.on("data", (chunk) => {
                        body += chunk
                    })
                    req.on("end", async () => {
                        try {
                            const data = JSON.parse(body || "{}")
                            const filePath = data.path
                            const content = data.content

                            if (!filePath || content === undefined) {
                                res.statusCode = 400
                                res.setHeader("Content-Type", "application/json; charset=utf-8")
                                res.end(
                                    JSON.stringify({
                                        success: false,
                                        message: "请求体中缺少 path 或 content 参数",
                                    }),
                                )
                                return
                            }

                            const fullPath = path.isAbsolute(filePath)
                                ? filePath
                                : path.resolve(core.config.rootPath || process.cwd(), filePath)

                            await fs.writeFile(fullPath, content, "utf-8")

                            // 清理对应 FsNode 缓存
                            const node = core.fsTree.getOrCreateNode(fullPath)
                            if (node) {
                                node.changeCache(Date.now())
                            }

                            res.statusCode = 200
                            res.setHeader("Content-Type", "application/json")
                            res.end(JSON.stringify({ success: true, fullPath }))
                        } catch (error: any) {
                            res.statusCode = 500
                            res.setHeader("Content-Type", "application/json")
                            res.end(JSON.stringify({ success: false, message: error.message }))
                        }
                    })
                    return
                }

                next()
            })
        },
    }
}
