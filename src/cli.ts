#!/usr/bin/env node
import packageInfo from "../package.json"
import chalk from "chalk"
import path from "path"
import fsex from "fs-extra"
import { cac } from "cac"

import { StarmapCore } from "./core/StarmapCore"

async function main() {
    console.clear()
    console.log(chalk.blue("Starmap"), "🌟", chalk.blueBright(`v${packageInfo.version}`, "\n"))

    let cli = cac()

    cli.command("build [srcDir]", "build starmap static site")
        .option("--buildDir <path>", "output directory for built static files.")
        .option("--outputDir <path>", "temp files dir.")
        .option("--rebuild", "clear cache and rebuild.")
        .action(async (srcDir = ".", options) => {
            let srcDirFin = path.resolve(srcDir)
            if (!fsex.existsSync(srcDirFin)) {
                throw new Error("not found srcDir: " + srcDir + ` (${srcDirFin})`)
            }

            let outputDir: string | undefined
            if (options.outputDir) {
                outputDir = path.resolve(options.outputDir)
            }

            new StarmapCore({
                srcDir,
                outputDir,
                buildDir: options.buildDir,
                rebuild: options.rebuild,
                isBuild: true,
                watch: false,
            })
        })

    cli.command("[srcDir]", "start starmap server")
        .option("--rebuild", "clear cache and rebuild.")
        .option("--port <port>", "vite server port.")
        .option("--outputDir <path>", "temp files dir.")
        .action(async (srcDir = ".", options) => {
            let srcDirFin = path.resolve(srcDir)
            if (!fsex.existsSync(srcDirFin)) {
                throw new Error("not found srcDir: " + srcDir + ` (${srcDirFin})`)
            }

            let outputDir: string | undefined
            if (options.outputDir) {
                outputDir = path.resolve(options.outputDir)
            }

            let port: number | undefined
            if (options.port !== undefined) {
                port = Number(options.port)
                if (!Number.isInteger(port) || port <= 0) {
                    throw new Error(`invalid port: ${options.port}`)
                }
            }

            new StarmapCore({
                srcDir,
                outputDir,
                port,
                rebuild: options.rebuild,
                watch: true,
            })
        })

    cli.help()
    cli.parse()

    // 进程退出时输出提示
    process.on("exit", () => {
        console.log(chalk.hex("#2d5853")("Starmap"), "🌜", chalk.gray("exit."))
    })
}
main()
