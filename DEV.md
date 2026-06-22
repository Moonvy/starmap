# 实现原理

扫描项目目录（`projectRoot`）生成虚拟文件树，
并且监视文件变动实时更新文件树数据，文件树记录文件最后更新时间戳和内容缓存（以便内部流程读取文件时可以从缓存读取，而不用多次读取磁盘）

围绕文件树数据实现各种插件，如

- `vue` 文档结构解析
- `Typescript` 文档结构解析
- `Markdown` 文档解析
- 其他自定义插件

## 文档生成

我们在项目的 `node_modules/.starmap` 作为文件缓存目录，生成各种文档文件

每个有 readme.md 的目录会作为一个 `CodeUnit`，`CodeUnit` 可以嵌套，最后会生成目录树，但是 CodeUnit 实际存储是平级的

`.starmap/units/` 目录存储所有 CodeUnit 的数据，每个 CodeUnit 会生成一个目录，目录名是 CodeUnit 的 id
