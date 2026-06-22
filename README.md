# 🌟 Starmap | 星图

> **代码库即文档** —— 专为现代化组件库与工程文档设计的可视化组织和预览工具。

Starmap（星图）能够智能扫描项目目录，通过 `README.md` 将零散的代码文件夹转化为层次分明的“代码单元（CodeUnit）”。它不仅提供极其精致的前端文档预览界面（支持深色模式、可拉伸侧边栏、交互式目录 TOC），还支持 Vue 组件的活页预览、自动 API 文档提取、Markdown 动态交互控件以及极速的热更新（HMR）监控，可一键编译为静态站点进行托管。

---

## ✨ 核心特性

- **📂 自动文件树组织**：智能递归扫描 `readme.md` / `README.md` 生成清晰的树状文件目录。
- **🧩 组件即文档 / Live Playground**：自动检测对应目录下的主组件（Vue、index.ts 等），并在文档中进行直接渲染和活页预览，使代码与文档完美融合。
- **📊 自动 API 提取**：自动提取并生成 Vue 组件的 `Props`、`Events`、`Slots` 说明表格，支持 JSDoc 注释（如 `@values`、`@property` 等）解析。
- **🎛️ Markdown 动态交互控件**：允许在 Markdown 内直接使用内置组件（`<StarmapSelect>`、`<StarmapCheckbox>`、`<StarmapInput>`），无需编写任何 Vue 模板即可实现实时的 `v-model` 双向数据绑定。
- **📦 强悍的 `@import` 语法**：
    - 支持从外部文件导入代码块并启用实时组件预览（`@preview`）。
    - 支持提取指定 Symbol 内容（`@only=SymbolName`）。
    - 支持将 Symbol 注释自动转换为文档表格（`@doc=FunctionName`）。
- **⚡ 极速 Watch 监控与静态构建**：基于高性能 `@parcel/watcher`，热更新仅对受影响的文件进行极速增量重构；同时支持 `build` 命令一键生成全静态部署网页（完美契合 GitHub Pages）。

---

## 🚀 快速上手

### 1. 安装依赖

在项目根目录中添加 Starmap：

```bash
bun add -d @moonvy/starmap
```

### 2. 配置 package.json

在宿主项目的 `package.json` 中配置开发与构建脚本：

```json
{
    "scripts": {
        "starmap:dev": "starmap",
        "starmap:build": "starmap build --buildDir=./docs"
    }
}
```

### 3. 创建第一个代码单元

在项目的任意文件夹中，创建一个 `README.md`：

```markdown
---
title: 按钮组件
icon: ri-play-circle-line
sort: 1
---

# Button 按钮 | 交互基座

这是我们项目的基础按钮组件。

## 实时预览

@import "./Button.vue" @preview @file

## API 文档

<StarmapVueDoc />
```

如果该目录下存在 `Button.vue`，运行 `starmap` 后，将自动看到可运行的按钮演示和自动生成的 API 属性表格！

---

## 🛠️ 命令行参数 (CLI)

### 开发模式 (`starmap [srcDir]`)

启动具有 HMR 的 Vite 开发服务器。

```bash
bun x starmap [srcDir] [options]
```

- `srcDir`：要扫描的项目根目录，默认为 `.`
- `--port <port>`：指定开发服务器端口（默认 `4070`）
- `--rebuild`：清空缓存并强制完整重建
- `--outputDir <path>`：临时构建目录，默认输出到 `node_modules/.starmap`

### 静态构建 (`starmap build [srcDir]`)

将文档站点编译为无外部服务依赖的纯静态网页。

```bash
bun x starmap build [srcDir] [options]
```

- `srcDir`：项目根目录，默认为 `.`
- `--buildDir <path>`：静态文件输出目录（默认输出到宿主项目下的 `dist` 目录）
- `--rebuild`：强制完整重建
- `--outputDir <path>`：临时构建目录

---

## ⚙️ 配置文件 `starmap.config.ts`

Starmap 能够自动读取项目根目录或 `config/` 目录下的 `starmap.config.ts` 配置文件。您可以导入 `IStarmapConfig` 接口以获取全套的 TypeScript 类型提示：

```typescript
import { IStarmapConfig } from "@moonvy/starmap"

export default <IStarmapConfig>{
    // 项目名称，默认会从宿主项目的 package.json 属性中提取
    projectName: "我的组件库",

    // 开发服务器端口
    port: 4070,

    // 构建静态文件的输出路径
    buildDir: "./dist-docs",

    // 是否启用文件改动监控，默认开启
    watch: true,

    // 代码单元树目录是否总是保持 sticky 吸顶效果 (默认 false)
    uiTreeDirAlwaysSticky: false,

    // 自定义 Vite 配置
    viteConfig: {
        // 可以在这里扩展额外的 Vite 插件
    },
}
```

---

## 📝 Markdown 深度扩展语法

### 1. 文档元数据

在文档最顶部指定元数据。除标准 YAML 格式外，亦支持简洁的 JSON 代码块格式：

**YAML 格式：**

```markdown
---
icon: ri-article-fill
sort: 10
id: my-custom-id
---
```

**JSON 代码块格式：**

````markdown
```json metadata
{ "icon": "ri-article-fill", "sort": 10, "id": "my-custom-id" }
```
````

| 元数据字段           | 说明                                                                                                              |
| :------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `id`                 | 自定义当前 CodeUnit 的标识。若不设置，将基于目录相对路径最后 2 级自动生成。                                       |
| `icon` / `iconClass` | 图标名称，完美支持 `@haoduo-icon`（如 `ri:play-circle-line` / `ri-play-circle-line`、`fluent:home-24-regular`）。 |
| `sort`               | 树形目录排序权重，数值越小越靠前（项目根节点默认置顶）。                                                          |

### 2. 代码块高级渲染

可在反引号后追加参数控制渲染行为：

````markdown
```html @preview @title="Demo.vue" @icon="ri:vuejs-line" @line-numbers
<div>Hello Starmap!</div>
```
````

- `@preview`：开启实时效果预览（自动在代码块上方或左侧渲染组件实际效果）。
- `@preview.left` / `@preview.right`：启用代码与预览左右分栏布局。
- `@line-numbers`：开启行号显示，可指定起始值，如 `@line-numbers=10`。
- `@min`：默认以收起状态呈现代码。
- `@full`：取消代码块的最大高度限制（不显示“展开全文”按钮）。
- `@title="..."`：显示代码块右上角的自定义文件名。
- `@icon="..."`：指定右上角展示的文件类型图标。

### 3. 支持 diff 差异高亮

支持在代码行末添加 `// [!code ++]` 或 `// [!code --]` 呈现直观的改动提示：

```ts
const a = 1
const b = 2 // [!code --]
const b = 3 // [!code ++]
```

### 4. 强大的 `@import` 文件导入

无需重复复制粘贴，一键载入其他文件或局部代码：

- **导入并作为 Markdown 渲染**：
    ```markdown
    @import "./sub.md"
    ```
- **导入作为代码块预览**：
    ```markdown
    @import "./Button.vue" @preview @line-numbers @file
    ```
- **仅导入指定 Symbol（如类、接口、函数）**：
    ```markdown
    @import "./types.ts" @only=IButtonProps
    ```
- **导入 Symbol 并提取 JSDoc 参数表格**：
    ```markdown
    @import "./utils.ts" @doc=formatDate
    ```

---

## 🎛️ Markdown 内置交互式控件

Starmap 极具特色地支持在 Markdown 中声明双向绑定的交互式控件，所有状态均在浏览器端保持响应式，特别适合展示多状态的交互型组件。

### 1. 下拉/标签选择框 (StarmapSelect)

```vue
<StarmapSelect
    :list="[
        { id: '1', value: 'small', title: '小尺寸', icon: 'ri:font-size' },
        { id: '2', value: 'large', title: '大尺寸', isDefault: true },
    ]"
    mode="tab"
    v-model="buttonSize"
/>

当前选中尺寸: {{ buttonSize }}
```

### 2. 复选框 (StarmapCheckbox)

```vue
<StarmapCheckbox v-model="isChecked">
  是否启用: {{ isChecked }}
</StarmapCheckbox>
```

### 3. 输入框 (StarmapInput)

```vue
<StarmapInput v-model="searchText" placeholder="输入搜索内容..." />
<StarmapInput number v-model="limitCount" />
```

---

## 🤝 插件与二次开发

Starmap 支持高度客制化的插件体系。内置的 UI 前端即是由 `LibraryVue` 插件渲染。编写新插件非常简单，只需注册事件钩子即可订阅整个生命周期：

```typescript
import { IStarmapExtension } from "@moonvy/starmap"
import { StarmapCoreEvents } from "@moonvy/starmap/events"

export const MyCustomExtension = (): IStarmapExtension => {
    return (core) => {
        // 监听代码单元生成完毕
        core.eventHub.on(StarmapCoreEvents.generateUnit, async ({ codeUnit }) => {
            console.log(`生成代码单元: ${codeUnit.id}`)
        })
    }
}
```
