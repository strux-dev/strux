//
// Strux Client - Exec Manager
//
// Provides interactive shell sessions over WebSocket using a PTY.
//

package main

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

type ExecSession struct {
	id   string
	cmd  *exec.Cmd
	pty  *os.File
	done chan struct{}
}

type ExecManager struct {
	sessions map[string]*ExecSession
	mu       sync.Mutex
	logger   *Logger
	onOutput func(sessionID, stream, data string)
	onExit   func(sessionID string, code int)
	onError  func(sessionID string, err error)
}

func NewExecManager(onOutput func(string, string, string), onExit func(string, int), onError func(string, error)) *ExecManager {
	return &ExecManager{
		sessions: make(map[string]*ExecSession),
		logger:   NewLogger("ExecManager"),
		onOutput: onOutput,
		onExit:   onExit,
		onError:  onError,
	}
}

func (m *ExecManager) Start(sessionID string, shell string) error {
	m.mu.Lock()
	if _, exists := m.sessions[sessionID]; exists {
		m.mu.Unlock()
		return fmt.Errorf("session already exists: %s", sessionID)
	}
	m.mu.Unlock()

	shellPath := shell
	if shellPath == "" || !fileExists(shellPath) {
		if fileExists("/bin/bash") {
			shellPath = "/bin/bash"
		} else {
			shellPath = "/bin/sh"
		}
	}

	cmd := exec.Command(shellPath)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}

	session := &ExecSession{
		id:   sessionID,
		cmd:  cmd,
		pty:  ptmx,
		done: make(chan struct{}),
	}

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	go m.readLoop(session)
	go m.waitLoop(session)

	m.logger.Info("Started exec session: %s", sessionID)
	return nil
}

func (m *ExecManager) SendInput(sessionID string, data string) error {
	m.mu.Lock()
	session, exists := m.sessions[sessionID]
	m.mu.Unlock()

	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	_, err := session.pty.Write([]byte(data))
	return err
}

func (m *ExecManager) Stop(sessionID string) {
	m.mu.Lock()
	session, exists := m.sessions[sessionID]
	if exists {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if !exists {
		return
	}

	close(session.done)
	if session.cmd.Process != nil {
		_ = session.cmd.Process.Kill()
	}
	if session.pty != nil {
		_ = session.pty.Close()
	}
}

func (m *ExecManager) StopAll() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()

	for _, id := range ids {
		m.Stop(id)
	}
}

func (m *ExecManager) readLoop(session *ExecSession) {
	buf := make([]byte, 4096)

	for {
		select {
		case <-session.done:
			return
		default:
		}

		n, err := session.pty.Read(buf)
		if err != nil {
			if m.onError != nil {
				m.onError(session.id, err)
			}
			return
		}

		if n > 0 && m.onOutput != nil {
			m.onOutput(session.id, "stdout", string(buf[:n]))
		}
	}
}

func (m *ExecManager) waitLoop(session *ExecSession) {
	err := session.cmd.Wait()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	if m.onExit != nil {
		m.onExit(session.id, exitCode)
	}

	m.Stop(session.id)
}
