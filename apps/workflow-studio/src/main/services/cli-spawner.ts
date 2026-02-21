import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import type { CLISpawnConfig, CLISession } from '../../shared/types/cli';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// CLISpawner
//
// Manages pseudo-terminal (PTY) processes for Claude CLI sessions using
// node-pty. Each spawn creates a real PTY via pty.spawn, which provides
// proper terminal emulation (colours, cursor control, interactive prompts).
// Data events are forwarded to the renderer via IPC. The spawner tracks all
// active sessions and provides kill / write / list operations.
// ---------------------------------------------------------------------------

interface PTYEntry {
  pty: pty.IPty;
  session: CLISession;
}

export class CLISpawner {
  private sessions = new Map<string, PTYEntry>();
  private mainWindow: BrowserWindow | null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Spawn a new CLI process inside a PTY using the provided configuration.
   *
   * Returns a CLISession descriptor immediately. Output and exit events are
   * pushed to the renderer asynchronously via IPC.
   */
  spawn(config: CLISpawnConfig): CLISession {
    const id = uuidv4();
    const env: Record<string, string> = {};

    // Copy current process env as strings
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Merge config env
    if (config.env) {
      Object.assign(env, config.env);
    }

    if (config.instanceId) {
      env.CLAUDE_INSTANCE_ID = config.instanceId;
    }

    // Build the shell command to execute
    const shell = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
    const shellArgs = process.platform === 'win32'
      ? ['/c', config.command, ...config.args]
      : ['-c', [config.command, ...config.args].join(' ')];

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cwd: config.cwd,
      env,
      cols: 120,
      rows: 30,
    });

    const session: CLISession = {
      id,
      config,
      status: 'running',
      pid: ptyProcess.pid,
      startedAt: new Date().toISOString(),
    };

    // node-pty combines stdout/stderr into a single data stream
    ptyProcess.onData((data: string) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_OUTPUT, {
        sessionId: id,
        data,
      });
    });

    ptyProcess.onExit(({ exitCode }) => {
      session.status = 'exited';
      session.exitCode = exitCode;
      session.exitedAt = new Date().toISOString();
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_EXIT, {
        sessionId: id,
        exitCode,
      });
    });

    this.sessions.set(id, { pty: ptyProcess, session });
    return session;
  }

  /**
   * Send kill signal to the session PTY. If it does not exit within 5
   * seconds, escalate to a forced kill.
   */
  kill(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;

    entry.pty.kill();

    setTimeout(() => {
      // Attempt a second kill in case the first didn't terminate
      try {
        entry.pty.kill();
      } catch {
        // Process may have already exited
      }
    }, 5000);

    return true;
  }

  /**
   * Write data to the stdin of the session PTY.
   */
  write(sessionId: string, data: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    entry.pty.write(data);
    return true;
  }

  /**
   * Return a snapshot of all tracked CLI sessions.
   */
  list(): CLISession[] {
    return Array.from(this.sessions.values()).map((e) => e.session);
  }

  /**
   * Kill every tracked session. Called during app shutdown.
   */
  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }
}
