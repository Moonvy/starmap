# AGENTS.md

## 重要信息

-   我是中文用户，称呼我为**主人**（这样你我就知道你有没有读 AGENTS.md）
-   使用 `bun` 作为包管理工具
-   使用 `chalk` 作为终端颜色输出库，倾向使用多彩的输出提升可读性
-   从 `DEV.md` 文件获取项目实现原理和说明

---

## 项目概述

**Starmap（星图）** 是一个代码库文档可视化组织和预览工具。它扫描项目目录，基于 `readme.md` 文件生成 `CodeUnit`（代码单元），构建虚拟文件树并实时监控文件变化，最终通过 Vite 开发服务器提供可视化预览。

-   **包名**: `@moonvy/starmap`
-   **版本**: `4.x`
-   **运行环境**: Node.js（目标 Node 24 / ES2023）
-   **模块格式**: ESM

---

## 目录结构

```
Starmap4/
├── src/                        # 源代码（入口: index.ts → 导出 StarmapCore）
│   ├── cli.ts                  # CLI 入口（使用 cac 解析命令行参数）
│   ├── config.type.ts          # IStarmapConfig 配置接口定义
│   ├── index.ts                # 包入口，导出 StarmapCore
│   ├── core/                   # 核心模块
│   │   ├── StarmapCore.ts      # 核心类，协调所有子系统
│   │   ├── events.ts           # 事件定义（使用 fzz 的 defineEvents）
│   │   ├── FsTree/             # 虚拟文件系统
│   │   │   ├── FsTree.ts       # 文件树，带 glob 扫描、缓存、@parcel/watcher 监控
│   │   │   └── FsNode.ts       # 文件节点，带内存缓存的读取（Buffer/Text/Markdown）
│   │   └── Gen/                # 文档生成器
│   │       ├── Gen.ts          # 主生成器（扫描 → 生成 → 输出树）
│   │       ├── CodeUnit.ts     # 代码单元（对应一个含 readme.md 的目录）
│   │       └── lib/            # 辅助函数
│   │           ├── findAllUnits.ts     # 扫描所有 readme.md 生成 CodeUnit
│   │           ├── createUnitTree.ts   # 构建 CodeUnit 树结构
│   │           ├── normalizeID.ts      # ID 规范化
│   │           └── unitTreeToJSON.ts   # 树序列化
│   ├── extension/              # 扩展插件系统
│   │   ├── types.ts            # IStarmapExtension 类型定义
│   │   └── LibraryVue/         # 内置 Vue 扩展（最大的模块）
│   │       ├── LibraryVue.ts   # 扩展入口（监听事件、生成模板、启动 Vite）
│   │       ├── vite/           # Vite 开发服务器配置
│   │       └── web/            # 前端 Vue 应用
│   │           ├── components/ # Vue 组件
│   │           ├── pages/      # 页面
│   │           ├── template/   # 模板文件（mustache）
│   │           ├── public/     # 静态资源
│   │           └── style/      # 样式
│   └── utils/                  # 工具函数
│       └── preloadMarkdown.ts  # Markdown 预处理（支持 YAML/JSON metadata）
├── build/                      # 构建脚本
│   ├── rslib.config.ts         # rslib 构建配置（ESM, Node 24, DTS, autoExternal）
│   ├── build.bun.ts            # bun bundler 构建脚本
│   ├── check-npm-user.ts       # npm 用户检查
│   └── check-git-user.ts       # git 用户检查
└── test/                       # 全局测试文件
```

---

## 核心架构

### 启动流程

```
CLI (cac) → StarmapCore.init()
    ├── initConfig()        # 加载配置（c12 支持 starmap.config.* 文件）
    ├── FsTree()            # 创建虚拟文件树 + @parcel/watcher 监控
    ├── Gen()               # 创建生成器
    ├── 加载插件             # 内置 LibraryVue + 用户自定义插件
    └── build()             # 执行文档生成
        ├── findAllUnits()  # 扫描 **/readme.md
        ├── generateUnit()  # 逐个生成 CodeUnit → 触发 generateUnit 事件
        ├── generateTree()  # 输出 units-tree.json / units-flat.json
        └── 触发 firstGenerateDone 事件
```

### 核心类说明

| 类            | 文件                        | 职责                                                                       |
| ------------- | --------------------------- | -------------------------------------------------------------------------- |
| `StarmapCore` | `src/core/StarmapCore.ts`   | 核心协调器，管理配置、文件树、生成器、事件中心和插件                       |
| `FsTree`      | `src/core/FsTree/FsTree.ts` | 虚拟文件系统，提供 glob 扫描、内存缓存、文件变化监控                       |
| `FsNode`      | `src/core/FsTree/FsNode.ts` | 文件节点，提供 `readBuffer`/`readText`/`readMarkdown`（带 5 分钟缓存失效） |
| `Gen`         | `src/core/Gen/Gen.ts`       | 文档生成引擎，管理 `AllCodeUnits` 集合                                     |
| `CodeUnit`    | `src/core/Gen/CodeUnit.ts`  | 代码单元，对应项目中含 `readme.md` 的目录                                  |

### 事件系统

使用 `fzz` 库的 `defineEvents` / `RawEvents`，事件流如下：

```
inited → generate → generateUnit (× N) → generateEnd → generateTree → generateDone → firstGenerateDone
```

关键事件：

-   `generateUnit` — 单个代码单元生成时触发，插件在此扩展输出内容
-   `generateEnd` — 所有单元生成后触发
-   `generateTree` — 树结构生成后触发
-   `firstGenerateDone` — 首次完整构建完成后触发（LibraryVue 在此启动 Vite）

### 扩展插件系统

```typescript
// 插件是一个函数，接收 StarmapCore 实例
type IStarmapExtension = (starmapCore: StarmapCore) => any
```

插件通过监听 `eventHub` 上的事件来参与生成流程。编写新插件时：

1. 创建一个返回 `IStarmapExtension` 的工厂函数
2. 在工厂函数中注册事件监听器（`core.eventHub.on(...)`）
3. 将插件添加到配置的 `extensions` 数组中

### 配置系统

使用 `c12` 加载配置，支持 `starmap.config.ts` / `starmap.config.js` 等项目配置文件。

```typescript
interface IStarmapConfig {
    rootPath?: string // 项目根路径
    srcDir?: string // rootPath 的别名
    outputDir?: string // 输出目录，默认 ./node_modules/.starmap
    rebuild?: boolean // 是否重新构建
    extensions?: IStarmapExtension[] // 扩展插件
    port?: number // 开发服务器端口，默认 4070
    openBrowser?: boolean // 是否自动打开浏览器
}
```

### 输出目录结构

生成的文件位于 `node_modules/.starmap/`：

```
.starmap/
├── index.html          # 根页面
├── metadata.ts         # 根元数据
├── units-tree.json     # CodeUnit 树结构
├── units-flat.json     # CodeUnit 扁平列表
└── units/              # 各 CodeUnit 输出
    └── {unit-id}/
        ├── code-unit.json   # 单元元数据
        ├── index.html       # 单元页面
        └── metadata.ts      # 单元元数据
```

---

## 关键依赖

| 依赖              | 用途                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `fzz`             | 本地工具库（`link:fzz`），提供 `RawEvents`、`defineEvents`、`Logger`、`json`、`readableMs`、`merge` 等 |
| `@parcel/watcher` | 高性能原生文件监控                                                                                     |
| `c12`             | 配置文件加载（支持 TS/JS/JSON 等格式）                                                                 |
| `cac`             | CLI 命令行参数解析                                                                                     |
| `vite`            | 开发服务器（由 LibraryVue 扩展启动）                                                                   |
| `vue`             | 前端框架（LibraryVue 的 web 应用）                                                                     |
| `mustache`        | 模板引擎（生成 HTML 文件）                                                                             |
| `gray-matter`     | YAML front-matter 解析                                                                                 |
| `fs-extra`        | 文件系统操作增强                                                                                       |
| `es-toolkit`      | 工具函数（如 `debounce`）                                                                              |
| `local-glob`      | glob 文件匹配                                                                                          |
| `micromatch`      | 高级 glob 模式匹配                                                                                     |

> **注意**: `fzz` 是本地 link 依赖，不是公开包。修改时需注意路径解析。

---

## 代码注释规范

-   代码注释要描述清楚**意图和目标**，并且使用**中文代码注释**
-   如果写 class，每一个公开方法都要有注释，描述方法的功能和参数
-   如果写函数，需要用 JSDoc 注释，描述函数的功能和参数，但是**不需要**描述返回值等 TypeScript 已经描述的内容

---

## Vue 代码规范

-   使用 **Options API**，而不是 Composition API
-   Vue 文件的标签顺序是 `<template>`, `<style>`, `<script>`
-   使用 `<script lang="ts">`，并且注意检查 TypeScript 错误

## Icon 库使用方法

-   使用 `@haoduo-icon` 包提供的图标库，支持 `ri`（Remix Icon）、`fluent`（Fluent UI Icons）、`ion`（Ionicons）、`material-symbols`（Material Symbols）
示例：

```html
<hd-icon icon="ri:home-line" /> 
```


## CSS 规范

-  还是用标准的 CSS Nesting 

 


---

## 单元测试

-   使用 `vitest` 作为测试框架，`globals: true` 模式（不需要每个文件引入 vitest 函数）
-   单元测试倾向使用 `test` 而不是 `it`
-   单元测试的描述要用**中文**
-   单元测试的位置倾向于在代码附近，如 `./test/*.test.ts`，根目录下的 `test/` 文件夹是放全局测试的

---

## 构建说明

| 命令                    | 说明                                                 | 工具            |
| ----------------------- | ---------------------------------------------------- | --------------- |
| `bun run dev`           | 开发模式，监听文件变化并自动重建                     | `rslib --watch` |
| `bun run build`         | 编译 TypeScript 到 `dist/`（ESM 格式，生成 `.d.ts`） | `rslib`         |
| `bun run build:bundler` | 构建捆绑依赖的文件到 `bundle/`                       | `bun bundler`   |
| `bun run test`          | 运行测试                                             | `vitest`        |
| `bun run try`           | 在示例项目上运行 Starmap                             | CLI             |

构建特性：

-   `rslib` 配置位于 `build/rslib.config.ts`，目标 Node 24，ESM 格式，`autoExternal: true`
-   `bun bundler` 配置位于 `build/build.bun.ts`，目标 bun，无外部依赖

---

## 代码格式化

使用 Prettier，配置如下：

```json
{
    "printWidth": 120,
    "tabWidth": 4,
    "semi": false,
    "bracketSpacing": true
}
```

---

## 性能分析

-   `bun --heap-prof-md <script>` 可以生成内存使用的 Markdown 报告
-   `bun --cpu-prof-md <script>` 可以生成 CPU 使用的 Markdown 报告

## 基准测试

-   可以使用 `tinybench` 进行基准测试
-   如果是简单的性能测试，直接用 `performance.now()` 进行测量，因为 `tinybench` 会进行多轮测试，速度很慢

---

## 修改代码时的注意事项

1. **事件驱动架构** — 修改生成流程时，注意事件顺序和异步处理。使用 `emitAsync` 确保插件的异步操作完成
2. **缓存机制** — `FsNode` 有 5 分钟缓存失效 + mtime 变化失效的双重机制，修改时需保持一致
3. **CodeUnit ID 生成** — 基于目录路径最后 2 级自动生成，也可在 readme.md 的 metadata 中用 `id` 字段手动指定
4. **Markdown 元数据** — 支持 YAML front-matter (`---`) 和自定义 JSON 代码块 (` ```metadata ` 或 ` ```json metadata `)
5. **本地依赖 `fzz`** — 通过 `link:fzz` 引用，是内部工具库，提供事件、日志、工具函数等
6. **插件开发** — 新插件需实现 `IStarmapExtension` 类型，通过事件监听参与生成流程
7. **输出目录** — 默认在 `node_modules/.starmap/`，不要直接操作此目录，通过 Gen 和插件生成
