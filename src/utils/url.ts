/***
 *
 *  URL Utility Functions
 *
 */

/**
 * Checks if a string is a valid git repository URL or identifier
 * Supports:
 * - https://host/user/repo.git (HTTPS)
 * - http://host/user/repo.git (HTTP)
 * - git://host/user/repo.git (Git protocol)
 * - host/user/repo (without protocol)
 * - user/repo (short form, assumes GitHub)
 */
export function isValidGitSource(source: string): boolean {
    // Full URL formats: https://, http://, git://
    if (/^(https?|git):\/\/[\w.-]+(\/[\w.-]+)+(\/)?(\.git)?$/.test(source)) {
        return true
    }

    // Host/user/repo format (e.g., github.com/user/repo)
    if (/^[\w.-]+\/[\w.-]+\/[\w.-]+(\/)?(\.git)?$/.test(source)) {
        return true
    }

    // Short form: user/repo (assumes GitHub)
    if (/^[\w.-]+\/[\w.-]+$/.test(source)) {
        return true
    }

    return false
}

/**
 * Checks if a string is a valid URL
 */
export function isValidUrl(source: string): boolean {
    try {
        new URL(source)
        return true
    } catch {
        return false
    }
}

/**
 * Checks if a string is either a git repository or a URL
 */
export function isGitOrUrl(source: string): boolean {
    return isValidGitSource(source) || isValidUrl(source)
}

/**
 * Validates that a URL exists by making a HEAD request
 * Returns true if the URL is accessible, false otherwise
 */
export async function validateUrlExists(url: string): Promise<boolean> {
    try {
        new URL(url) // Validate URL format
        const response = await fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000), // 5 second timeout
        })
        return response.ok || response.status === 405 // 405 Method Not Allowed is still valid
    } catch {
        return false
    }
}

/**
 * Validates that a git source or URL exists
 * For git sources, checks if the repository URL is accessible
 * For regular URLs, checks if the URL exists
 */
export async function validateSourceExists(source: string): Promise<boolean> {
    if (isValidGitSource(source)) {
        // Convert git source to URL format for checking
        let url: string

        // Handle short form: user/repo -> https://github.com/user/repo
        if (/^[\w.-]+\/[\w.-]+$/.test(source)) {
            url = `https://github.com/${source}`
        }
        // Handle host/user/repo format
        else if (/^[\w.-]+\/[\w.-]+\/[\w.-]+/.test(source)) {
            url = `https://${source.replace(/\.git$/, "")}`
        }
        // Handle full URLs
        else {
            url = source.replace(/^git:\/\//, "https://").replace(/\.git$/, "")
        }

        return validateUrlExists(url)
    } else if (isValidUrl(source)) {
        return validateUrlExists(source)
    }

    return false
}
