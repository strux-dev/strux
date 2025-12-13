/***
 *
 *
 *  Configuration Types
 *
 */

import { z } from "zod"
import { isGitOrUrl, validateSourceExists } from "../utils/url"
import { validateFileExists, validateDirectoryExists, directoryExists } from "../utils/path"

// Zod schema for configuration validation
export const ConfigSchema = z.object({
    v: z.string(), // The version of strux this project was build with
    name: z.string(), // The name of the project

    output: z.string().default("./dist"), // The output directory for the build (defaults to ./dist)

    display: z.object({
        resolution: z.string()
            .regex(/^\d+x\d+$/, {
                message: "Resolution must be in format 'number x number' (e.g., '1920x1080')",
            })
            .default("1920x1080"), // The resolution of the display (defaults to 1920x1080)
        initial_load_color: z.string()
            .transform((val) => val.startsWith("#") ? val.slice(1) : val)
            .default("000000"), // The color of the initial load screen (defaults to #000000) - automatically strips # prefix
    }),

    arch: z.enum(["arm64", "x86_64"]), // The architecture to build for

    bsp: z.string(), // The BSP to build for (must be a valid BSP from the BSPs directory)
    hostname: z.string().default("strux"), // The hostname of the device (defaults to strux)

    boot: z.object({
        splash: z.object({
            enabled: z.boolean().default(true), // Whether to show a splash screen (defaults to true)
            logo: z.string().default("./assets/logo.png"), // The logo to show on the splash screen (defaults to ./assets/logo.png)
        }),
        bootloader: z.object({
            enabled: z.boolean().default(false), // Whether or not to build a bootloader (defaults to false)
            type: z.enum(["u-boot", "grub"]).default("u-boot"), // The bootloader to use (defaults to "u-boot")
            version: z.string().optional(), // The version of the bootloader to use
            source: z.string()
                .optional()
                .refine((val) => !val || isGitOrUrl(val), {
                    message: "source must be a valid git repository or URL",
                }), // The custom source for the bootloader (defaults to github.com/u-boot/u-boot)
            defconfig: z.string(), // The defconfig for the bootloader (defaults to the defconfig for the board)
            fragments: z.array(z.string()).default([]), // The fragments to build the bootloader with (defaults to the fragments for the board)
        }).optional(),
        kernel: z.object({
            source: z.string()
                .optional()
                .refine((val) => !val || isGitOrUrl(val), {
                    message: "source must be a valid git repository or URL",
                }), // The custom source for the kernel (defaults to the default debian kernel source)
            version: z.string().optional(), // The version of the kernel to use
            defconfig: z.string(), // The defconfig for the kernel (defaults to the defconfig for the board)
            fragments: z.array(z.string()).default([]), // The fragments to build the kernel with (defaults to the fragments for the board)
        }).optional(),
        service_files: z.array(z.string()).default([]), // The service files to install into the rootfs for custom services
    }),

    rootfs: z.object({
        overlay: z.string().default("./overlay"), // The path for the overlay for the rootfs (defaults to ./overlay)
        packages: z.array(z.string()), // The packages to install into the rootfs
        deb_packages: z.array(z.string()).default([]), // Paths to .deb files to install into the rootfs
    }),

    qemu: z.object({
        network: z.boolean().default(true), // Whether or not to enable network support in qemu (default to true)
        usb: z.array(z.object({
            vendor_id: z.string(),
            product_id: z.string(),
        })).default([]), // USB device configurations
        flags: z.array(z.string()).default([]), // The flags to pass to qemu (defaults to [])
    }),

    build: z.object({
        host_packages: z.array(z.string()).default([]),
    }),
})

// Infer TypeScript type from Zod schema
export type Config = z.infer<typeof ConfigSchema>

// Validation function
export function validateConfig(data: unknown): Config {
    return ConfigSchema.parse(data)
}

// Safe validation function that returns a result instead of throwing
export function safeValidateConfig(data: unknown): { success: true; data: Config } | { success: false; error: z.ZodError } {
    const result = ConfigSchema.safeParse(data)
    if (result.success) {
        return { success: true, data: result.data }
    }
    return { success: false, error: result.error }
}

// Async validation function that also checks if URLs and file paths exist
export async function validateConfigWithUrlCheck(data: unknown): Promise<{ success: true; data: Config } | { success: false; error: z.ZodError | Error }> {
    // First validate the structure
    const structureResult = ConfigSchema.safeParse(data)
    if (!structureResult.success) {
        return { success: false, error: structureResult.error }
    }

    const config = structureResult.data

    try {
        // Validate file and directory paths
        // Output directory - check parent exists (output dir might be created)
        if (config.output !== "." && config.output !== "..") {
            const pathParts = config.output.split("/").filter(Boolean)
            if (pathParts.length > 1) {
                const outputParent = pathParts.slice(0, -1).join("/")
                if (outputParent && !directoryExists(outputParent)) {
                    throw new Error(`Output directory parent does not exist: ${outputParent}`)
                }
            }
        }

        // Boot splash logo file
        validateFileExists(config.boot.splash.logo, "boot.splash.logo")

        // Boot service files (if specified)
        if (config.boot.service_files && config.boot.service_files.length > 0) {
            for (const serviceFile of config.boot.service_files) {
                validateFileExists(serviceFile, "boot.service_files")
            }
        }

        // Rootfs overlay directory (if specified)
        if (config.rootfs.overlay) {
            validateDirectoryExists(config.rootfs.overlay, "rootfs.overlay")
        }

        // Rootfs deb packages (if specified)
        if (config.rootfs.deb_packages) {
            for (const debPath of config.rootfs.deb_packages) {
                validateFileExists(debPath, "rootfs.deb_packages")
            }
        }

        // BSP directory
        validateDirectoryExists(config.bsp, "bsp")

        // Check bootloader source URL if present (skip defconfig and fragments per user request)
        if (config.boot?.bootloader?.source) {
            const exists = await validateSourceExists(config.boot.bootloader.source)
            if (!exists) {
                throw new Error(`Bootloader source "${config.boot.bootloader.source}" is not accessible`)
            }
        }

        // Check kernel source URL if present (skip defconfig and fragments per user request)
        if (config.boot?.kernel?.source) {
            const exists = await validateSourceExists(config.boot.kernel.source)
            if (!exists) {
                throw new Error(`Kernel source "${config.boot.kernel.source}" is not accessible`)
            }
        }

        return { success: true, data: config }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
        }
    }
}