/***
 *
 *
 *  Run Tool - QEMU Emulator
 *
 */


import { Settings } from "../../settings"
import { Logger } from "../../utils/log"
import { stat, readdir } from "fs/promises"
import { join } from "path"
import { fileExists } from "../../utils/path"
import { MainYAMLValidator } from "../../types/main-yaml"
import { BSPYamlValidator } from "../../types/bsp-yaml"

async function run() {

    // Validate the Strux YAML
    MainYAMLValidator.validateAndLoad()

    // Validate the BSP YAML, This auto selects the QEMU BSP
    BSPYamlValidator.validateAndLoad()

    await verifyArtifactsExist()

    let qemuBin: string | null = null
    const baseQemuArgs: string[] = []
    let machineType = ""
    const consoleArgs: string[] = []
    let displayOpt = ""
    const displayArgs: string[] = []
    let gpuDevice = ""
    const accelArgs: string[] = []

    if (Settings.targetArch === "x86_64") {qemuBin = "qemu-system-x86_64"; machineType = "q35" }
    if (Settings.targetArch === "arm64") {qemuBin = "qemu-system-aarch64"; machineType = "virt" }


    if (!qemuBin) Logger.errorWithExit("Unsupported architecture. Please use a supported architecture.")

    if (Settings.targetArch === "x86_64") consoleArgs.push("root=/dev/vda", "rw", ...(Settings.qemuSystemDebug ? ["console=tty1", "console=ttyS0"] : ["quiet", "splash", "loglevel=0", "logo.nologo", "vt.handoff=7", "rd.plymouth.show-delay=0", "plymouth.ignore-serial-consoles", "systemd.show_status=false", "console=tty1", "console=ttyS0"]), "fbcon=map:0", "vt.global_cursor_default=0", `video=Virtual-1:${Settings.bsp!.display!.height}x${Settings.bsp!.display!.width}@60`)
    if (Settings.targetArch === "arm64") consoleArgs.push("root=/dev/vda", "rw", ...(Settings.qemuSystemDebug ? ["console=ttyAMA0", "console=ttyS0"] : ["quiet", "splash", "loglevel=0", "logo.nologo", "vt.handoff=7", "rd.plymouth.show-delay=0", "plymouth.ignore-serial-consoles", "systemd.show_status=false", "console=tty1", "console=ttyAMA0"]), "fbcon=map:0", "vt.global_cursor_default=0", `video=${Settings.bsp!.display!.height}x${Settings.bsp!.display!.width}`)


    if (Settings.targetArch === "x86_64" && process.platform === "darwin") {
        displayOpt = "cocoa"
        gpuDevice = `virtio-gpu-pci,xres=${Settings.bsp!.display!.width},yres=${Settings.bsp!.display!.height}`
        accelArgs.push("-accel", "hvf", "-cpu", "host")
    }
    if (Settings.targetArch === "x86_64" && process.platform !== "darwin") {

        // Auto-detect GPU and enable GL for Intel/AMD
        if (await shouldUseGL()) {
            // Use virtio-vga-gl with SDL (more reliable GL context than GTK)
            displayOpt = "sdl,gl=on"
            gpuDevice = "virtio-vga-gl"
        } else {
            // QXL for NVIDIA/unknown (software rendering but correct resolution)
            displayOpt = "gtk"
            gpuDevice = `qxl-vga,xres=${Settings.bsp!.display!.width},yres=${Settings.bsp!.display!.height}`

        }

        accelArgs.push("-accel", "kvm", "-cpu", "host")

    }
    if (Settings.targetArch === "arm64" && process.platform === "darwin") {
        displayOpt = "cocoa"
        gpuDevice = `virtio-gpu-pci,xres=${Settings.bsp!.display!.width},yres=${Settings.bsp!.display!.height}`
        accelArgs.push("-accel", "hvf", "-cpu", "host")
    }
    if (Settings.targetArch === "arm64" && process.platform !== "darwin") {

        // Auto-detect GPU for ARM64 emulation as well
        if (await shouldUseGL()) {
            displayOpt = "gtk,gl=on"
            gpuDevice = `virtio-gpu-gl-pci,xres=${Settings.bsp!.display!.width},yres=${Settings.bsp!.display!.height}`
        } else {
            displayOpt = "gtk"
            gpuDevice = `virtio-gpu-pci,xres=${Settings.bsp!.display!.width},yres=${Settings.bsp!.display!.height}`
        }
        accelArgs.push("-cpu", "cortex-a57")
    }


    // Build the QEMU Arguments
    const args: string = [
        "-machine", machineType,
        "-m", "2048",
        "-device", gpuDevice,
        "-display", displayOpt,
        "-device", "qemu-xhci",
        "-device", "usb-kbd",
        "-device", "usb-tablet",
        "-drive", "file=dist/cache/rootfs-post.ext4,format=raw,if=virtio",
        "-kernel", "dist/cache/vmlinuz",
        "-initrd", "dist/cache/initrd.img",
        "-append", consoleArgs.join(" "),
        "-serial", "mon:stdio",
        ...accelArgs,

        // Network
        "-netdev", "user,id=net0",
        "-device", "virtio-net-pci,netdev=net0"
    ]


}


// Detects the GPU vendor on Linux systems
async function detectGPUVendor(): Promise<"amd" | "intel" | "nvidia" | "unknown"> {


    if (process.platform !== "linux") return "unknown"

    try {

        const drmDirectory = "/sys/class/drm"
        const cards = await readdir(drmDirectory)

        // Check through all the entries in the DRM Directory
        for (const card of cards) {

            if (!card.startsWith("card")) continue

            const vendorPath = join(drmDirectory, card, "device", "vendor")

            try {
                const vendorFile = Bun.file(vendorPath)
                if (await vendorFile.exists()) {
                    const vendor = (await vendorFile.text()).trim()
                    switch (vendor) {
                        case "0x8086":
                            return "intel"
                        case "0x1002":
                            return "amd"
                        case "0x10de":
                            return "nvidia"
                    }
                }
            } catch {
                continue
            }


        }

    } catch {


        return "unknown"

    }

    return "unknown"


}

async function shouldUseGL() : Promise<boolean> {


    const env = process.env.STRUX_GL
    if (env !== undefined) {
        return env === "1"
    }

    // Auto-detect based on GPU vendor
    const vendor = await detectGPUVendor()
    switch (vendor) {
        case "intel":
        case "amd":
            Logger.info(`Detected ${vendor.toUpperCase()} GPU, enabling GL acceleration`)
            return true
        case "nvidia":
            Logger.info("Detected NVIDIA GPU, using software rendering (set STRUX_GL=1 to override)")
            return false
        default:
            Logger.info("Unknown GPU vendor, using software rendering (set STRUX_GL=1 to override)")
            return false
    }
}

async function verifyArtifactsExist(): Promise<void> {

    const artifacts = [
        { path: "dist/cache/vmlinuz", name: "Kernel" },
        { path: "dist/cache/initrd.img", name: "Initramfs" },
        { path: "dist/cache/rootfs.ext4", name: "Root Filesystem EXT4" }
    ]

    for (const artifact of artifacts) {
        if (!fileExists(join(Settings.projectPath, artifact.path))) return Logger.errorWithExit(`${artifact.name} not found. Please build the project first.`)
    }

}


