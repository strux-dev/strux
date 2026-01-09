#!/bin/bash

set -eo pipefail

# Trap errors and print the failing command/line
trap 'echo "Error: Command failed at line $LINENO with exit code $?: $BASH_COMMAND" >&2' ERR

# Define a Function to Print Progress Messages that will be used by the Strux CLI
progress() {
    echo "STRUX_PROGRESS: $1"
}

rm -rf /project/dist/cache/client

cd /project/dist/artifacts/client

progress "Installing Strux Client dependencies..."

bun install

# ============================================================================
# CONFIGURATION READING FROM YAML FILES
# ============================================================================
# Read the selected BSP from strux.yaml and get its architecture from bsp.yaml
# ============================================================================

progress "Reading configuration from YAML files..."

# Project directory (mounted at /project in Docker container)
PROJECT_DIR="/project"

# Get the active BSP name from strux.yaml
if [ -n "$PRESELECTED_BSP" ]; then
    BSP_NAME="$PRESELECTED_BSP"
else
    BSP_NAME=$(yq '.bsp' "$PROJECT_DIR/strux.yaml" 2>/dev/null || echo "")
fi

if [ -z "$BSP_NAME" ]; then
    echo "Error: Could not read BSP name from $PROJECT_DIR/strux.yaml"
    exit 1
fi

# Construct BSP folder path
BSP_FOLDER="$PROJECT_DIR/bsp/$BSP_NAME"
BSP_CONFIG="$BSP_FOLDER/bsp.yaml"

if [ ! -f "$BSP_CONFIG" ]; then
    echo "Error: BSP configuration file not found: $BSP_CONFIG"
    exit 1
fi

# Get architecture from BSP config
ARCH=$(yq '.bsp.arch' "$BSP_CONFIG" 2>/dev/null | xargs || echo "")

if [ -z "$ARCH" ]; then
    echo "Error: Could not read architecture from $BSP_CONFIG"
    exit 1
fi

# ============================================================================
# ARCHITECTURE MAPPING FOR BUN CROSS-COMPILATION
# ============================================================================
# Map Strux architecture to Bun target format
# ============================================================================

# Map architecture to Bun target
if [ "$ARCH" = "amd64" ] || [ "$ARCH" = "x86_64" ]; then
    BUN_TARGET="bun-linux-x64"
    ARCH_LABEL="x86_64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    BUN_TARGET="bun-linux-arm64"
    ARCH_LABEL="ARM64"
else
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
fi

progress "Building Strux Client for $ARCH_LABEL ($BUN_TARGET)..."

# ============================================================================
# BUN CLIENT BUILD
# ============================================================================
# Build the client binary with cross-compilation
# ============================================================================

# Ensure the cache directory exists
mkdir -p /project/dist/cache

# Build to a temp directory inside the container (not on the mounted virtiofs volume)
# This avoids cross-filesystem rename issues with Docker on macOS
BUILD_TMP="/tmp/strux-client-build"
mkdir -p "$BUILD_TMP"
cd "$BUILD_TMP"

# Build the binary in the container's local filesystem
bun build /project/dist/artifacts/client/index.ts --compile --target="$BUN_TARGET" --outfile "client-$BSP_NAME"

# Copy the built binary to the project cache directory
cp "client-$BSP_NAME" "/project/dist/cache/client-$BSP_NAME"

# Clean up temp directory
rm -rf "$BUILD_TMP"

progress "Strux Client built successfully"