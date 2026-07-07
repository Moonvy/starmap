import * as ts from "typescript"
import MarkdownIt from "markdown-it"
import * as fs from "node:fs"
import * as path from "node:path"

const inlineMarkdown = new MarkdownIt({
    html: false,
})

interface ImportDocOptions {
    /** 当前解析的代码文件路径，用于 TypeScript SourceFile 命名 */
    filePath?: string
    /** 是否忽略注释的第一行 */
    ignoreFirstLine?: boolean
}

interface SymbolMatch {
    /** 用于提取注释的节点，变量声明通常对应完整声明语句 */
    docNode: ts.Node
    /** 用于分析参数的声明节点 */
    declaration: ts.Node
    /** 匹配该节点时对应的 ts.SourceFile */
    sourceFile: ts.SourceFile
    /** 匹配该节点时对应的物理源码内容 */
    code: string
    /** 匹配该节点时对应的文件绝对路径 */
    filePath?: string
}

interface ParamDoc {
    /** 参数名 */
    name: string
    /** 参数类型文本 */
    type: string
    /** 参数说明 */
    description: string
    /** 对象参数的下一层属性 */
    children?: ParamDoc[]
}

interface ReturnDoc {
    /** 返回值类型文本 */
    type: string
    /** 返回值说明 */
    description: string
    /** 返回值对象的下一层属性 */
    children?: ParamDoc[]
}

type TypeDeclaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration

interface ParseContext {
    /** TypeScript 源码 AST */
    sourceFile: ts.SourceFile
    /** 原始源码，用于读取参数节点上的内联 JSDoc 注释 */
    code: string
    /** 从 JSDoc @param 标签解析出的说明 */
    paramComments: Map<string, string>
    /** 从 JSDoc @returns 标签解析出的说明 */
    returnComment: string
    /** 当前文件内可展开的 type/interface 声明 */
    typeIndex: Map<string, TypeDeclaration>
}

/** 把 `@import "code.ts" @doc=symbol` 转换成 Markdown 文档
 *
 * @param code 代码文件内容
 * @param symbolName 要分析的 symbol 名称
 * @param options 解析选项
 */
/** 渲染单个 Match 节点
 *
 * @param match 节点匹配信息
 * @param options 解析选项
 * @param context 解析上下文
 */
function renderSingleMatch(match: SymbolMatch, options: ImportDocOptions, context: ParseContext): string {
    const docs = getDocParts(match.docNode, match.sourceFile, match.code, options.ignoreFirstLine ?? false)
    const localContext: ParseContext = {
        ...context,
        paramComments: docs.paramComments,
        returnComment: docs.returnComment,
    }
    const params = getParamDocs(match.declaration, localContext)
    const returnDoc = getReturnDoc(match.declaration, localContext)
    const blocks: string[] = []

    if (docs.description) {
        blocks.push(renderMainComment(docs.description))
    }

    if (params.length > 0 || returnDoc) {
        blocks.push(renderParamsComponent(params, returnDoc))
    }

    if (docs.examples && docs.examples.length > 0) {
        for (const ex of docs.examples) {
            const trimmed = ex.trim()
            const formattedEx = trimmed.startsWith("```") ? ex : `\`\`\`ts\n${ex}\n\`\`\``
            blocks.push(`<StarmapDocExample>\n\n${formattedEx}\n\n</StarmapDocExample>`)
        }
    }

    return blocks.join("\n\n")
}

export function renderImportDoc(code: string, symbolName: string, options: ImportDocOptions = {}): string {
    const sourceFile = ts.createSourceFile(
        options.filePath || "starmap-import-doc.ts",
        code,
        ts.ScriptTarget.Latest,
        true,
    )
    const match = findSymbolMatch(sourceFile, symbolName, code, options.filePath)

    if (!match) {
        return `> [!WARNING] Doc Import Warning\n> Symbol \`${symbolName}\` not found.`
    }

    const context: ParseContext = {
        sourceFile: match.sourceFile,
        code: match.code,
        paramComments: new Map(),
        returnComment: "",
        typeIndex: createTypeIndex(match.sourceFile),
    }

    const mainDoc = renderSingleMatch(match, options, context)

    // 检测主声明是否是“容器”（对象字面量、类声明、接口声明等）
    // 只有当查询的 symbolName 并不包含点时（非精确成员查询），才自动展开子成员
    const isDotPath = symbolName.includes(".")
    const childrenDocs: string[] = []

    if (!isDotPath) {
        const decl = match.declaration
        const childNodes: { name: string; node: ts.Node }[] = []

        // 情况 A：类声明
        if (ts.isClassDeclaration(decl)) {
            for (const member of decl.members) {
                // 排除构造函数
                if (ts.isConstructorDeclaration(member)) {
                    continue
                }
                if (member.name) {
                    const memberName = getPropertyNameText(member.name, match.sourceFile)
                    if (memberName) {
                        childNodes.push({ name: memberName, node: member })
                    }
                }
            }
        }
        // 情况 B：接口声明
        else if (ts.isInterfaceDeclaration(decl)) {
            for (const member of decl.members) {
                if (member.name) {
                    const memberName = getPropertyNameText(member.name, match.sourceFile)
                    if (memberName) {
                        childNodes.push({ name: memberName, node: member })
                    }
                }
            }
        }
        // 情况 C：对象字面量变量声明或属性声明
        else {
            let initializer: ts.Expression | undefined
            if (ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl) || ts.isPropertyDeclaration(decl)) {
                initializer = decl.initializer
            }
            if (initializer && ts.isObjectLiteralExpression(initializer)) {
                for (const prop of initializer.properties) {
                    if (prop.name) {
                        const propName = getPropertyNameText(prop.name, match.sourceFile)
                        if (propName) {
                            childNodes.push({ name: propName, node: prop })
                        }
                    }
                }
            }
        }

        // 遍历并渲染子节点
        for (const child of childNodes) {
            const childMatch: SymbolMatch = {
                docNode: child.node,
                declaration: child.node,
                sourceFile: match.sourceFile,
                code: match.code,
                filePath: match.filePath,
            }
            // 子成员不要忽略首行
            const childDoc = renderSingleMatch(childMatch, { ...options, ignoreFirstLine: false }, context)
            if (childDoc.trim()) {
                childrenDocs.push(`#### \`${symbolName}.${child.name}\`\n\n${childDoc}`)
            }
        }
    }

    const blocks: string[] = []
    if (mainDoc.trim()) {
        blocks.push(mainDoc)
    }

    if (childrenDocs.length > 0) {
        blocks.push(childrenDocs.join("\n\n"))
    }

    if (blocks.length === 0) {
        return `> [!WARNING] Doc Import Warning\n> Symbol \`${symbolName}\` has no readable docs.`
    }

    return blocks.join("\n\n")
}

/** 建立当前文件内 type/interface 的索引
 *
 * @param sourceFile TypeScript 源码 AST
 */
function createTypeIndex(sourceFile: ts.SourceFile): Map<string, TypeDeclaration> {
    const typeIndex = new Map<string, TypeDeclaration>()

    const visit = (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
            typeIndex.set(node.name.text, node)
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return typeIndex
}

/** 渲染主要注释内容，外层用 div 方便前端统一控制样式
 *
 * @param description 主要注释 Markdown 内容
 */
function renderMainComment(description: string): string {
    const lines = description.split("\n").map((line) => {
        if (line.trim() === "") {
            return `<div class="starmap-import-doc-comment-line is-empty"></div>`
        }

        return `<div class="starmap-import-doc-comment-line">${inlineMarkdown.renderInline(line)}</div>`
    })

    return `<div class="starmap-import-doc-comment">${lines.join("")}</div>`
}

/** 获取属性/成员名称文本
 *
 * @param name 属性名节点
 * @param sourceFile TypeScript 源码 AST
 */
function getPropertyNameText(name: ts.PropertyName, sourceFile: ts.SourceFile): string {
    if (ts.isIdentifier(name)) {
        return name.text
    }
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text
    }
    return name.getText(sourceFile)
}

/** 寻找指定容器节点下的子成员
 *
 * @param parentMatch 父节点匹配信息
 * @param partName 子成员名称
 */
function findChildMatch(parentMatch: SymbolMatch, partName: string): SymbolMatch | null {
    const decl = parentMatch.declaration

    // 检查 Class/Interface 的成员
    if (ts.isClassDeclaration(decl) || ts.isInterfaceDeclaration(decl)) {
        for (const member of decl.members) {
            if (member.name && getPropertyNameText(member.name, parentMatch.sourceFile) === partName) {
                return {
                    docNode: member,
                    declaration: member,
                    sourceFile: parentMatch.sourceFile,
                    code: parentMatch.code,
                    filePath: parentMatch.filePath,
                }
            }
        }
    }

    // 检查 TypeAlias 的成员
    if (ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)) {
        for (const member of decl.type.members) {
            if (member.name && getPropertyNameText(member.name, parentMatch.sourceFile) === partName) {
                return {
                    docNode: member,
                    declaration: member,
                    sourceFile: parentMatch.sourceFile,
                    code: parentMatch.code,
                    filePath: parentMatch.filePath,
                }
            }
        }
    }

    // 检查变量/属性初始值是对象字面量的情况
    let initializer: ts.Expression | undefined
    if (ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl) || ts.isPropertyDeclaration(decl)) {
        initializer = decl.initializer
    }

    if (initializer && ts.isObjectLiteralExpression(initializer)) {
        for (const prop of initializer.properties) {
            if (prop.name && getPropertyNameText(prop.name, parentMatch.sourceFile) === partName) {
                return {
                    docNode: prop,
                    declaration: prop,
                    sourceFile: parentMatch.sourceFile,
                    code: parentMatch.code,
                    filePath: parentMatch.filePath,
                }
            }
        }
    }

    return null
}

/** 在 AST 中查找指定 symbol 的声明（仅寻找顶级名称）
 *
 * @param sourceFile TypeScript 源码 AST
 * @param symbolName 要查找的顶级 symbol 名称
 */
function findSymbolMatchInternal(
    sourceFile: ts.SourceFile,
    symbolName: string,
    code: string,
    filePath?: string,
): SymbolMatch | null {
    const state = {
        found: null as SymbolMatch | null,
        reExportInfo: null as { originalName: string; modulePath: string } | null,
    }

    const visit = (node: ts.Node) => {
        if (state.found || state.reExportInfo) {
            return
        }

        if (ts.isVariableStatement(node)) {
            for (const declaration of node.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) {
                    state.found = { docNode: node, declaration, sourceFile, code, filePath }
                    return
                }
            }
        } else if (isNamedDeclaration(node, symbolName)) {
            state.found = { docNode: node, declaration: node, sourceFile, code, filePath }
            return
        } else if (ts.isExportDeclaration(node)) {
            // 解析 export { ps4 } from "./ps4"
            if (
                node.exportClause &&
                ts.isNamedExports(node.exportClause) &&
                node.moduleSpecifier &&
                ts.isStringLiteral(node.moduleSpecifier)
            ) {
                for (const element of node.exportClause.elements) {
                    if (element.name.text === symbolName) {
                        state.reExportInfo = {
                            originalName: element.propertyName ? element.propertyName.text : symbolName,
                            modulePath: node.moduleSpecifier.text,
                        }
                        return
                    }
                }
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    if (state.found) {
        return state.found
    }

    if (state.reExportInfo && filePath) {
        const dir = path.dirname(filePath)
        const targetFilePath = resolveModuleFilePath(dir, state.reExportInfo.modulePath)
        if (targetFilePath) {
            try {
                const targetCode = fs.readFileSync(targetFilePath, "utf-8")
                const targetSourceFile = ts.createSourceFile(
                    targetFilePath,
                    targetCode,
                    ts.ScriptTarget.Latest,
                    true,
                )
                // 递归查找，注意要找的 symbol 名字在目标文件中可能是 originalName
                return findSymbolMatch(targetSourceFile, state.reExportInfo.originalName, targetCode, targetFilePath)
            } catch (err) {
                console.warn(`[Starmap] 读取重导出文件失败: ${targetFilePath}`, err)
            }
        }
    }

    return null
}

/** 在 AST 中查找指定 symbol 的声明（支持点路径）
 *
 * @param sourceFile TypeScript 源码 AST
 * @param symbolName 要查找的 symbol 名称，例如 "BASE64.decode"
 */
function findSymbolMatch(
    sourceFile: ts.SourceFile,
    symbolName: string,
    code: string,
    filePath?: string,
): SymbolMatch | null {
    const parts = symbolName.split(".")
    const rootName = parts[0]
    const rootMatch = findSymbolMatchInternal(sourceFile, rootName, code, filePath)
    if (!rootMatch) {
        return null
    }

    let currentMatch = rootMatch
    for (let i = 1; i < parts.length; i++) {
        const partName = parts[i]
        const childMatch = findChildMatch(currentMatch, partName)
        if (!childMatch) {
            return null
        }
        currentMatch = childMatch
    }

    return currentMatch
}

/** 判断节点是否是目标命名声明
 *
 * @param node 当前 AST 节点
 * @param symbolName 要匹配的 symbol 名称
 */
function isNamedDeclaration(node: ts.Node, symbolName: string): node is ts.Declaration & { name: ts.Identifier } {
    if (
        !(
            ts.isFunctionDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isEnumDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isPropertyDeclaration(node)
        )
    ) {
        return false
    }

    return !!node.name && ts.isIdentifier(node.name) && node.name.text === symbolName
}

/** 提取声明节点上的文档内容
 *
 * @param node 声明节点
 * @param sourceFile TypeScript 源码 AST
 * @param code 原始源码
 */
function getDocParts(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    code: string,
    ignoreFirstLine: boolean,
): { description: string; paramComments: Map<string, string>; returnComment: string; examples: string[] } {
    const jsDocs = getJsDocs(node)
    const paramComments = new Map<string, string>()
    const examples: string[] = []
    let returnComment = ""

    if (jsDocs.length > 0) {
        const description = jsDocs
            .map((doc) =>
                cleanLeadingComment(code.slice(doc.pos, doc.end), {
                    ignoreFirstLine: ignoreFirstLine,
                    stopAtTags: true,
                }),
            )
            .filter(Boolean)
            .join("\n\n")

        for (const doc of jsDocs) {
            doc.tags?.forEach((tag) => {
                if (tag.tagName && tag.tagName.text === "example") {
                    const exampleComment = renderJSDocComment(tag.comment, sourceFile)
                    if (exampleComment) {
                        examples.push(exampleComment)
                    }
                    return
                }
                if (!ts.isJSDocParameterTag(tag)) {
                    if (ts.isJSDocReturnTag(tag)) {
                        returnComment = renderJSDocComment(tag.comment, sourceFile)
                    }
                    return
                }
                paramComments.set(tag.name.getText(sourceFile), renderJSDocComment(tag.comment, sourceFile))
            })
        }

        return { description, paramComments, returnComment, examples }
    }

    return {
        description: getLeadingComments(code, node.getFullStart(), {
            ignoreFirstLine: ignoreFirstLine,
            stopAtTags: false,
        })
            .filter(Boolean)
            .join("\n\n"),
        paramComments,
        returnComment,
        examples,
    }
}

/** 读取节点的 JSDoc 列表
 *
 * @param node 声明节点
 */
function getJsDocs(node: ts.Node): ts.JSDoc[] {
    return ((node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc || []).filter(ts.isJSDoc)
}

/** 渲染 JSDoc 文本片段
 *
 * @param comment JSDoc 注释内容
 * @param sourceFile TypeScript 源码 AST
 */
function renderJSDocComment(
    comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
    sourceFile: ts.SourceFile,
): string {
    if (!comment) {
        return ""
    }

    if (typeof comment === "string") {
        return comment.trim()
    }

    return comment
        .map((part) => {
            const maybeText = (part as ts.JSDocComment & { text?: string }).text
            return maybeText || part.getText(sourceFile)
        })
        .join("")
        .trim()
}

/** 清理普通行注释或块注释
 *
 * @param code 原始源码
 * @param pos 节点起始位置
 */
function getLeadingComments(
    code: string,
    pos: number,
    options: { ignoreFirstLine: boolean; stopAtTags: boolean },
): string[] {
    const ranges = ts.getLeadingCommentRanges(code, pos) || []
    const rawComments = ranges.map((range) => code.slice(range.pos, range.end))

    if (rawComments.length > 0 && rawComments.every((comment) => comment.trimStart().startsWith("//"))) {
        return [cleanLeadingComment(rawComments.join("\n"), options)]
    }

    return rawComments.map((comment) => cleanLeadingComment(comment, options))
}

/** 清理普通行注释或块注释
 *
 * @param raw 原始注释内容
 * @param options 注释清理选项
 */
function cleanLeadingComment(
    raw: string,
    options: { ignoreFirstLine: boolean; stopAtTags: boolean },
): string {
    if (!raw) {
        return ""
    }

    if (raw.trimStart().startsWith("//")) {
        return normalizeCommentLines(
            raw
                .split("\n")
                .map((line) => line.replace(/^\s*\/\/\s?/, "")),
            options,
        )
    }

    const lines = raw
        .replace(/^\/\*\*?/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, ""))

    return normalizeCommentLines(lines, options)
}

/** 按文档展示规则处理注释行
 *
 * @param lines 已移除注释符号的内容行
 * @param options 注释清理选项
 */
function normalizeCommentLines(lines: string[], options: { ignoreFirstLine: boolean; stopAtTags: boolean }): string {
    let normalizedLines = trimEmptyEdgeLines(lines)

    if (options.stopAtTags) {
        const tagIndex = normalizedLines.findIndex((line) => /^@\w+/.test(line.trimStart()))
        if (tagIndex >= 0) {
            normalizedLines = normalizedLines.slice(0, tagIndex)
        }
    }

    normalizedLines = trimEmptyEdgeLines(normalizedLines)

    if (options.ignoreFirstLine) {
        normalizedLines = normalizedLines.slice(1)
    }

    return trimCommentTextEdges(trimEmptyEdgeLines(normalizedLines)).join("\n")
}

/** 移除注释块首尾由语法带来的空行，保留正文内部换行
 *
 * @param lines 注释内容行
 */
function trimEmptyEdgeLines(lines: string[]): string[] {
    let start = 0
    let end = lines.length

    while (start < end && lines[start].trim() === "") {
        start += 1
    }

    while (end > start && lines[end - 1].trim() === "") {
        end -= 1
    }

    return lines.slice(start, end)
}

/** 裁剪注释正文首尾空白，保留正文内部的原始换行
 *
 * @param lines 注释内容行
 */
function trimCommentTextEdges(lines: string[]): string[] {
    if (lines.length === 0) {
        return lines
    }

    const result = [...lines]
    result[0] = result[0].trimStart()
    result[result.length - 1] = result[result.length - 1].trimEnd()
    return result
}

/** 提取声明中的参数文档
 *
 * @param declaration symbol 对应的声明节点
 * @param context 文档解析上下文
 */
function getParamDocs(declaration: ts.Node, context: ParseContext): ParamDoc[] {
    const functionLike = getFunctionLike(declaration)

    if (!functionLike) {
        return []
    }

    return functionLike.parameters
        .filter((param) => param.name.getText(context.sourceFile) !== "this")
        .map((param) => {
            const name = param.name.getText(context.sourceFile)
            return {
                name,
                type: renderParamType(param.type, context.sourceFile),
                description: getParamComment(param, name, context),
                children: getObjectParamChildren(param.type, name, context, new Set()),
            }
        })
}

/** 读取参数说明，优先使用函数 JSDoc 的 @param，其次使用参数节点自身的 JSDoc
 *
 * @param param 参数声明节点
 * @param name 参数名
 * @param context 文档解析上下文
 */
function getParamComment(param: ts.ParameterDeclaration, name: string, context: ParseContext): string {
    const taggedComment = context.paramComments.get(name)
    if (taggedComment) {
        return taggedComment
    }

    const jsDocs = getJsDocs(param)
    const jsDocComment = jsDocs
        .map((doc) =>
            cleanLeadingComment(context.code.slice(doc.pos, doc.end), {
                ignoreFirstLine: false,
                stopAtTags: true,
            }),
        )
        .filter(Boolean)
        .join("\n\n")

    if (jsDocComment) {
        return jsDocComment
    }

    return getLeadingComments(context.code, param.getFullStart(), {
        ignoreFirstLine: false,
        stopAtTags: true,
    })
        .filter(Boolean)
        .join("\n\n")
}

/** 提取声明中的返回值文档
 *
 * @param declaration symbol 对应的声明节点
 * @param context 文档解析上下文
 */
function getReturnDoc(declaration: ts.Node, context: ParseContext): ReturnDoc | null {
    const functionLike = getFunctionLike(declaration)

    if (!functionLike || ts.isConstructorDeclaration(functionLike)) {
        return null
    }

    const type = renderReturnType(functionLike, context.sourceFile)
    if (!type && !context.returnComment) {
        return null
    }

    return {
        type: type || "unknown",
        description: context.returnComment,
        children: functionLike.type ? getReturnChildren(functionLike.type, context) : [],
    }
}

/** 解析返回值对象的下一层属性
 *
 * @param typeNode 返回值类型节点
 * @param context 文档解析上下文
 */
function getReturnChildren(typeNode: ts.TypeNode, context: ParseContext): ParamDoc[] {
    const unwrappedTypeNode = unwrapReturnTypeNode(typeNode, context.sourceFile)
    return getObjectParamChildren(unwrappedTypeNode, "return", context, new Set())
}

/** 解开返回值包装类型
 *
 * @param typeNode 返回值类型节点
 * @param sourceFile TypeScript 源码 AST
 */
function unwrapReturnTypeNode(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): ts.TypeNode {
    if (
        ts.isTypeReferenceNode(typeNode) &&
        typeNode.typeName.getText(sourceFile) === "Promise" &&
        typeNode.typeArguments?.length
    ) {
        return typeNode.typeArguments[0]
    }

    return typeNode
}

/** 渲染函数返回值类型
 *
 * @param declaration 函数类声明节点
 * @param sourceFile TypeScript 源码 AST
 */
function renderReturnType(declaration: ts.SignatureDeclarationBase, sourceFile: ts.SourceFile): string {
    if (declaration.type) {
        return renderParamType(declaration.type, sourceFile)
    }

    if (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) {
        return "unknown"
    }

    return ""
}

/** 从不同声明形态中找出可分析参数的函数节点
 *
 * @param declaration symbol 对应的声明节点
 */
function getFunctionLike(declaration: ts.Node): ts.SignatureDeclarationBase | null {
    if (
        ts.isFunctionDeclaration(declaration) ||
        ts.isMethodDeclaration(declaration) ||
        ts.isFunctionExpression(declaration) ||
        ts.isArrowFunction(declaration) ||
        ts.isConstructorDeclaration(declaration)
    ) {
        return declaration
    }

    if (ts.isVariableDeclaration(declaration)) {
        if (
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
            return declaration.initializer
        }

        if (declaration.type && ts.isFunctionTypeNode(declaration.type)) {
            return declaration.type
        }
    }

    if (
        ts.isPropertyAssignment(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isPropertySignature(declaration)
    ) {
        if (
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
            return declaration.initializer
        }

        if (declaration.type && ts.isFunctionTypeNode(declaration.type)) {
            return declaration.type
        }
    }

    if (ts.isClassDeclaration(declaration)) {
        return declaration.members.find(ts.isConstructorDeclaration) || null
    }

    return null
}

/** 渲染参数类型，交叉类型会拆成多行方便阅读
 *
 * @param typeNode 参数类型节点
 * @param sourceFile TypeScript 源码 AST
 */
function renderParamType(typeNode: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string {
    if (!typeNode) {
        return "unknown"
    }

    if (ts.isTypeLiteralNode(typeNode)) {
        return "object"
    }

    if (ts.isIntersectionTypeNode(typeNode)) {
        return typeNode.types.map((type) => renderParamType(type, sourceFile)).join("<br>")
    }

    return typeNode.getText(sourceFile)
}

/** 解析对象参数的下一层属性
 *
 * @param typeNode 参数类型节点
 * @param parentName 参数名
 * @param context 文档解析上下文
 * @param visitedTypes 已解析过的命名类型，防止递归引用
 */
function getObjectParamChildren(
    typeNode: ts.TypeNode | undefined,
    parentName: string,
    context: ParseContext,
    visitedTypes: Set<string>,
): ParamDoc[] {
    if (!typeNode) {
        return []
    }

    const members = collectObjectMembers(typeNode, context, visitedTypes)
    return members.flatMap((member) => {
        if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
            return []
        }

        const lookupName = getMemberName(member, context.sourceFile)
        if (!lookupName) {
            return []
        }

        const displayName = member.questionToken ? `${lookupName}?` : lookupName
        const fullName = `${parentName}.${lookupName}`

        return [
            {
                name: `${parentName}.${displayName}`,
                type: renderMemberType(member, context.sourceFile),
                description: context.paramComments.get(fullName) || getMemberComment(member, context.sourceFile),
                children: [],
            },
        ]
    })
}

/** 收集类型节点中的对象成员
 *
 * @param typeNode 类型节点
 * @param context 文档解析上下文
 * @param visitedTypes 已解析过的命名类型，防止递归引用
 */
function collectObjectMembers(
    typeNode: ts.TypeNode,
    context: ParseContext,
    visitedTypes: Set<string>,
): ts.TypeElement[] {
    if (ts.isTypeLiteralNode(typeNode)) {
        return [...typeNode.members]
    }

    if (ts.isIntersectionTypeNode(typeNode)) {
        return typeNode.types.flatMap((type) => collectObjectMembers(type, context, visitedTypes))
    }

    if (ts.isParenthesizedTypeNode(typeNode)) {
        return collectObjectMembers(typeNode.type, context, visitedTypes)
    }

    if (ts.isTypeReferenceNode(typeNode)) {
        return collectTypeReferenceMembers(typeNode, context, visitedTypes)
    }

    return []
}

/** 收集命名 type/interface 引用中的对象成员
 *
 * @param typeNode 类型引用节点
 * @param context 文档解析上下文
 * @param visitedTypes 已解析过的命名类型，防止递归引用
 */
function collectTypeReferenceMembers(
    typeNode: ts.TypeReferenceNode,
    context: ParseContext,
    visitedTypes: Set<string>,
): ts.TypeElement[] {
    return collectNamedTypeMembers(typeNode.typeName.getText(context.sourceFile), context, visitedTypes)
}

/** 按类型名称收集 type/interface 的对象成员
 *
 * @param typeName 类型名称
 * @param context 文档解析上下文
 * @param visitedTypes 已解析过的命名类型，防止递归引用
 */
function collectNamedTypeMembers(typeName: string, context: ParseContext, visitedTypes: Set<string>): ts.TypeElement[] {
    if (visitedTypes.has(typeName)) {
        return []
    }

    const declaration = context.typeIndex.get(typeName)
    if (!declaration) {
        return []
    }

    const nextVisitedTypes = new Set(visitedTypes)
    nextVisitedTypes.add(typeName)

    if (ts.isInterfaceDeclaration(declaration)) {
        const ownMembers = [...declaration.members]
        const inheritedMembers =
            declaration.heritageClauses?.flatMap((clause) => {
                return clause.types.flatMap((heritageType) => {
                    return collectNamedTypeMembers(
                        heritageType.expression.getText(context.sourceFile),
                        context,
                        nextVisitedTypes,
                    )
                })
            }) || []

        return [...inheritedMembers, ...ownMembers]
    }

    return collectObjectMembers(declaration.type, context, nextVisitedTypes)
}

/** 获取对象属性名
 *
 * @param member 对象类型成员
 * @param sourceFile TypeScript 源码 AST
 */
function getMemberName(member: ts.PropertySignature | ts.MethodSignature, sourceFile: ts.SourceFile): string {
    return member.name.getText(sourceFile)
}

/** 渲染对象成员类型
 *
 * @param member 对象类型成员
 * @param sourceFile TypeScript 源码 AST
 */
function renderMemberType(member: ts.PropertySignature | ts.MethodSignature, sourceFile: ts.SourceFile): string {
    if (ts.isMethodSignature(member)) {
        const params = member.parameters.map((param) => param.getText(sourceFile)).join(", ")
        const returnType = member.type ? member.type.getText(sourceFile) : "void"
        return `(${params}) => ${returnType}`
    }

    return renderParamType(member.type, sourceFile)
}

/** 获取对象属性注释
 *
 * @param member 对象类型成员
 * @param sourceFile TypeScript 源码 AST
 */
function getMemberComment(member: ts.PropertySignature | ts.MethodSignature, sourceFile: ts.SourceFile): string {
    return getJsDocs(member)
        .map((doc) => renderJSDocComment(doc.comment, sourceFile))
        .filter(Boolean)
        .join("\n\n")
}

/** 渲染参数列表组件
 *
 * @param params 参数文档列表
 * @param returnDoc 返回值文档
 */
function renderParamsComponent(params: ParamDoc[], returnDoc: ReturnDoc | null): string {
    const returnsAttr = returnDoc ? ` returns-json="${escapeHtmlAttribute(JSON.stringify(returnDoc))}"` : ""
    return `<StarmapDocParams params-json="${escapeHtmlAttribute(JSON.stringify(params))}"${returnsAttr} />`
}

/** 转义 HTML 属性内容
 *
 * @param value 原始文本
 */
function escapeHtmlAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * 在物理文件系统中定位重导出模块的文件路径
 */
function resolveModuleFilePath(dir: string, modulePath: string): string | null {
    const extensions = [".ts", ".tsx", ".d.ts", ".js", ".jsx"]
    const directPath = path.resolve(dir, modulePath)

    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return directPath
    }

    for (const ext of extensions) {
        const fullPath = directPath + ext
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return fullPath
        }
    }

    for (const ext of extensions) {
        const indexPath = path.join(directPath, "index" + ext)
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
            return indexPath
        }
    }

    return null
}
