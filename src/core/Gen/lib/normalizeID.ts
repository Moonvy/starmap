/**
 * 标准化 ID，ID 只能是小写字母、数字和中划线，
 * 不支持的 ASCII 特殊符号替换为 `-`
 * 其他字符会被替换为 Unicode 编码
 *
 *
 *
 * @param input 原始字符串
 */
export function normalizeID(input: string): string {
    const kebabInput = input.replace(/([a-z])([A-Z])/g, "$1-$2")
    const lower = kebabInput.toLowerCase()
    let result = ""

    for (const char of lower) {
        const code = char.codePointAt(0)!
        if (code <= 0x7f) {
            const isLower = code >= 0x61 && code <= 0x7a
            const isDigit = code >= 0x30 && code <= 0x39
            if (isLower || isDigit || char === "-") {
                result += char
            } else {
                result += "-"
            }
        } else {
            result += `u${code.toString(16)}`
        }
    }

    return result.replace(/^-+/, "").replace(/-+$/, "")
}
