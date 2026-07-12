/**
 * 以有限并发执行异步映射，保持结果顺序与输入一致
 *
 * @param items 待处理列表
 * @param concurrency 最大并发数（至少为 1）
 * @param mapper 异步映射函数
 */
export async function mapPool<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) return []

    const limit = Math.max(1, Math.floor(concurrency))
    const results = new Array<R>(items.length)
    let nextIndex = 0

    async function worker() {
        while (true) {
            const current = nextIndex++
            if (current >= items.length) return
            results[current] = await mapper(items[current], current)
        }
    }

    const workerCount = Math.min(limit, items.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    return results
}
