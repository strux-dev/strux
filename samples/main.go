package main

// App is the main application struct for testing strux-introspect
// All public fields and methods are exposed to the frontend
type App struct {
	// Title is displayed in the window
	Title string

	// Counter is a simple state example
	Counter int

	// Enabled shows boolean field support
	Enabled bool
}

// Greet returns a greeting message
func (a *App) Greet(name string) string {
	return "Hello, " + name + "!"
}

// Add adds two numbers together
func (a *App) Add(x, y float64) float64 {
	return x + y
}

// SetCounter updates the counter value
func (a *App) SetCounter(value int) {
	a.Counter = value
}

// GetItems returns a slice example
func (a *App) GetItems() []string {
	return []string{"item1", "item2"}
}

func main() {
	_ = &App{
		Title:   "Sample App",
		Counter: 0,
		Enabled: true,
	}
}
