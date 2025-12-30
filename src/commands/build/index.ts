/***
 *
 *
 *  Build Command
 *
 */

import { Settings } from "../../settings"
import { Runner } from "../../utils/run"

import scriptBuildFrontend from "../../assets/scripts-base/strux-build-frontend.sh" with { type: "text" }
import scriptBuildApp from "../../assets/scripts-base/strux-build-app.sh" with { type: "text" }

export async function build() {


    // TODO: Copy strux.plymouth into the dist/artifacts folder in the project directory
    // TODO: Copy strux.script into the dist/artifacts folder in the project directory
    // TODO: Copy plymouthd.conf into the dist/artifacts folder in the project directory


}


async function compileFrontend() {

    // Use the strux types command to refresh the strux.d.ts file
    await Runner.runCommand("strux types", {
        message: "Generating TypeScript types...",
        messageOnError: "Failed to generate TypeScript types. Please generate them manually.",
        exitOnError: true,
        cwd: Settings.projectPath
    })


    await Runner.runScriptInDocker(scriptBuildFrontend, {
        message: "Compiling Frontend...",
        messageOnError: "Failed to compile Frontend. Please check the build logs for more information.",
        exitOnError: true,
    })


}


async function compileApplication() {

    await Runner.runScriptInDocker(scriptBuildApp, {
        message: "Compiling Application...",
        messageOnError: "Failed to compile Application. Please check the build logs for more information.",
        exitOnError: true,
    })


}