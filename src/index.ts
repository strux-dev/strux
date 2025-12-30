/***
 *
 *  Main Entry Point
 *
 */

import { Command } from "commander"
import { Settings, type ArchType, type TemplateType } from "./settings"
import { STRUX_VERSION } from "./version"
import { Logger } from "./utils/log"
import { init } from "./commands/init"

const program = new Command()

program
    .name("strux")
    .description("A Framework for Building Kiosk-Style Operating Systems")
    .version(STRUX_VERSION)
    .option("--verbose", "Enable verbose output")
    .hook("preAction", (command: Command) => {

        const options = command.opts()

        if (options.verbose) {

            // We enable verbose output
            Settings.verbose = true

        }


    })


program.command("init")
    .description("Initialize a new Strux project")
    .argument("<project-name>", "The name of the project to create")
    .option("-t, --template <template>", "Frontend Template (vanilla, react, or vue)", "vanilla")
    .option("-a, --arch <arch>", "Target Architecture (arm64 or x86_64)", "arm64")
    .action(async (projectName: string, options: {template?: string, arch?: string}) => {
        try {
            Settings.template = (options.template ?? "vanilla") as TemplateType
            Settings.arch = (options.arch ?? "arm64") as ArchType
            Settings.projectName = projectName

            // Validate template
            if (!["vanilla", "react", "vue"].includes(Settings.template)) {
                Logger.error(`Invalid template: ${Settings.template}. Must be one of: vanilla, react, vue`)
                process.exit(1)
            }

            // Validate arch
            if (!["arm64", "x86_64"].includes(Settings.arch)) {
                Logger.error(`Invalid architecture: ${Settings.arch}. Must be one of: arm64, x86_64`)
                process.exit(1)
            }

            Logger.log(`Initializing Strux Project: ${projectName}`)
            await init()
        } catch (err) {
            Logger.error(`Init failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exit(1)
        }
    })


program.command("types")
    .description("Generate TypeScript type definitions from Go structs")
    .action(async () => {
        const { generateTypes } = await import("./commands/types")
        const cwd = process.cwd()
        const result = await generateTypes({
            mainGoPath: `${cwd}/main.go`,
            outputDir: `${cwd}/frontend/src`,
        })
        if (result.success) {
            console.log(`Generated ${result.methodCount} methods, ${result.fieldCount} fields`)
            console.log(`Output: ${result.outputPath}`)
        } else {
            Logger.error(result.error ?? "Unknown error")
            process.exit(1)
        }
    })


program.parse()