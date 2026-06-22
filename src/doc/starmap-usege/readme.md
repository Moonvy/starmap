---
icon: ri-book-2-fill
---

# Starmap 使用手册

## 使用方法

```json @title=package.json @icon=ri-file-code-fill
"scripts": {
    "dev": "starmap", // [!code ++]
    "dev:rebuild": "starmap --rebuild " // [!code ++]
}
```

### 配置文件 `starmap.config.ts`

在项目的根目录或者 `config` 文件夹下可以创建 `starmap.config.ts` 文件来配置 Starmap，使用 `IStarmapConfig` 接口可以获得类型提示

@import "../../../src/config.type.ts" @file

### 文档元数据

在 markdown 文档的 YAML 头部可以添加文档元数据，Starmap 会把它们展示在文档的侧边栏中

```md
---
icon: ri-article-fill
sort: 10
---
```

文档开头的元数据，除了可以使用 YAML 语法外，还可以使用 JSON 语法：

````md
```json metadata
{ "icon": "ri-palette-fill", "sort": 10 }
```
````

| 参数   | 描述                                 |
| ------ | ------------------------------------ |
| `icon` | 文档图标，支持 Remix Icon 的图标类名 |
| `sort` | 文档排序，数值越小越靠前             |

### Vue 组件代码即文档

如果文档所属的是 Vue 组件， 使用 `<StarmapVueDoc/>` 插入到 markdown 文档中，组件会自动把 Vue 组件的 Props、Events、Slots 数据展示出来

```js
props: {
    /** 使用 @values 可以指定可选值，文档会把它们展示出来
     * @values small, normal, large */
    size: {
        type: String
    }
}

/**
 * 使用 @property 可以指定事件参数，文档会把它们展示出来
 * @property {number} newValue new value set
 * @property {number} oldValue value that was set before the change
 */
this.$emit("change", newValue, oldValue)
```

## 标题

使用 `#` 创建不同级别的标题

```md @preview
## h2 标题

### h3 标题

#### h4 标题
```

### 标题链接自定义

默认情况下，Starmap 会根据标题文本自动生成锚点 ID，但可以用 `{#custom-id}` 语法紧跟标题来指定锚点 ID

```md @preview
## 这是一个标题 {#my-custom-anchor}
```

## 文本装饰

| 语法                     | 示例                   |
| ------------------------ | ---------------------- |
| `**Bold**`               | **加粗**               |
| `_Italic_`               | _斜体。_               |
| `~Strikethrough~`        | ~~删除线。~~           |
| `<sup>Superscript</sup>` | Example<sup>上标</sup> |
| `<sub>Subscript</sub>`   | Example<sub>下标</sub> |

## 链接

```markdown @preview
[帮助链接](/units/starmap-usege)
```

## 分隔符

`---`

---

## 折叠

```markdown @preview
<details>
<summary>Click to expand</summary>

This content is hidden by default.

</details>
```

## 按键块

```md @preview
<kbd>Ctrl</kbd>
<kbd>Ctrl+C</kbd>
```

## 列表

```md @preview.left
- apple
- banana
- orange
    - A is Title
    - B is another Title
    - C is another Title
        - D is another Title
        - E is another Title
```

```md @preview.left
1. 项目 1
2. 项目 2
    1. 子项目 2
    1. 子项目 3
3. 项目 3
```

## 图片

`![图片描述](图片链接)`

图片的描述会自动在图片下显示。

图片可以使用 Obsidian 格式的尺寸指定语法 `![描述|WIDTHxHEIGHT](src)`

```md
![指定宽度|64x0](./assets/test.webp)
![这张图片](./assets/test.webp)
![](./assets/test.webp)
```

![指定宽度|64x0](./assets/test.webp)
![这张图片](./assets/test.webp)

## 引用

```md @preview
> **引用文本**  
> 一段段文本
```

## 提示框

```md @preview
> [!NOTE]
> 强调用户在快速浏览文档时也不应忽略的重要信息。
```

```md @preview
> [!TIP]
> 有助于用户更顺利达成目标的建议性信息。
```

```md @preview
> [!IMPORTANT]
> 对用户达成目标至关重要的信息。
```

```md @preview
> [!WARNING]
> 因为可能存在风险，所以需要用户立即关注的关键内容。
```

```md @preview
> [!CAUTION]
> 行为可能带来的负面影响。
```

## 表格

```md @preview
| Tables        |      Are      |  Cool |
| ------------- | :-----------: | ----: |
| col 3 is      | right-aligned | $1600 |
| col 2 is      |   centered    |   $12 |
| zebra stripes |   are neat    |    $1 |
```

```md @preview
| 表格头        | Are           | Cool  |
| ------------- | ------------- | ----- |
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      | $12   |
| zebra stripes | are neat      | $1    |
```

```md @preview
| Option | Description                                                               |
| :----- | :------------------------------------------------------------------------ |
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default.    |
| ext    | extension to be used for dest files.                                      |
```

## 代码

### 行内代码

使用双反引号 <code>`</code> 包裹行内代码，例如：

```md
示例文本 `npm install`
```

### 代码块

使用三个反引号 <code>```</code> 包裹代码块，并在第一个反引号后指定语言，例如：

````md
```js
console.log("Hello, World!")
```
````

### 代码预览

在代码块后面加上 `@preview` 可以把代码以预览模式显示

````md
```html @preview
<div>
    <h1>Hello, World!</h1>
</div>
```
````

```html @preview
<div>
    <h1>Hello, World!</h1>
</div>
```

### 代码预览左右布局

使用 `left`, `right` 参数可以代码预览左右布局

````md
```html @preview.left
<div>
    <h1>Hello, World!</h1>
</div>
```
````

```html @preview.left
<div>
    <h1>Hello, World!</h1>
</div>
```

### 代码块高度限制

代码预览高度是有最大限制，超过后会收起，需要手动展开

可以使用 `@full` 参数让代码不收起

```css line-numbers
/* 表格 */
.starmap-markdown-render {
    /* 单线风格 */
    table {
        border-collapse: separate; /* 必须设置为 separate */
        border-spacing: 0; /* 消除单元格间距 */
        border: 1px solid var(--md-table-border-color);
        overflow: hidden;
        border-radius: 8px;
        width: 100%;
        line-height: 2em;
        margin-top: 1em;
        margin-bottom: 1em;
        color: var(--md-text-color);
    }

    thead {
        font-size: 0.875em;
        font-weight: 400;
        color: var(--md-table-head-text-color);
        tr {
            border: 0 solid var(--md-table-head-border-color);
            border-bottom-width: 1px;
            background-color: var(--md-table-head-bk-color);
        }
        th {
            text-align: left;
            font-weight: 500;
            background-color: var(--md-table-head-bk);
        }
    }

    tbody tr {
        font-size: 1em;
    }

    th,
    td {
        border: none;
        padding: 0.125em 1em;
        border: 0 solid var(--md-table-row-border-color);
        border-bottom-width: 1px;
    }

    tr:last-child td {
        border-bottom: none;
    }
}

/* 行内标记 */
.starmap-markdown-render {
    --md-kbd-border-color: #a4a4a6;
    --md-kbd-text-color: #555556;
    --md-kbd-bk-color: #f8fafc;

    kbd {
        font-family: var(--md-code-font);
        background-color: var(--md-kbd-bk-color);
        color: var(--md-kbd-text-color);
        padding: 0.125em 0.5em;
        border-radius: 4px;
        font-size: 0.875em;
        border: 1px solid var(--md-kbd-border-color);
        text-shadow:
            0 1px 0 #ffffff96,
            0 -1px 0 #ffffffd1;
        box-shadow:
            0 2px 1px #bfcde691,
            0 2px 3px #616b7c00;
        margin: 0.25em;
    }
}

/* 代码块 */
.starmap-markdown-render .code-warp-box {
    --md-code-bk-color: rgb(245 246 252);
    display: flex;
    position: relative;
    margin-top: 1em;
    border-radius: 12px;
    overflow: hidden;
    box-sizing: border-box;

    .code-lang-display {
        color: rgba(118, 130, 159, 0.74);
        text-shadow: 0 1px rgba(255, 255, 255, 0.38);
        background: rgba(213, 221, 239, 0.5);
        border-radius: 0 0 0 8px;
        padding: 4px 14px;
        font-family: monospace;
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0;
        position: absolute;
        top: 0;
        right: 0px;
        z-index: 1;
    }

    pre.shiki {
        position: relative;
        flex: auto;
        padding: 1.25em 1.5em;
        margin: 0;
        overflow-x: auto;
        font-family: var(--md-code-font);
        font-size: 0.9em;
        line-height: 1.6;
        background-color: var(--md-code-bk-color) !important;

        code {
            padding: 0;
            background: none;
            color: inherit;
            font-size: inherit;
            border-radius: 0;
        }

        /* 滚动条 */
        &::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            background: #d5d6dd;
            border-radius: 4px;
        }
        &::-webkit-scrollbar-thumb:hover {
            background: #c9cbd5;
        }
    }
}

/* 代码块行高亮 */
.starmap-markdown-render .code-warp-box {
    pre.shiki {
        /* 高亮行：浅蓝底色 + 左侧色条 */
        .line.highlighted {
            background-color: rgba(101, 117, 255, 0.08);
            border-left: 3px solid rgba(101, 117, 255, 0.65);
            margin-left: -1.5em;
            padding-left: calc(1.5em - 3px);
            margin-right: -1.5em;
            padding-right: 1.5em;
            display: inline-block;
            width: calc(100% + 3em);
            box-sizing: border-box;
        }

        /* 暗淡行：其余行降低不透明度 */
        .line.dim {
            opacity: 0.45;
            transition: opacity 0.2s;
        }

        /* 鼠标悬停时恢复暗淡行透明度 */
        &:hover .line.dim {
            opacity: 0.7;
        }
    }
}

/* 代码块行号 */
.starmap-markdown-render .code-warp-box {
    pre.shiki.has-line-numbers {
        /* 为行号预留左侧空间 */
        padding-left: 3.5em;

        .line {
            position: relative;

            /* 使用 CSS counter 生成行号，不需要额外 DOM 元素 */
            &::before {
                counter-increment: line-number;
                content: counter(line-number);

                position: absolute;
                left: -3em;
                width: 2.5em;
                text-align: right;
                color: rgba(120, 130, 155, 0.6);
                font-size: 0.8em;
                line-height: 2em;
                user-select: none;
                pointer-events: none;
            }
        }

        /* 当行同时高亮时，行号左侧色条的偏移需要配合 */
        .line.highlighted {
            margin-left: -3.5em;
            padding-left: calc(3.5em - 3px);
            width: calc(100% + 3.5em + 1.5em);
        }
    }
}
```

使用 `@min` 可以代码块最小化显示，默认是展开显示。

```html @preview @min @title="App.vue" @icon="ri:vuejs-line"
<div>
    <h1>Hello, World!</h1>
</div>
```

### 显示代码标题和图标

使用 `@title` 参数可以设置标题，使用 `@icon` 参数可以设置图标。

```md
@title="App.vue" @icon="ri:vuejs-line"
```

```html @preview @title="App.vue" @icon="ri:vuejs-line"
<div>
    <h1>Hello, World!</h1>
</div>
```

### 显示行号

`@line-numbers` 参数可以让代码块显示行号。

用 `@line-numbers=99` 这样的语法指定第一行的序号。

```js @line-numbers=99
// @line-numbers=99
let A = 1
let B = 2
let C = 3
```

### 高亮行

使用 `{3}` 可以让指定行高亮，也可以通过 `{3-5}` 这样的语法指定多行高亮。

```js @line-numbers {3}
// js @line-numbers {3}
export default {
    data() {
        return { msg: "Highlighted!" }
    },
}
```

### 差异

使用 `diff` 语言后可以在行首用 `+` `-` ` `来标记行的增删改。

```diff
+ console.log("hewwo")
- console.log("hello")
console.log("goodbye")
```

如果要对任何语言的代码进行差异标记，可以使用 `// [!code --]`、`// [!code ++]` 注释在行末

```ts
console.log("hewwo") // [!code --]
console.log("hello") // [!code ++]
console.log("goodbye")
```

### 代码块参数

在代码块 ` ``` ` 后紧跟着可以添加参数，第一个参数是语言，
后面可以添加任意参数，参数之间用空格隔开。

| 参数            | 描述                                                |
| --------------- | --------------------------------------------------- |
| `@preview`      | 代码块预览，把代码作为组件渲染出来                  |
| `@preview.left` | 代码块预览水平布局，可选：`left`, `right`           |
| `@line-numbers` | 显示行号 （别名：`:line-numbers`、`line-numbers `） |
| `@full`         | 显示全尺寸代码块（代码块默认是限制高度的）          |
| `@min`          | 最小化显示代码块（完全收起代码块）                  |
| `@title=标题`   | 标题                                                |
| `@icon=icon`    | 标题图标                                            |
| `@file`         | 自动填写文件名和图标（`@import`参数）               |
| `@raw`          | 代码作为组件插入 （`@import`参数）                  |
| `@only=symbol`  | 只展示代码部分内容（根据 symbol 名）                |
| `@doc=symbol`   | 导入指定 symbol 的注释文档，并把函数参数生成表格    |

## 导入代码

可用使用 `@import "path"` 语法从文件导入代码块。

### 导入为 Markdown 内容

导入 `md` 后缀的文件会直接作为 markdown 内容插入

`@import './代码块路径.md'`
@import './sub.md'

### 导入为代码块

`@import './sub.vue'`
@import './sub.vue'

### 导入为预览代码块

`@import './sub.vue' @preview @line-numbers @file`

导入命令可指定参数，与代码块的参数一样，还有额外的 `@file` 参数，使用 `@file` 参数后会读取文件对应扩展名自动设置文件名和图标。

@import './sub.vue' @preview @line-numbers @file

### 导入为组件渲染

`@import './sub.vue' @raw`
@import './sub.vue' @raw

### 仅展示部分代码

使用 `@only` 参数可以只展示代码部分内容，参数值是代码中 symbol 的名称（变量名、函数名）。

`@import './types.ts' @only=ISaveOptions`

### 导入 symbol 文档

使用 `@doc` 参数可以把代码中指定 symbol 的注释导入为 Markdown 文档。如果目标是函数、方法或箭头函数变量，会把参数生成表格；交叉类型参数会拆开显示。

`@import './types.ts' @doc=createSaveOptions`

## 动态控件

Starmap 提供一些自带的组件，可以直接使用，它们的 `v-model` 会被自动处理，如果绑定的变量不存在，会自动创建

在 Markdown 文档中可以使用 <span v-pre>`{{ value }}`</span>语法显示变量的值

如果要直接用双括号，使用 `v-pre` 命令，如 <span v-pre> `<span v-pre>{{ value }}</span>` </span>

### 下拉选择框

```vue
<StarmapSelect
    :list="[
        { id: '1', value: 1, title: '一', icon: 'ri:vuejs-line' },
        { id: '2', value: 2, title: '二', isDefault: true },
    ]"
    v-model="activeA"
/>
```

<StarmapSelect
    :list="[
        { id: '1', value: 1, title: '一', icon: 'ri:vuejs-line' },
        { id: '2', value: 2, title: '二', isDefault: true },
    ]"
    mode="tab"
    v-model="activeA"
/>

当前选中值: {{ activeA }}

### 选择框

```vue
<StarmapCheckbox v-model="isAChecked"> 时间 {{ isAChecked }}</StarmapCheckbox>
```

<StarmapCheckbox v-model="isAChecked"> 时间 {{ isAChecked }}</StarmapCheckbox>

### 输入框

```vue
<StarmapInput v-model="dataText" />
<StarmapInput number v-model="dataNumber" />
```

<StarmapInput v-model="dataText"/>
<StarmapInput number v-model="dataNumber"/>

{{dataText}}
