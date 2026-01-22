/***
 *
 *
 *  Logging Utilities
 *
 */

import { Settings } from "../settings"
import chalk from "chalk"
import ora, { type Ora } from "ora"

// Unicode box-drawing characters for consistent styling
const ICONS = {
    arrow: "›",
    success: "✓",
    error: "✗",
    warning: "⚠",
    cached: "◆",
    debug: "○",
    info: "•",
    spinner: "◐",
} as const

export class Logger {
    // Styled prefix badge
    static prefix = chalk.bold.cyan("strux")

    private static sink: ((entry: { level: string; message: string; formatted?: string }) => void) | null = null

    public static setSink(sink: ((entry: { level: string; message: string; formatted?: string }) => void) | null): void {
        Logger.sink = sink
    }

    public static hasSink(): boolean {
        return Logger.sink !== null
    }

    public static emitToSink(entry: { level: string; message: string; formatted?: string }): void {
        if (!Logger.sink) return
        Logger.sink(entry)
    }

    // Format a message with the standard prefix
    private static format(icon: string, iconColor: (s: string) => string, message: string): string {
        return `${Logger.prefix} ${iconColor(icon)} ${message}`
    }

    public static log(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "log", message, formatted: Logger.format(ICONS.arrow, chalk.cyan, message) })
            return
        }
        console.log(Logger.format(ICONS.arrow, chalk.cyan, message))
    }

    public static success(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "success", message, formatted: Logger.format(ICONS.success, chalk.green, chalk.green(message)) })
            return
        }
        console.log(Logger.format(ICONS.success, chalk.green, chalk.green(message)))
    }

    public static debug(message: string) {
        if (Settings.verbose) {
            if (Logger.sink) {
                Logger.sink({ level: "debug", message, formatted: Logger.format(ICONS.debug, chalk.yellow, chalk.dim(message)) })
                return
            }
            console.log(Logger.format(ICONS.debug, chalk.yellow, chalk.dim(message)))
        }
    }

    public static error(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "error", message, formatted: Logger.format(ICONS.error, chalk.red, chalk.red(message)) })
            return
        }
        console.error(Logger.format(ICONS.error, chalk.red, chalk.red(message)))
    }

    public static errorWithExit(message: string): never {
        Logger.error(message)
        // If we have a sink (UI mode), give time for the error to render
        if (Logger.sink) {
            Logger.sink({
                level: "error",
                message: "Process will exit in 5 seconds...",
                formatted: Logger.format(ICONS.error, chalk.red, chalk.yellow("Process will exit in 5 seconds. Press Q to exit now."))
            })
            // Schedule the exit to allow UI to render, then throw to prevent return
            setTimeout(() => process.exit(1), 5000)
            // Throw a special error to prevent function from returning
            // This error will be caught by the global handler or terminate the current call stack
            throw new Error(`[STRUX_EXIT] ${message}`)
        }
        process.exit(1)
    }

    public static cached(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "cached", message, formatted: Logger.format(ICONS.cached, chalk.magenta, `${message} ${chalk.dim("(cached)")}`) })
            return
        }
        console.log(Logger.format(ICONS.cached, chalk.magenta, `${message} ${chalk.dim("(cached)")}`))
    }

    public static warning(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "warning", message, formatted: Logger.format(ICONS.warning, chalk.yellow, chalk.yellow(message)) })
            return
        }
        console.log(Logger.format(ICONS.warning, chalk.yellow, chalk.yellow(message)))
    }

    public static info(message: string) {
        if (Logger.sink) {
            Logger.sink({ level: "info", message, formatted: Logger.format(ICONS.info, chalk.blue, message) })
            return
        }
        console.log(Logger.format(ICONS.info, chalk.blue, message))
    }

    public static title(msg: string): void {
        if (Logger.sink) {
            const line = chalk.dim("─".repeat(Math.min(msg.length + 4, 60)))
            Logger.sink({ level: "title", message: msg, formatted: `\n${chalk.bold.cyan(`${msg}`)}\n${line}` })
            return
        }
        console.log()
        console.log(chalk.bold.cyan(`${msg}`))
        console.log(chalk.dim("─".repeat(Math.min(msg.length + 4, 60))))
    }

    public static blank(): void {
        if (Logger.sink) {
            Logger.sink({ level: "blank", message: "", formatted: "" })
            return
        }
        console.log()
    }

    // For printing raw output (like error details) with proper indentation
    public static raw(message: string): void {
        if (Logger.sink) {
            const indent = "       " // Align with message text after prefix and icon
            const lines = message.split("\n")
            const formatted = lines
                .filter((line) => line.trim())
                .map((line) => `${indent}${chalk.dim(line)}`)
                .join("\n")
            Logger.sink({ level: "raw", message, formatted })
            return
        }
        const indent = "       " // Align with message text after prefix and icon
        const lines = message.split("\n")
        for (const line of lines) {
            if (line.trim()) {
                console.log(`${indent}${chalk.dim(line)}`)
            }
        }
    }
}

export class Spinner {
    private spinner: Ora | null = null
    private message: string
    private interval: ReturnType<typeof setInterval> | null = null
    private frameIndex = 0

    constructor(message: string) {
        this.message = message
    }

    private formatSpinnerText(msg: string): string {
        return `${Logger.prefix} ${chalk.cyan(ICONS.spinner)} ${msg}`
    }

    private formatSpinnerFrame(frame: string, msg: string): string {
        return `${Logger.prefix} ${chalk.cyan(frame)} ${msg}`
    }

    start(): void {
        if (Logger.hasSink()) {
            const frames = ["◐", "◓", "◑", "◒"]
            Logger.emitToSink({
                level: "spinner",
                message: this.message,
                formatted: this.formatSpinnerFrame(frames[this.frameIndex], this.message)
            })
            this.interval = setInterval(() => {
                this.frameIndex = (this.frameIndex + 1) % frames.length
                Logger.emitToSink({
                    level: "spinner",
                    message: this.message,
                    formatted: this.formatSpinnerFrame(frames[this.frameIndex], this.message)
                })
            }, 80)
            return
        }

        this.spinner = ora({
            text: this.formatSpinnerText(this.message),
            spinner: {
                interval: 80,
                frames: ["◐", "◓", "◑", "◒"].map(f => `${Logger.prefix} ${chalk.cyan(f)}`)
            },
            prefixText: "",
        }).start()
        // Override the text to not duplicate the prefix
        if (this.spinner) {
            this.spinner.text = this.message
        }
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
            Logger.emitToSink({ level: "spinner-clear", message: "", formatted: "" })
            return
        }
        if (this.spinner) {
            this.spinner.stop()
            this.spinner = null
        }
    }

    stopWithSuccess(msg: string): void {
        if (this.spinner) {
            this.spinner.stop()
            this.spinner = null
        }
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
            Logger.emitToSink({ level: "spinner-clear", message: "", formatted: "" })
        }
        Logger.success(msg)
    }

    stopWithError(msg: string): void {
        if (this.spinner) {
            this.spinner.stop()
            this.spinner = null
        }
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
            Logger.emitToSink({ level: "spinner-clear", message: "", formatted: "" })
        }
        Logger.error(msg)
    }

    stopWithCached(msg: string): void {
        if (this.spinner) {
            this.spinner.stop()
            this.spinner = null
        }
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
            Logger.emitToSink({ level: "spinner-clear", message: "", formatted: "" })
        }
        Logger.cached(msg)
    }

    updateMessage(msg: string): void {
        this.message = msg
        if (this.spinner) {
            this.spinner.text = msg
        }
        if (this.interval) {
            Logger.emitToSink({ level: "spinner", message: msg, formatted: this.formatSpinnerFrame("◐", msg) })
        }
    }
}
