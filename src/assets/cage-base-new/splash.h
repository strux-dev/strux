#ifndef CG_SPLASH_H
#define CG_SPLASH_H

#include <stdbool.h>
#include <wayland-server-core.h>

struct cg_server;

struct cg_splash {
	struct cg_server *server;

	// Scene nodes for Wayland rendering
	struct wlr_scene_tree *tree;
	struct wlr_scene_rect *background;
	struct wlr_scene_buffer *image;

	bool visible;
	char *image_path;

	// Image dimensions (loaded from PNG)
	int image_width;
	int image_height;

	// Control socket for strux.boot.HideSplash()
	int control_fd;
	struct wl_event_source *control_source;
};

/**
 * Create the splash screen system.
 * Shows framebuffer splash immediately, sets up Wayland splash for later.
 */
struct cg_splash *splash_create(struct cg_server *server, const char *image_path);

/**
 * Transition from framebuffer to Wayland splash.
 * Call this after outputs are available.
 */
void splash_show_wayland(struct cg_splash *splash);

/**
 * Hide the splash screen (called via control socket).
 */
void splash_hide(struct cg_splash *splash);

/**
 * Destroy the splash and cleanup resources.
 */
void splash_destroy(struct cg_splash *splash);

/**
 * Update splash position when output geometry changes.
 */
void splash_update_geometry(struct cg_splash *splash, int screen_width, int screen_height);

#endif
