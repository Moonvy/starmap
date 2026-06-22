import { substringJsBySymbol } from "../lib/substringJsBySymbol"

test("按函数名截取函数声明", () => {
    const source = [
        "const ignore = 1",
        "export async function loadUser(id: string) {",
        "    const data = await fetch(`/api/${id}`)",
        "    return data",
        "}",
        "const tail = 2",
    ].join("\n")

    const result = substringJsBySymbol(source, "loadUser")

    expect(result).toBe([
        "export async function loadUser(id: string) {",
        "    const data = await fetch(`/api/${id}`)",
        "    return data",
        "}",
    ].join("\n"))
})

test("按类名截取类声明", () => {
    const source = [
        "export class DemoBox {",
        "    value = 1",
        "",
        "    run() {",
        "        return { ok: true }",
        "    }",
        "}",
        "export const other = 1",
    ].join("\n")

    const result = substringJsBySymbol(source, "DemoBox")

    expect(result).toBe([
        "export class DemoBox {",
        "    value = 1",
        "",
        "    run() {",
        "        return { ok: true }",
        "    }",
        "}",
    ].join("\n"))
})

test("按类型名截取 type 定义", () => {
    const source = [
        "type Other = string",
        "export type ITableIndexConfig = {",
        "    name: string",
        "    options: { unique: boolean }",
        "}",
        "const tail = 1",
    ].join("\n")

    const result = substringJsBySymbol(source, "ITableIndexConfig")

    expect(result).toBe([
        "export type ITableIndexConfig = {",
        "    name: string",
        "    options: { unique: boolean }",
        "}",
    ].join("\n"))
})

test("按变量名截取对象或箭头函数定义", () => {
    const source = [
        "const title = 'createWidget should be ignored inside string'",
        "export const createWidget = (name: string) => ({",
        "    name,",
        "    render() {",
        "        return `<div>${name}</div>`",
        "    },",
        "})",
        "const tail = true",
    ].join("\n")

    const result = substringJsBySymbol(source, "createWidget")

    expect(result).toBe([
        "export const createWidget = (name: string) => ({",
        "    name,",
        "    render() {",
        "        return `<div>${name}</div>`",
        "    },",
        "})",
    ].join("\n"))
})

test("未找到 symbol 时返回原始源码", () => {
    const source = ["export const foo = 1", "export const bar = 2"].join("\n")

    expect(substringJsBySymbol(source, "baz")).toBe(source)
})