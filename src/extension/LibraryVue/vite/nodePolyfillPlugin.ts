import type { Plugin } from "vite"

/**
 * 为 Vite 浏览器端提供 Node.js 内置模块的 Polyfill / Shim 插件
 *
 * 解决浏览器预览宿主项目组件（如经由 Rslib / Rspack 打包的产物或依赖）时，
 * 因包含 `import { createRequire } from "node:module"` 或 `import { createHash } from "node:crypto"`
 * 等 Node.js 内置模块导入而导致 Vite 抛出 externalized 异常的问题。
 */
export function nodePolyfillPlugin(): Plugin {
    const virtualPrefix = "\0starmap:node:"

    const shims: Record<string, string> = {
        module: `
export function createRequire() {
    const req = (id) => {
        return {}
    }
    req.resolve = (id) => id
    return req
}
export const builtinModules = []
export class Module {}
export const syncBuiltinESMExports = () => {}
export default { createRequire, builtinModules, Module, syncBuiltinESMExports }
`,
        crypto: `
export function createHash(algorithm) {
    let data = ''
    const hash = {
        update(d) { data += String(d); return hash },
        digest(encoding) {
            if (encoding === 'hex') return ''
            if (encoding === 'base64') return ''
            return new Uint8Array()
        }
    }
    return hash
}
export function createHmac(algorithm, key) { return createHash(algorithm) }
export function randomBytes(size) {
    const arr = new Uint8Array(size)
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(arr)
    }
    return arr
}
export function randomUUID() {
    return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '00000000-0000-0000-0000-000000000000'
}
export function getRandomValues(arr) { return globalThis.crypto?.getRandomValues(arr) }
export const webcrypto = globalThis.crypto
export const subtle = globalThis.crypto?.subtle
export const constants = {}
export default {
    createHash,
    createHmac,
    randomBytes,
    randomUUID,
    getRandomValues,
    webcrypto: globalThis.crypto,
    subtle: globalThis.crypto?.subtle,
    constants: {}
}
`,
        url: `
export function fileURLToPath(url) {
    if (typeof url === 'string') {
        return url.replace(/^file:\\/\\//, '')
    }
    return url?.pathname || ''
}
export function pathToFileURL(filepath) {
    return new URL('file://' + filepath)
}
export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams
export default { fileURLToPath, pathToFileURL, URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams }
`,
        path: `
export function join(...args) { return args.filter(Boolean).join('/').replace(/\\/+/g, '/') }
export function resolve(...args) { return args.filter(Boolean).join('/').replace(/\\/+/g, '/') }
export function dirname(p) { return p.split('/').slice(0, -1).join('/') || '.' }
export function basename(p, ext) {
    const base = p.split('/').pop() || ''
    return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base
}
export function extname(p) {
    const base = p.split('/').pop() || ''
    const i = base.lastIndexOf('.')
    return i > 0 ? base.slice(i) : ''
}
export function isAbsolute(p) { return p.startsWith('/') || /^[a-zA-Z]:[\\\\/]/.test(p) }
export function relative(from, to) { return to }
export function normalize(p) { return p }
export const sep = '/'
export const delimiter = ':'
const pathObj = { join, resolve, dirname, basename, extname, isAbsolute, relative, normalize, sep, delimiter }
export const posix = pathObj
export const win32 = pathObj
export default { ...pathObj, posix, win32 }
`,
        fs: `
export const promises = {
    readFile: async () => '',
    writeFile: async () => {},
    access: async () => {},
    stat: async () => ({ isDirectory: () => false, isFile: () => true }),
    readdir: async () => [],
    mkdir: async () => {},
    rm: async () => {}
}
export const readFile = (p, opt, cb) => { if (typeof opt === 'function') opt(null, ''); else if (cb) cb(null, '') }
export const readFileSync = () => ''
export const writeFile = (p, d, opt, cb) => { if (typeof opt === 'function') opt(null); else if (cb) cb(null) }
export const writeFileSync = () => {}
export const existsSync = () => false
export const access = (p, cb) => cb && cb(null)
export const accessSync = () => {}
export const stat = (p, cb) => cb && cb(null, { isDirectory: () => false, isFile: () => true })
export const statSync = () => ({ isDirectory: () => false, isFile: () => true })
export const readdir = (p, cb) => cb && cb(null, [])
export const readdirSync = () => []
export const mkdir = (p, opt, cb) => { if (typeof opt === 'function') opt(null); else if (cb) cb(null) }
export const mkdirSync = () => {}
export const createReadStream = () => ({ pipe: () => {}, on: () => {} })
export const createWriteStream = () => ({ write: () => {}, end: () => {}, on: () => {} })
export const constants = {}
export default {
    promises,
    readFile,
    readFileSync,
    writeFile,
    writeFileSync,
    existsSync,
    access,
    accessSync,
    stat,
    statSync,
    readdir,
    readdirSync,
    mkdir,
    mkdirSync,
    createReadStream,
    createWriteStream,
    constants
}
`,
        "fs/promises": `
export const readFile = async () => ''
export const writeFile = async () => {}
export const access = async () => {}
export const stat = async () => ({ isDirectory: () => false, isFile: () => true })
export const readdir = async () => []
export const mkdir = async () => {}
export const rm = async () => {}
export default { readFile, writeFile, access, stat, readdir, mkdir, rm }
`,
        process: `
export const env = {}
export const cwd = () => '/'
export const nextTick = (fn, ...args) => queueMicrotask(() => fn(...args))
export const browser = true
export const version = ''
export const versions = {}
export const platform = 'browser'
export default { env, cwd, nextTick, browser, version, versions, platform }
`,
        buffer: `
export const Buffer = globalThis.Buffer || class Buffer {}
export default { Buffer }
`,
        events: `
export class EventEmitter {
    constructor() { this._events = {} }
    on(event, fn) { (this._events[event] = this._events[event] || []).push(fn); return this }
    once(event, fn) {
        const wrapped = (...args) => { this.off(event, wrapped); fn(...args) }
        return this.on(event, wrapped)
    }
    off(event, fn) {
        if (!this._events[event]) return this
        this._events[event] = this._events[event].filter(f => f !== fn)
        return this
    }
    emit(event, ...args) {
        const fns = this._events[event] || []
        fns.forEach(fn => fn(...args))
        return fns.length > 0
    }
    addListener(event, fn) { return this.on(event, fn) }
    removeListener(event, fn) { return this.off(event, fn) }
    removeAllListeners(event) { if (event) delete this._events[event]; else this._events = {}; return this }
}
export default EventEmitter
`,
        os: `
export const platform = () => 'browser'
export const arch = () => 'javascript'
export const type = () => 'Browser'
export const release = () => ''
export const homedir = () => '/'
export const tmpdir = () => '/tmp'
export const hostname = () => 'localhost'
export const cpus = () => []
export const totalmem = () => 0
export const freemem = () => 0
export const networkInterfaces = () => ({})
export const EOL = '\\n'
export default { platform, arch, type, release, homedir, tmpdir, hostname, cpus, totalmem, freemem, networkInterfaces, EOL }
`,
        util: `
export const promisify = (fn) => (...args) => new Promise((resolve, reject) => fn(...args, (err, res) => err ? reject(err) : resolve(res)))
export const callbackify = (fn) => (...args) => {}
export const inspect = (obj) => String(obj)
export const format = (...args) => args.join(' ')
export const inherits = (ctor, superCtor) => { if (superCtor) { ctor.super_ = superCtor; Object.setPrototypeOf(ctor.prototype, superCtor.prototype) } }
export const types = {}
export const TextEncoder = globalThis.TextEncoder
export const TextDecoder = globalThis.TextDecoder
export default { promisify, callbackify, inspect, format, inherits, types, TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder }
`,
        assert: `
export function assert(val, msg) { if (!val) throw new Error(msg || 'Assertion failed') }
export const ok = assert
export const equal = (a, b, msg) => { if (a != b) throw new Error(msg || 'Assertion failed') }
export const strictEqual = (a, b, msg) => { if (a !== b) throw new Error(msg || 'Assertion failed') }
export const deepEqual = (a, b) => {}
export const deepStrictEqual = (a, b) => {}
export default Object.assign(assert, { ok, equal, strictEqual, deepEqual, deepStrictEqual })
`,
        stream: `
export class Stream {}
export class Readable { pipe() { return this } }
export class Writable { write() {} end() {} }
export class Duplex { pipe() { return this } write() {} end() {} }
export class Transform { pipe() { return this } write() {} end() {} }
export class PassThrough { pipe() { return this } write() {} end() {} }
export const pipeline = (...args) => {}
export const finished = (...args) => {}
export default { Stream, Readable, Writable, Duplex, Transform, PassThrough, pipeline, finished }
`,
        timers: `
export const setTimeout = globalThis.setTimeout
export const clearTimeout = globalThis.clearTimeout
export const setInterval = globalThis.setInterval
export const clearInterval = globalThis.clearInterval
export const setImmediate = (fn, ...args) => globalThis.setTimeout(fn, 0, ...args)
export const clearImmediate = globalThis.clearTimeout
export default { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, setImmediate, clearImmediate: globalThis.clearTimeout }
`,
        "timers/promises": `
export const setTimeout = (ms, val) => new Promise(resolve => globalThis.setTimeout(() => resolve(val), ms))
export const setImmediate = (val) => new Promise(resolve => globalThis.setTimeout(() => resolve(val), 0))
export const setInterval = async function* (ms, val) { while (true) { yield await setTimeout(ms, val) } }
export default { setTimeout, setImmediate, setInterval }
`,
        child_process: `
export const exec = (cmd, opt, cb) => { if (typeof opt === 'function') opt(null, '', ''); else if (cb) cb(null, '', '') }
export const execSync = () => ''
export const spawn = () => ({ on: () => {}, stdout: { on: () => {} }, stderr: { on: () => {} } })
export const spawnSync = () => ({ stdout: '', stderr: '', status: 0 })
export const fork = () => {}
export default { exec, execSync, spawn, spawnSync, fork }
`,
        perf_hooks: `
export const performance = globalThis.performance
export const PerformanceObserver = globalThis.PerformanceObserver
export default { performance: globalThis.performance, PerformanceObserver: globalThis.PerformanceObserver }
`,
        async_hooks: `
export class AsyncLocalStorage { run(s, fn, ...a) { return fn(...a) } getStore() { return undefined } }
export class AsyncResource {}
export default { AsyncLocalStorage, AsyncResource }
`,
        string_decoder: `
export class StringDecoder {
    write(b) { return typeof b === 'string' ? b : new TextDecoder().decode(b) }
    end(b) { return b ? this.write(b) : '' }
}
export default { StringDecoder }
`,
        zlib: `
export const gzip = (b, cb) => cb && cb(null, b)
export const gzipSync = (b) => b
export const gunzip = (b, cb) => cb && cb(null, b)
export const gunzipSync = (b) => b
export const deflate = (b, cb) => cb && cb(null, b)
export const deflateSync = (b) => b
export const inflate = (b, cb) => cb && cb(null, b)
export const inflateSync = (b) => b
export const constants = {}
export default { gzip, gzipSync, gunzip, gunzipSync, deflate, deflateSync, inflate, inflateSync, constants }
`,
        http: `
export const createServer = () => ({ listen: () => {}, on: () => {}, close: () => {} })
export const request = () => ({ on: () => {}, write: () => {}, end: () => {} })
export const get = () => ({ on: () => {} })
export const Agent = class {}
export const METHODS = []
export const STATUS_CODES = {}
export default { createServer, request, get, Agent, METHODS, STATUS_CODES }
`,
        https: `
export const createServer = () => ({ listen: () => {}, on: () => {}, close: () => {} })
export const request = () => ({ on: () => {}, write: () => {}, end: () => {} })
export const get = () => ({ on: () => {} })
export const Agent = class {}
export default { createServer, request, get, Agent }
`,
        net: `
export const createServer = () => ({ listen: () => {}, on: () => {}, close: () => {} })
export const createConnection = () => ({ on: () => {}, write: () => {}, end: () => {} })
export const connect = createConnection
export const Socket = class {}
export const isIP = () => 0
export const isIPv4 = () => false
export const isIPv6 = () => false
export default { createServer, createConnection, connect, Socket, isIP, isIPv4, isIPv6 }
`,
        tls: `
export const createServer = () => ({ listen: () => {}, on: () => {}, close: () => {} })
export const connect = () => ({ on: () => {}, write: () => {}, end: () => {} })
export const TLSSocket = class {}
export default { createServer, connect, TLSSocket }
`,
        dns: `
export const lookup = (h, cb) => cb && cb(null, '127.0.0.1', 4)
export const resolve = (h, cb) => cb && cb(null, [])
export const promises = { lookup: async () => ({ address: '127.0.0.1', family: 4 }), resolve: async () => [] }
export default { lookup, resolve, promises }
`,
        vm: `
export const createContext = (ctx) => ctx || {}
export const runInContext = (code, ctx) => ({})
export const runInNewContext = (code, ctx) => ({})
export const runInThisContext = (code) => ({})
export class Script { runInContext() {} runInNewContext() {} runInThisContext() {} }
export default { createContext, runInContext, runInNewContext, runInThisContext, Script }
`,
        worker_threads: `
export class Worker { postMessage() {} on() {} terminate() {} }
export const parentPort = null
export const isMainThread = true
export const workerData = null
export default { Worker, parentPort, isMainThread, workerData }
`,
        readline: `
export const createInterface = () => ({ on: () => {}, close: () => {}, question: () => {} })
export default { createInterface }
`,
        tty: `
export const isatty = () => false
export class ReadStream {}
export class WriteStream {}
export default { isatty, ReadStream, WriteStream }
`,
    }

    return {
        name: "starmap:node-polyfills",
        enforce: "pre",
        resolveId(id) {
            let normalized = id
            if (normalized.startsWith("node:")) {
                normalized = normalized.slice(5)
            }
            if (shims[normalized]) {
                return virtualPrefix + normalized
            }
            // 针对其它未显式声明的 node:* 模块，拦截并提供兜底 shim，避免 Vite 抛出 externalized 异常
            if (id.startsWith("node:")) {
                return virtualPrefix + "generic:" + normalized
            }
            return null
        },
        load(id) {
            if (!id.startsWith(virtualPrefix)) return null
            let name = id.slice(virtualPrefix.length)
            if (name.startsWith("generic:")) {
                name = name.slice("generic:".length)
            }
            if (shims[name]) {
                return shims[name]
            }
            // 通用 node:* 兜底 shim
            return `
export function createHash() { return { update() { return this }, digest() { return '' } } }
export function createHmac() { return createHash() }
export function createRequire() { return () => ({}) }
export const promises = {}
const dummy = new Proxy(() => ({}), {
    get: (t, p) => (p === '__esModule' ? true : dummy),
    apply: () => ({})
})
export default dummy
`
        },
    }
}
