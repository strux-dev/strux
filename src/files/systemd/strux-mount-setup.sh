#!/bin/bash

function log(){
    echo $@ | tee /dev/console
}

log "=== Strux Mount Setup Starting ==="

# Load 9p module if not already loaded
log "Loading 9p filesystem module..."
modprobe 9p 2>&1 | tee -a /dev/console || log "9p module already loaded or not available"
modprobe 9pnet 2>&1 | tee -a /dev/console || log "9pnet module already loaded or not available"
modprobe 9pnet_virtio 2>&1 | tee -a /dev/console || log "9pnet_virtio module already loaded or not available"

# Wait a bit for virtio devices to be ready
log "Waiting for virtio devices..."

sleep 2

# Check if virtio-9p device exists
log "Checking for virtio-9p device..."

if [ -d /sys/bus/virtio/devices ]; then
    log "Virtio devices directory exists"
    
    ls -la /sys/bus/virtio/devices/ | tee -a /dev/console || true
else
    log "WARNING: /sys/bus/virtio/devices does not exist"
    
fi

# Check if already mounted
if mountpoint -q /strux; then
    log "strux already mounted"
    
    mount | grep strux | tee -a /dev/console || true
else
    log "Attempting to mount virtfs..."
    
    mkdir -p /strux
    MOUNT_SUCCESS=0
    for i in 1 2 3 4 5 6 7 8 9 10; do
        log "Mount attempt $i..."
        
        if mount -t 9p -o trans=virtio,version=9p2000.L strux /strux 2>&1 | tee -a /dev/console; then
            log "virtfs mounted successfully on attempt $i"
            
            MOUNT_SUCCESS=1
            break
        else
            log "Mount failed, retrying..."
            
            sleep 1
        fi
    done
    
    if [ "$MOUNT_SUCCESS" = "0" ]; then
        log "ERROR: Failed to mount virtfs after 10 attempts"
        
        log "Checking available mounts..."
        
        mount | grep 9p | tee -a /dev/console || log "No 9p mounts found"
        log "Checking /strux directory..."
        
        ls -la /strux/ | tee -a /dev/console || true
    fi
fi

# Verify mount and create symlink if app exists
if mountpoint -q /strux; then
    log "Mount verified, checking contents..."
    
    ls -la /strux/ | tee -a /dev/console || true
    
    if [ -x /strux/app ]; then
        ln -sf /strux/app /usr/bin/strux-app || true
        log "Created symlink to /strux/app"
        
    else
        log "WARNING: /strux/app not found or not executable"
        
        log "Contents of /strux:"
        
        ls -la /strux/ | tee -a /dev/console || true
    fi
else
    log "ERROR: /strux is not mounted!"
    
fi

log "=== Strux Mount Setup Complete ==="
