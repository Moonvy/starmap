/** 通过 symbol 名截取 JavaScript 源代码
 *
 * 根据 symbol 名在 JavaScript 源代码中找到对应的定义，并截取出该定义的完整代码块。
 *
 *  比如
 *  - `export type ITableIndexConfig {...}`
 * -  `function myFunction() {...}`
 * -  `class MyClass {...}`
 *
 */
export function substringJsBySymbol(jsStr: string, symbol: string): string {
	const safeSource = maskNonCode(jsStr)
	const startIndex = findSymbolDefinitionStart(safeSource, symbol)

	if (startIndex < 0) {
		return jsStr
	}

	return extractDefinition(jsStr, startIndex)
}

/** 根据 symbol 名定位定义语句的起始位置
 *
 * @param source 已屏蔽字符串与注释内容的源码
 * @param symbol 目标 symbol 名
 */
function findSymbolDefinitionStart(source: string, symbol: string): number {
	const escapedSymbol = escapeRegExp(symbol)
	const patterns = [
		new RegExp(
			String.raw`(^|\n)\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s+${escapedSymbol}\b`,
			"m",
		),
		new RegExp(String.raw`(^|\n)\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+${escapedSymbol}\b`, "m"),
		new RegExp(String.raw`(^|\n)\s*(?:export\s+)?(?:declare\s+)?interface\s+${escapedSymbol}\b`, "m"),
		new RegExp(String.raw`(^|\n)\s*(?:export\s+)?(?:declare\s+)?type\s+${escapedSymbol}\b`, "m"),
		new RegExp(String.raw`(^|\n)\s*(?:export\s+)?(?:declare\s+)?enum\s+${escapedSymbol}\b`, "m"),
		new RegExp(String.raw`(^|\n)\s*(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+${escapedSymbol}\b`, "m"),
	]

	let bestIndex = -1

	for (const pattern of patterns) {
		const match = pattern.exec(source)
		if (!match) {
			continue
		}

		const candidateIndex = match.index + match[1].length
		if (bestIndex === -1 || candidateIndex < bestIndex) {
			bestIndex = candidateIndex
		}
	}

	return bestIndex
}

/** 从定义起点开始截取完整代码块
 *
 * @param source 原始源码
 * @param startIndex 定义起始位置
 */
function extractDefinition(source: string, startIndex: number): string {
	let index = startIndex
	let parenthesisDepth = 0
	let bracketDepth = 0
	let braceDepth = 0
	let sawBrace = false

	while (index < source.length) {
		const char = source[index]
		const nextChar = source[index + 1]

		if (char === "\"" || char === "'" || char === "`") {
			index = skipStringLiteral(source, index)
			continue
		}

		if (char === "/" && nextChar === "/") {
			index = skipLineComment(source, index)
			continue
		}

		if (char === "/" && nextChar === "*") {
			index = skipBlockComment(source, index)
			continue
		}

		if (char === "(") {
			parenthesisDepth += 1
		} else if (char === ")") {
			parenthesisDepth = Math.max(0, parenthesisDepth - 1)
		} else if (char === "[") {
			bracketDepth += 1
		} else if (char === "]") {
			bracketDepth = Math.max(0, bracketDepth - 1)
		} else if (char === "{") {
			braceDepth += 1
			sawBrace = true
		} else if (char === "}") {
			braceDepth = Math.max(0, braceDepth - 1)
			if (sawBrace && braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) {
				return sliceWithTrailingSemicolon(source, startIndex, index + 1)
			}
		} else if (char === ";") {
			if (braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) {
				return source.slice(startIndex, index + 1).trim()
			}
		}

		index += 1
	}

	return source.slice(startIndex).trim()
}

/** 跳过字符串字面量
 *
 * @param source 原始源码
 * @param startIndex 字符串起始位置
 */
function skipStringLiteral(source: string, startIndex: number): number {
	const quote = source[startIndex]
	let index = startIndex + 1

	while (index < source.length) {
		const char = source[index]

		if (char === "\\") {
			index += 2
			continue
		}

		if (char === quote) {
			return index + 1
		}

		index += 1
	}

	return source.length
}

/** 跳过单行注释
 *
 * @param source 原始源码
 * @param startIndex 注释起始位置
 */
function skipLineComment(source: string, startIndex: number): number {
	const lineBreakIndex = source.indexOf("\n", startIndex)
	return lineBreakIndex === -1 ? source.length : lineBreakIndex
}

/** 跳过块注释
 *
 * @param source 原始源码
 * @param startIndex 注释起始位置
 */
function skipBlockComment(source: string, startIndex: number): number {
	const endIndex = source.indexOf("*/", startIndex + 2)
	return endIndex === -1 ? source.length : endIndex + 2
}

/** 在截取结果后补上紧随其后的分号
 *
 * @param source 原始源码
 * @param startIndex 定义起始位置
 * @param endIndex 代码块结束位置
 */
function sliceWithTrailingSemicolon(source: string, startIndex: number, endIndex: number): string {
	let index = endIndex

	while (index < source.length && /\s/.test(source[index])) {
		index += 1
	}

	if (source[index] === ";") {
		index += 1
	}

	return source.slice(startIndex, index).trim()
}

/** 将字符串与注释替换为空白，保持索引稳定
 *
 * @param source 原始源码
 */
function maskNonCode(source: string): string {
	const chars = source.split("")
	let index = 0

	while (index < chars.length) {
		const char = chars[index]
		const nextChar = chars[index + 1]

		if (char === "\"" || char === "'" || char === "`") {
			index = maskStringLiteral(chars, index)
			continue
		}

		if (char === "/" && nextChar === "/") {
			index = maskLineComment(chars, index)
			continue
		}

		if (char === "/" && nextChar === "*") {
			index = maskBlockComment(chars, index)
			continue
		}

		index += 1
	}

	return chars.join("")
}

/** 屏蔽字符串字面量内容
 *
 * @param chars 源码字符数组
 * @param startIndex 字符串起始位置
 */
function maskStringLiteral(chars: string[], startIndex: number): number {
	const quote = chars[startIndex]
	let index = startIndex + 1

	while (index < chars.length) {
		const char = chars[index]

		if (char === "\\") {
			if (index < chars.length) {
				chars[index] = " "
			}
			if (index + 1 < chars.length && chars[index + 1] !== "\n") {
				chars[index + 1] = " "
			}
			index += 2
			continue
		}

		if (char === quote) {
			return index + 1
		}

		if (char !== "\n") {
			chars[index] = " "
		}
		index += 1
	}

	return chars.length
}

/** 屏蔽单行注释内容
 *
 * @param chars 源码字符数组
 * @param startIndex 注释起始位置
 */
function maskLineComment(chars: string[], startIndex: number): number {
	let index = startIndex

	while (index < chars.length && chars[index] !== "\n") {
		chars[index] = " "
		index += 1
	}

	return index
}

/** 屏蔽块注释内容
 *
 * @param chars 源码字符数组
 * @param startIndex 注释起始位置
 */
function maskBlockComment(chars: string[], startIndex: number): number {
	let index = startIndex

	while (index < chars.length) {
		const isCommentEnd = chars[index] === "*" && chars[index + 1] === "/"
		if (chars[index] !== "\n") {
			chars[index] = " "
		}
		if (isCommentEnd) {
			chars[index + 1] = " "
			return index + 2
		}
		index += 1
	}

	return chars.length
}

/** 转义正则特殊字符
 *
 * @param value 原始字符串
 */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
