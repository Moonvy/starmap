import { CodeUnit } from "../CodeUnit"

export type CodeUnitJSON = ReturnType<CodeUnit["toJSON"]> & {
    children?: CodeUnitJSON[]
}

/**
 * 把已经结构化的 units 树转换为可序列化对象
 * 由于 CodeUnit 的 toJSON 方法不会输出 children 属性，所以这里需要手动处理
 * @param units CodeUnit 树根节点列表
 */
export function unitTreeToJSON(units: CodeUnit[]): CodeUnitJSON[] {
    return units
        .filter((unit) => !unit.isInternalDoc) // 过滤掉内部文档，不显示在目录树中
        .map((unit) => {
            const json = unit.toJSON()
            if (unit.children && unit.children.length > 0) {
                return {
                    ...json,
                    children: unitTreeToJSON(unit.children),
                }
            }

            return json
        })
}
