import matter from "gray-matter"

/**
 * 预处理 Markdown 文件内容，提取元数据，并分离正文内容
 *
 * 支持文件开头的 ```metadata ... ``` 块作为 JSON 元数据
 *  ```metadata
 *  {"iconClass":"ri:folders-fill", "sort": 7}
 *  ```
 * 支持文件开头的 ```json metadata ... ``` 块作为 JSON 元数据
 *  ```json metadata
 *  {"iconClass":"ri:folders-fill", "sort": 7}
 *  ```
 *
 * 支持文件开头 --- 风格的 YAML 元数据块，使用 gray-matter 解析
 *
 * @param markdownContent Markdown 原始内容
 * @returns 提取后的元数据与正文内容
 */
export function preloadMarkdown(markdownContent: string): {
    metadata: Record<string, any>
    content: string
} {
    const normalizedContent = markdownContent.replace(/^\uFEFF/, "")
    const customFenceMatch = normalizedContent.match(/^\s*```(?:metadata|json metadata)\s*\r?\n/)

    if (customFenceMatch) {
        const afterOpenIndex = customFenceMatch[0].length
        const restContent = normalizedContent.slice(afterOpenIndex)
        const closingFenceRegex = /(^|\r?\n)```[^\n]*\r?\n?/m
        const closingFenceIndex = restContent.search(closingFenceRegex)

        if (closingFenceIndex === -1) {
            return { metadata: {}, content: normalizedContent }
        }

        const closingFenceMatch = restContent.match(closingFenceRegex)
        const metadataRaw = restContent.slice(0, closingFenceIndex).trim()
        const content = restContent.slice(closingFenceIndex + (closingFenceMatch?.[0].length ?? 0))

        if (!metadataRaw) {
            return { metadata: {}, content }
        }

        try {
            const metadata = JSON.parse(metadataRaw) as Record<string, any>
            return { metadata, content }
        } catch {
            return { metadata: {}, content: normalizedContent }
        }
    }

    let parsed: any
    try {
        parsed = matter(normalizedContent)
    } catch (err) {
        return { metadata: {}, content: normalizedContent }
    }

    return {
        metadata: (parsed.data ?? {}) as Record<string, any>,
        content: parsed.content ?? "",
    }
}
