import { renderImportDoc } from "../markdownImportDoc"

function getParamsJson(result: string): any[] {
    const match = result.match(/<StarmapDocParams params-json="([^"]+)"/)
    expect(match).not.toBeNull()
    return JSON.parse(
        match![1]
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&"),
    )
}

function getReturnsJson(result: string): any {
    const match = result.match(/returns-json="([^"]+)"/)
    expect(match).not.toBeNull()
    return JSON.parse(
        match![1]
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&"),
    )
}

test("从函数 JSDoc 生成文档和参数表格", () => {
    const source = [
        "/**",
        " * createUser",
        " * 创建用户资料。",
        " *",
        " * @param input 用户输入",
        " * @param options 创建选项",
        " * @returns 创建后的用户资料",
        " */",
        "export function createUser(input: UserInput & AuditFields, options?: CreateOptions): UserProfile {",
        "    return input",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "createUser")

    expect(result).toContain('<div class="starmap-import-doc-comment">')
    expect(result).toContain("创建用户资料。")
    expect(result).not.toContain("createUser")
    expect(result).toContain("<StarmapDocParams")
    expect(getParamsJson(result)).toMatchObject([
        { name: "input", type: "UserInput<br>AuditFields", description: "用户输入" },
        { name: "options", type: "CreateOptions", description: "创建选项" },
    ])
    expect(getReturnsJson(result)).toMatchObject({
        type: "UserProfile",
        description: "创建后的用户资料",
    })
})

test("从箭头函数变量生成参数文档", () => {
    const source = [
        "/**",
        " * saveConfig",
        " * 保存配置。",
        " * @param config 配置对象",
        " */",
        "export const saveConfig = (config: BaseConfig & RuntimeConfig) => {",
        "    return config",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "saveConfig")

    expect(result).toContain("保存配置。")
    expect(getParamsJson(result)).toMatchObject([
        { name: "config", type: "BaseConfig<br>RuntimeConfig", description: "配置对象" },
    ])
})

test("从箭头函数变量生成返回值文档", () => {
    const source = [
        "/**",
        " * getConfig",
        " * 读取配置。",
        " * @returns 当前配置",
        " */",
        "export const getConfig = (): RuntimeConfig => ({})",
    ].join("\n")

    const result = renderImportDoc(source, "getConfig")

    expect(getReturnsJson(result)).toMatchObject({
        type: "RuntimeConfig",
        description: "当前配置",
    })
})

test("展开 Promise 包裹的命名返回值类型", () => {
    const source = [
        "interface ITreeCreateResult {",
        "    /** 新建节点 ID */",
        "    id: string",
        "    /** 是否创建成功 */",
        "    success: boolean",
        "}",
        "",
        "/**",
        " * createTree",
        " * 创建树节点。",
        " * @returns 创建结果",
        " */",
        "export async function createTree(): Promise<ITreeCreateResult> {",
        "    return { id: '1', success: true }",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "createTree")

    expect(getReturnsJson(result)).toMatchObject({
        type: "Promise<ITreeCreateResult>",
        description: "创建结果",
        children: [
            { name: "return.id", type: "string", description: "新建节点 ID" },
            { name: "return.success", type: "boolean", description: "是否创建成功" },
        ],
    })
})

test("从 class 注释生成文档", () => {
    const source = [
        "/**",
        " * StarmapRunner",
        " * 管理星图生成流程。",
        " */",
        "export class StarmapRunner {",
        "    run() {}",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "StarmapRunner")

    expect(result).toBe(
        '<div class="starmap-import-doc-comment"><div class="starmap-import-doc-comment-line">管理星图生成流程。</div></div>',
    )
})

test("主注释忽略首行并保留原始换行", () => {
    const source = [
        "/**",
        " * createRunner",
        " * 第一段说明。",
        " *",
        " * 第二段说明。",
        " */",
        "export class StarmapRunner {",
        "    run() {}",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "StarmapRunner")

    expect(result).toBe(
        '<div class="starmap-import-doc-comment"><div class="starmap-import-doc-comment-line">第一段说明。</div><div class="starmap-import-doc-comment-line is-empty"></div><div class="starmap-import-doc-comment-line">第二段说明。</div></div>',
    )
})

test("支持 JSDoc 起始行直接写主标题", () => {
    const source = [
        "/** 创建节点",
        " *",
        " * 在指定的父节点下批量创建新节点。",
        " * 所有创建的节点都将自动归属到指定的 parentId 下。",
        " *",
        " */",
        "export function createNode() {}",
    ].join("\n")

    const result = renderImportDoc(source, "createNode")

    expect(result).toContain(
        '<div class="starmap-import-doc-comment-line">在指定的父节点下批量创建新节点。</div><div class="starmap-import-doc-comment-line">所有创建的节点都将自动归属到指定的 parentId 下。</div>',
    )
    expect(result).not.toContain("创建节点")
})

test("主注释行内容支持 Markdown inline 语法", () => {
    const source = [
        "/** 创建节点",
        " *",
        " * 使用 `parentId` 创建 **节点**。",
        " */",
        "export function createNode() {}",
    ].join("\n")

    const result = renderImportDoc(source, "createNode")

    expect(result).toContain(
        '<div class="starmap-import-doc-comment-line">使用 <code>parentId</code> 创建 <strong>节点</strong>。</div>',
    )
})

test("从 JSDoc 原始范围解析装饰器声明的主注释", () => {
    const source = [
        "/**",
        " * ignoreTitle",
        " * 装饰器声明正文。",
        " */",
        "@sealed",
        "export class StarmapRunner {",
        "    run() {}",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "StarmapRunner")

    expect(result).toBe(
        '<div class="starmap-import-doc-comment"><div class="starmap-import-doc-comment-line">装饰器声明正文。</div></div>',
    )
})

test("普通行注释也忽略首行并保留换行", () => {
    const source = [
        "// ignoreTitle",
        "// 第一段说明。",
        "//",
        "// 第二段说明。",
        "export class StarmapRunner {",
        "    run() {}",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "StarmapRunner")

    expect(result).toBe(
        '<div class="starmap-import-doc-comment"><div class="starmap-import-doc-comment-line">第一段说明。</div><div class="starmap-import-doc-comment-line is-empty"></div><div class="starmap-import-doc-comment-line">第二段说明。</div></div>',
    )
})

test("从方法注释生成文档和参数表格", () => {
    const source = [
        "export class StarmapRunner {",
        "    /**",
        "     * run",
        "     * 运行指定任务。",
        "     * @param task 任务配置",
        "     */",
        "    run(task: BuildTask & WatchTask) {}",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "run")

    expect(result).toContain("运行指定任务。")
    expect(getParamsJson(result)).toMatchObject([
        { name: "task", type: "BuildTask<br>WatchTask", description: "任务配置" },
    ])
})

test("识别参数节点自身的 JSDoc 注释", () => {
    const source = [
        "/**",
        " * refreshTreeMetadata",
        " * 递归刷新树的元数据",
        " * 从一个文件夹向下递归刷新 metadata 属性，保证 `ctotal`,`cftotal`,`csize` 正确",
        " */",
        "export async function refreshTreeMetadata(",
        "    table: TableTree<ITreeNode>,",
        '    /** 要刷新元数据的文件夹 ID，可以指定为 "/" 来刷新整个树的元数据 */',
        "    parentId: string,",
        "): Promise<void> {",
        "    await refreshChildrenFirst(table, parentId)",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "refreshTreeMetadata")

    expect(getParamsJson(result)).toMatchObject([
        { name: "table", type: "TableTree<ITreeNode>", description: "" },
        {
            name: "parentId",
            type: "string",
            description: '要刷新元数据的文件夹 ID，可以指定为 "/" 来刷新整个树的元数据',
        },
    ])
})

test("过滤 this 参数", () => {
    const source = [
        "/**",
        " * runWithThis",
        " * 绑定运行函数。",
        " * @param this 当前上下文",
        " * @param value 输入值",
        " */",
        "export function runWithThis(this: RunnerContext, value: string) {",
        "    return value",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "runWithThis")

    expect(result).not.toContain("`this`")
    expect(result).not.toContain("RunnerContext")
    expect(getParamsJson(result)).toMatchObject([{ name: "value", type: "string", description: "输入值" }])
})

test("展开对象参数的下一层属性", () => {
    const source = [
        "/**",
        " * createTask",
        " * 创建任务。",
        " * @param options 创建参数",
        " * @param options.name 任务名称",
        " */",
        "export function createTask(options: {",
        "    /** 任务 ID */",
        "    id: string",
        "    name?: string",
        "} & ExtraOptions) {",
        "    return options",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "createTask")

    expect(getParamsJson(result)).toMatchObject([
        {
            name: "options",
            type: "object<br>ExtraOptions",
            description: "创建参数",
            children: [
                { name: "options.id", type: "string", description: "任务 ID" },
                { name: "options.name?", type: "string", description: "任务名称" },
            ],
        },
    ])
})

test("展开命名 interface 参数", () => {
    const source = [
        "interface IBaseTreeOptions {",
        "    /** 是否禁用 */",
        "    disabled?: boolean",
        "}",
        "",
        "interface ITreeNodeOptions {",
        "    /** 节点标题 */",
        "    title: string",
        "}",
        "",
        "interface ITreeCreateNodesOptions extends IBaseTreeOptions {",
        "    /** 节点列表 */",
        "    nodes: ITreeNodeOptions[]",
        "    /** 根节点 */",
        "    root?: ITreeNodeOptions",
        "}",
        "",
        "/**",
        " * createTreeNodes",
        " * 创建树节点。",
        " * @param options 创建参数",
        " * @param options.root 根节点配置",
        " */",
        "export function createTreeNodes(options: ITreeCreateNodesOptions) {",
        "    return options",
        "}",
    ].join("\n")

    const result = renderImportDoc(source, "createTreeNodes")

    expect(getParamsJson(result)).toMatchObject([
        {
            name: "options",
            type: "ITreeCreateNodesOptions",
            description: "创建参数",
            children: [
                { name: "options.disabled?", type: "boolean", description: "是否禁用" },
                { name: "options.nodes", type: "ITreeNodeOptions[]", description: "节点列表" },
                { name: "options.root?", type: "ITreeNodeOptions", description: "根节点配置", children: [] },
            ],
        },
    ])
    expect(JSON.stringify(getParamsJson(result))).not.toContain("options.root.title")
})

test("展开命名 type 里的对象和 interface 交叉类型", () => {
    const source = [
        "interface IBaseOptions {",
        "    /** 基础 ID */",
        "    id: string",
        "}",
        "",
        "type ICreateOptions = IBaseOptions & {",
        "    /** 展示名称 */",
        "    name: string",
        "}",
        "",
        "/**",
        " * createOptions",
        " * 创建配置。",
        " * @param options 配置参数",
        " */",
        "export const createOptions = (options: ICreateOptions) => options",
    ].join("\n")

    const result = renderImportDoc(source, "createOptions")

    expect(getParamsJson(result)).toMatchObject([
        {
            name: "options",
            type: "ICreateOptions",
            description: "配置参数",
            children: [
                { name: "options.id", type: "string", description: "基础 ID" },
                { name: "options.name", type: "string", description: "展示名称" },
            ],
        },
    ])
})

test("未找到 symbol 时生成警告", () => {
    const result = renderImportDoc("export const ok = true", "missing")

    expect(result).toContain("Doc Import Warning")
    expect(result).toContain("missing")
})
