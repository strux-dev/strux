/***
 *
 *
 *  Running Utilities
 *
 */

import { Spinner, Logger } from "./log"
import { Settings } from "../settings"
import { mkdir } from "fs/promises"
import { join } from "path"

// @ts-ignore
import scriptsBaseDockerfile from "../assets/scripts-base/Dockerfile" with { type: "text" }

export interface RunnerOptions {
    message: string
    messageOnSuccess?: string
    messageOnError?: string
    alwaysShowOutput?: boolean
    cwd?: string
    exitOnError?: boolean
    env?: Record<string, string>
}

export class RunnerClass {

    private dockerImageBuilt = false

    /**
     * Gets the current user ID and group ID for passing to Docker container
     * Returns null on Windows (Docker Desktop handles permissions automatically)
     */
    private getHostUserInfo(): { uid: number; gid: number } | null {
        // On Windows, Docker Desktop handles permissions automatically
        if (process.platform === "win32") {
            return null
        }

        const uid = process.getuid?.()
        const gid = process.getgid?.()

        if (uid !== undefined && gid !== undefined) {
            return { uid, gid }
        }

        return null
    }

    public async runCommand(command: string, options: RunnerOptions) {
        const spinner = new Spinner(options.message)
        spinner.start()

        const args = command.split(" ")
        let stdout = ""
        let stderr = ""

        const proc = Bun.spawn(args, {
            stdout: "pipe",
            stderr: "pipe",
            cwd: options.cwd ?? process.cwd(),
            env: options.env ?? process.env
        })

        // Process stdout stream
        const stdoutPromise = (async () => {
            const decoder = new TextDecoder()
            for await (const chunk of proc.stdout) {
                const text = decoder.decode(chunk, { stream: true })
                stdout += text

                // Output stdout if verbose is enabled
                if (Settings.verbose) {
                    process.stdout.write(text)
                }

                // Parse for progress markers line by line
                const lines = text.split("\n")
                for (const line of lines) {
                    const marker = "STRUX_PROGRESS:"
                    const idx = line.indexOf(marker)
                    if (idx >= 0) {
                        const msg = line.substring(idx + marker.length).trim()
                        if (msg) {
                            spinner.updateMessage(msg)
                        }
                    }
                }
            }
        })()

        // Process stderr stream
        const stderrPromise = (async () => {
            const decoder = new TextDecoder()
            for await (const chunk of proc.stderr) {
                const text = decoder.decode(chunk, { stream: true })
                stderr += text

                // Output stderr if verbose is enabled
                if (Settings.verbose) {
                    process.stderr.write(text)
                }
            }
        })()

        // Wait for both streams to finish and process to exit
        await Promise.all([stdoutPromise, stderrPromise])
        const exitCode = await proc.exited

        if (exitCode === 0) {
            const successMessage = options.messageOnSuccess ?? options.message
            spinner.stopWithSuccess(successMessage)
        } else {
            const errorMessage = options.messageOnError ?? `Command failed with exit code ${exitCode}`
            spinner.stop()
            Logger.error(errorMessage)
            if (stderr) {
                Logger.error(stderr)
            }
            if (options.exitOnError) {
                process.exit(exitCode)
            }
        }

        return {
            exitCode,
            stdout,
            stderr
        }
    }

    // Prepares the Docker Image and Folder
    public async prepareDockerImage() {
        const spinner = new Spinner("Creating dist folder...")
        spinner.start()

        try {
            await mkdir(join(Settings.projectPath, "dist", "artifacts"), { recursive: true })
            spinner.stopWithSuccess("Creating dist folder...")
        } catch (error) {
            spinner.stop()
            Logger.error("Failed to create dist/artifacts folder. Please create it manually.")
            if (error instanceof Error) {
                Logger.error(error.message)
            }
            process.exit(1)
        }

        // Copy the dockerfile into dist/artifacts folder in the project directory
        await Bun.write(join(Settings.projectPath, "dist", "artifacts", "Dockerfile"), scriptsBaseDockerfile)

        // Build Docker image using the Dockerfile
        await this.runCommand("docker build -t strux-builder -f dist/artifacts/Dockerfile .", {
            message: "Building Docker image...",
            exitOnError: true,
            cwd: Settings.projectPath
        })


    }

    public async runScriptInDocker(script: string, options: Omit<RunnerOptions, "cwd">) {
        if (!this.dockerImageBuilt) await this.prepareDockerImage()

        const spinner = new Spinner(options.message)
        spinner.start()

        // Build the script with chown at the end to fix permissions
        const userInfo = this.getHostUserInfo()
        let finalScript = script

        // Append chown command to fix permissions after script execution
        // Docker runs as root, so it can chown the mounted volume
        // Note: chown works with numeric UID/GID even if the user doesn't exist in the container
        // The host system will resolve these IDs to the actual user/group names
        if (userInfo) {
            finalScript = `${script} && chown -R ${userInfo.uid}:${userInfo.gid} /project`
        }

        // Build environment variable flags for Docker
        const envFlags: string[] = []
        if (options.env) {
            for (const [key, value] of Object.entries(options.env)) {
                envFlags.push("-e", `${key}=${value}`)
            }
        }

        const command = `docker run --rm ${envFlags.join(" ")} -v ${Settings.projectPath}:/project strux-builder /bin/sh -c`

        const args = [...command.split(" "), finalScript]
        let stdout = ""
        let stderr = ""

        const proc = Bun.spawn(args, {
            stdout: "pipe",
            stderr: "pipe",
        })

        // Process stdout stream
        const stdoutPromise = (async () => {
            const decoder = new TextDecoder()
            for await (const chunk of proc.stdout) {
                const text = decoder.decode(chunk, { stream: true })
                stdout += text

                // Output stdout if verbose is enabled
                if (Settings.verbose) {
                    process.stdout.write(text)
                }

                // Parse for progress markers line by line
                const lines = text.split("\n")
                for (const line of lines) {
                    const marker = "STRUX_PROGRESS:"
                    const idx = line.indexOf(marker)
                    if (idx >= 0) {
                        const msg = line.substring(idx + marker.length).trim()
                        if (msg) {
                            spinner.updateMessage(msg)
                        }
                    }
                }
            }
        })()

        // Process stderr stream
        const stderrPromise = (async () => {
            const decoder = new TextDecoder()
            for await (const chunk of proc.stderr) {
                const text = decoder.decode(chunk, { stream: true })
                stderr += text

                // Output stderr if verbose is enabled
                if (Settings.verbose) {
                    process.stderr.write(text)
                }
            }
        })()

        // Wait for both streams to finish and process to exit
        await Promise.all([stdoutPromise, stderrPromise])
        const exitCode = await proc.exited

        if (exitCode === 0) {
            const successMessage = options.messageOnSuccess ?? options.message
            spinner.stopWithSuccess(successMessage)
        } else {
            const errorMessage = options.messageOnError ?? `Command failed with exit code ${exitCode}`
            spinner.stop()
            Logger.error(errorMessage)
            if (stderr) {
                Logger.error(stderr)
            }
            if (options.exitOnError) {
                process.exit(exitCode)
            }
        }

        return {
            exitCode,
            stdout,
            stderr
        }
    }

}

export const Runner = new RunnerClass()