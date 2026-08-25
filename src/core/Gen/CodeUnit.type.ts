export interface CodeUnitMetadata {
    // ------- 以下字段由 readme 内容解析得到  -------

    /** Readme 标题（第一个一级标题） */
    headTitle?: string
    /** Readme 主标题（headTitle 用 `|` 分割，取第一个部分） */
    headMainTitle?: string
    /** Readme 副标题（headTitle 用 `|` 分割，取剩下的部分） */
    headSubTitle?: string
    /** 图标 haoduoIconPkg 的图标名 */
    icon?: string
    /** 目录树中该文件夹是否初始展开（默认为 true；设置为 false 则初始折叠） */
    expand?: boolean

    [key: string]: any
}

export interface CodeUnitJSON {
    id: string
    dirPath: string
    dirName: string
    readmePath: string
    metadata: CodeUnitMetadata
    parentId: string | null
    isInternalDoc?: boolean
    children?: CodeUnitJSON[]
}

export interface RootMetadata {
    projectName: string
    uiTreeDirAlwaysSticky: boolean
}

