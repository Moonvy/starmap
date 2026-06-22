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

    [key: string]: any
}
