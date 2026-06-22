import path from "node:path"
import fsex from "fs-extra"
import mustache from "mustache"

import { getLibraryVueRoot } from "../../../utils/packagePath"

const templateCache = new Map<string, string>()
const baseStylePath = path.resolve(getLibraryVueRoot(), "web/template/base-style.css")
const baseStyleText = fsex.readFileSync(baseStylePath, "utf-8")
const starmapAppTsPath = path.resolve(getLibraryVueRoot(), "web/starmap.app.ts")
const homePageVuePath = path.resolve(getLibraryVueRoot(), "web/pages/HomePage.vue")

import { outputFileWithCache } from "../../../utils/fs/outputFileWithCache"

/**
 * 输出模板文件到指定路径，模板文件是在 web/template 目录下的文件
 * 使用 mustache 模板引擎进行简单（`{{ }}`）的数据注入
 * @param templateName 模板文件名
 * @param outputPath 输出文件路径
 * @param injectData 注入到模板中的数据
 */
export function outputTemplate(templateName: string, outputPath: string, injectData?: any) {
    let templateText = templateCache.get(templateName)
    if (!templateText) {
        let templateFilePath = path.resolve(getLibraryVueRoot(), "web/template", templateName)
        templateText = fsex.readFileSync(templateFilePath, "utf-8")
        templateCache.set(templateName, templateText)
    }

    let finText = mustache.render(templateText, {
        BaseStyle: baseStyleText,
        StarmapAppTsPath: starmapAppTsPath,
        HomePageVuePath: homePageVuePath,
        ...injectData,
    })

    outputFileWithCache(outputPath, finText)
}
