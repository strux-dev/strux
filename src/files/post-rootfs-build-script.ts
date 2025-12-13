/***
 *
 *
 *  Post RootFS Build Script
 *
 */

import type { Config } from "../types/config"

export const POST_ROOTFS_BUILD_SCRIPT = function(config: Config) {
    return `#!/bin/bash

set -e

progress() {
    echo "STRUX_PROGRESS: $1"
}

progress "Post-processing Root Filesystem..."

mkdir -p /tmp/rootfs

# Extract the cached base rootfs
tar -xzf /project/dist/.cache/rootfs-base.tar.gz -C /tmp/rootfs

ROOTFS_DIR="/tmp/rootfs"

${config.rootfs.overlay ? `# Apply rootfs overlay
progress "Applying rootfs overlay..."
if [ -d "${config.rootfs.overlay}" ]; then
    # Use rsync to copy overlay files, preserving permissions and overwriting existing files
    # -a: archive mode (preserves permissions, timestamps, etc.)
    # -r: recursive
    # --no-owner: don't preserve ownership (we're copying into rootfs)
    # --no-group: don't preserve group (we're copying into rootfs)
    rsync -a --no-owner --no-group "${config.rootfs.overlay}/" "$ROOTFS_DIR/"
    echo "Rootfs overlay applied successfully"
else
    echo "Warning: Overlay directory '${config.rootfs.overlay}' does not exist, skipping overlay"
fi
` : ""}

`
}