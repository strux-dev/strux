/***
 *
 *
 *  Main Entry Point for the Application
 *
 */

import { Command } from "commander"

const program = new Command()

program
    .name("strux")
    .description("A Framework for building Kiosk-Style operating systems")
    .version("0.0.1")

program.command("build")
    .argument("<bsp>", "The Board Support Package to build for")
    .option("--verbose", "Verbose output")
    .option("--clean", "Clean the build directory")