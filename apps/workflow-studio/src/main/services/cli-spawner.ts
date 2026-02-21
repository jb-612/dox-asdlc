import { BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { CLISpawnConfig, CLISession } from '../../shared/types/cli';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// CLISpawner
//
// Manages child processes for Claude CLI sessions. Each spawn creates a real
// OS process via child_process.spawn. stdout/stderr are forwarded to the
// renderer via IPC events. The spawner tracks all active sessions and
// provides kill / write / list operations.
// ---------------------------------------------------------------------------

export class CLISpawner {
  private sessions = new Map<string, { process: ChildProcess; session: CLISession }>();
  private mainWindow: BrowserWindow | null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Spawn a new CLI child process using the provided configuration.
   *
   * Returns a CLISession descriptor immediately. Output, exit, and error
   * events are pushed to the renderer asynchronously.
   */
  spawn(config: CLISpawnConfig): CLISession {
    const id = uuidv4();
    const env = { ...process.env, ...config.env };
    if (config.instanceId) {
      env.CLAUDE_INSTANCE_ID = config.instanceId;
    }

    const child = spawn(config.command, config.args, {
      cwd: config.cwd,
      env,
      shell: true,
    });

    const session: CLISession = {
      id,
      config,
      status: 'running',
      pid: child.pid,
      startedAt: new Date().toISOString(),
    };

    child.stdout?.on('data', (data: Buffer) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_OUTPUT, {
        sessionId: id,
        data: data.toString(),
      });
    });

    child.stderr?.on('data', (data: Buffer) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_OUTPUT, {
        sessionId: id,
        data: data.toString(),
      });
    });

    child.on('exit', (code) => {
      session.status = 'exited';
      session.exitCode = code ?? undefined;
      session.exitedAt = new Date().toISOString();
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_EXIT, {
        sessionId: id,
        exitCode: code,
      });
    });

    child.on('error', (err) => {
      session.status = 'error';
      this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_ERROR, {
        sessionId: id,
        error: err.message,
      });
    });

    this.sessions.set(id, { process: child, session });
    return session;
  }

  /**
   * Send SIGTERM to the session process. If it does not exit within 5
   * seconds, escalate to SIGKILL.
   */
  kill(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    entry.process.kill('SIGTERM');
    setTimeout(() => {
      if (!entry.process.killed) entry.process.kill('SIGKILL');
    }, 5000);
    return true;
  }

  /**
   * Write data to the stdin of the session process.
   */
  write(sessionId: string, data: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    return entry.process.stdin?.write(data) ?? false;
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
