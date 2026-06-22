import crypto from "node:crypto"
import path from "node:path"
import fsex from "fs-extra"
import chalk from "chalk"

interface IFileCache {
    length: number
    md5: string
}

const cache = new Map<string, IFileCache>()

/**
 * 输出文件并缓存文件内容，避免重复输出
 * 这主要是为了避免不必要的写入文件导致 vite 触发不必要的 page reload
 *
 * 每一个输出文件操作会记录 outputPath, content 的长度和 md5 值到内存缓存
 * 每次输出前会检查缓存，如果缓存中存在相同的 outputPath, content 的长度和 md5 值，则不输出
 *
 * @param outputPath 输出文件路径
 * @param content 输出内容，可以是字符串或 ArrayBuffer
 */
export function outputFileWithCache(outputPath: string, content: string | ArrayBuffer) {
    const isString = typeof content === "string"
    const length = isString ? Buffer.byteLength(content as string, "utf-8") : (content as ArrayBuffer).byteLength
    const cached = cache.get(outputPath)

    // 如果长度一致，则进一步检查 MD5
    if (cached && cached.length === length) {
        const data = isString ? (content as string) : Buffer.from(content as ArrayBuffer)
        const md5 = crypto.createHash("md5").update(data).digest("hex")
        if (cached.md5 === md5) {
            // 内容一致，跳过输出
            return
        }

        // 内容不一致，执行输出并更新缓存
        fsex.outputFileSync(outputPath, data)
        cache.set(outputPath, { length, md5 })
    } else {
        // 长度不一致或无缓存，直接输出
        const data = isString ? (content as string) : Buffer.from(content as ArrayBuffer)
        fsex.outputFileSync(outputPath, data)

        // 计算新的 MD5 并更新缓存
        const md5 = crypto.createHash("md5").update(data).digest("hex")
        cache.set(outputPath, { length, md5 })
    }

    // 输出提示信息
    const relativePath = path.relative(process.cwd(), outputPath)
    // console.log(`${chalk.gray("[Starmap]")} ${chalk.green("Output:")} ${chalk.cyan(relativePath)}`)
}
/**
 * 输出 JSON 文件并缓存，避免重复输出
 * @param outputPath 输出文件路径
 * @param data 输出对象
 */
export function outputJsonWithCache(outputPath: string, data: any) {
    const content = JSON.stringify(data, null, 2)
    outputFileWithCache(outputPath, content)
}
