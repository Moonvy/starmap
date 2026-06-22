import path from "node:path"
import fsex from "fs-extra"
import { getPackageRoot } from "./packagePath"

/**
 * 寻找 Starmap 包的自带文档目录路径
 */
export function getStarmapDocPath(): string | null {
    const pkgRoot = getPackageRoot()
    const docPath = path.join(pkgRoot, "src/doc")
    if (fsex.existsSync(docPath)) {
        return docPath
    }
    return null
}
