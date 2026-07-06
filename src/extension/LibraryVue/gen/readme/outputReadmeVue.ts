import { CodeUnit } from "../../../../core/Gen/CodeUnit"
import { outputTemplate } from "../../lib/outputTemplate"
import { renderMarkdown } from "../../web/components/MarkdownWrap/renderMarkdown"

import * as path from "node:path"

import { getLibraryVueRoot } from "../../../../utils/packagePath"

const MarkdownComponentsPath = path.join(getLibraryVueRoot(), "web/components/MarkdownWrap/index.ts")

/**
 * 从渲染后的 HTML 中提取所有的 v-model 绑定的变量名，并生成对应的默认值
 * @param html 渲染后的 HTML 字符串
 * @returns 变量名到默认值字符串的映射对象
 */
export function extractVModelVariables(html: string): Record<string, string> {
    const variables: Record<string, string> = {}

    // 正则匹配带有 v-model 的任何标签，如 <StarmapSelect ... v-model="activeA"> 等
    // 捕获组 1 为标签名称，捕获组 2 为标签内的所有属性，捕获组 3 为绑定的变量名称
    const tagRegex = /<([a-zA-Z0-9_-]+)\s+([^>]*v-model(?:\.[a-zA-Z0-9_]+)*\s*=\s*["']([^"']+)["'][^>]*)>/g
    let match
    while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1].toLowerCase()
        const attrs = match[2]
        const varName = match[3]

        // 提取根变量标识符（例如 active.name -> active，items[0] -> items）
        const rootVar = varName.split(/[.\[]/)[0].trim()
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(rootVar)) {
            // 默认初始化值
            let defaultValue = "null"

            if (
                tagName === "starmapcheckbox" ||
                attrs.includes('type="checkbox"') ||
                attrs.includes("type='checkbox'")
            ) {
                defaultValue = "false"
            } else if (tagName === "starmapinput" && (attrs.includes("number") || attrs.includes("v-model.number"))) {
                defaultValue = "0"
            } else if (tagName === "starmapinput" || tagName === "input" || tagName === "textarea") {
                defaultValue = '""'
            }

            // 只有在未定义时才设置默认值，若有更具体的默认值则覆盖 null
            if (variables[rootVar] === undefined || variables[rootVar] === "null") {
                variables[rootVar] = defaultValue
            }
        }
    }
    return variables
}

export async function outputReadmeVue(codeUnit: CodeUnit, outputPath: string) {
    let readmeMarkdown = await codeUnit.readmeFsNode.readMarkdown()
    let {
        html: readmeHtml,
        imports,
        dependencies,
    } = await renderMarkdown(readmeMarkdown.content, {
        filePath: codeUnit.readmeFsNode.fileFullPath,
        removeFirstH1: true,
        codeUnits: codeUnit.gen?.allUnits?.flat,
    })
    codeUnit.readmeImportDependencyPaths = dependencies || []

    const vModelVariables = extractVModelVariables(readmeHtml)
    const vModelVariablesList = Object.entries(vModelVariables).map(([name, defaultValue]) => {
        return { name, defaultValue }
    })

    outputTemplate("readme.vue.hbs", outputPath, {
        codeUnit,
        readmeHtml,
        imports,
        MarkdownComponentsPath,
        vModelVariablesList,
    })
}
