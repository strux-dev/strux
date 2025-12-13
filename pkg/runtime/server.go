package runtime

import (
	"fmt"
	"log"
	"net/http"
)

// Start begins the IPC bridge and HTTP server
// It serves static files from ./frontend on port 8080
func Start(app interface{}) error {
	// Create and start IPC runtime (includes all built-in extensions)
	rt := New(app)
	if err := rt.Start(); err != nil {
		return fmt.Errorf("failed to start IPC server: %w", err)
	}
	defer rt.Stop()

	// Setup HTTP handler for static files
	handler := http.FileServer(http.Dir("./frontend"))

	// Start HTTP server
	log.Println("Strux: Starting HTTP server on :8080")
	log.Println("Strux: Serving static files from ./frontend")

	return http.ListenAndServe(":8080", handler)
}
