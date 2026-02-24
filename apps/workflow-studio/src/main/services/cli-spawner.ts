import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';
import { execFile } from 'child_process';
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
//
// Supports two modes:
//  - local: spawn directly on the host (original behaviour)
//  - docker: spawn inside a Docker container via `docker run -it`
// ---------------------------------------------------------------------------

/** Maximum size (bytes) for the per-session output ring buffer. */
const OUTPUT_BUFFER_MAX = 1024 * 1024; // 1 MB

interface PTYEntry {
  pty: pty.IPty;
  session: CLISession;
  /** Bounded output buffer for back-pressure (T12). */
  outputBuffer: string;
}

interface DockerStatus {
  available: boolean;
  version?: string;
}

export class CLISpawner {
  private sessions = new Map<string, PTYEntry>();
  private mainWindow: BrowserWindow | null;

  /** Cached Docker status with 30-second TTL. */
  private dockerStatusCache: { status: DockerStatus; timestamp: number } | null = null;
  private static readonly DOCKER_CACHE_TTL = 30_000;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  // -------------------------------------------------------------------------
  // Docker status check (T03)
  // -------------------------------------------------------------------------

  /**
   * Check whether Docker is available on the host.
   * Result is cached for 30 seconds.
   */
  async getDockerStatus(): Promise<DockerStatus> {
    const now = Date.now();
    if (
      this.dockerStatusCache &&
      now - this.dockerStatusCache.timestamp < CLISpawner.DOCKER_CACHE_TTL
    ) {
      return this.dockerStatusCache.status;
    }

    const status = await this.checkDocker();
    this.dockerStatusCache = { status, timestamp: now };
    return status;
  }

  private checkDocker(): Promise<DockerStatus> {
    return new Promise((resolve) => {
      const child = execFile(
        'docker',
        ['version', '--format', '{{json .}}'],
        { timeout: 2000 },
        (err, stdout) => {
          if (err) {
            resolve({ available: false });
            return;
          }
          try {
            const parsed = JSON.parse(stdout);
            const version =
              parsed?.Client?.Version ?? parsed?.Server?.Version ?? undefined;
            resolve({ available: true, version });
          } catch {
            // docker returned non-JSON but exited 0 — it's available
            resolve({ available: true });
          }
        },
      );

      // Safety net: if execFile itself hangs beyond our timeout, clean up.
      child.on('error', () => {
        resolve({ available: false });
      });
    });
  }

  // -------------------------------------------------------------------------
  // Spawn — dispatches to local or docker mode (T04)
  // -------------------------------------------------------------------------

  /**
   * Spawn a new CLI process. Dispatches to local or docker based on config.mode.
   */
  spawn(config: CLISpawnConfig): CLISession {
    const mode = config.mode ?? 'local';
    if (mode === 'docker') {
      return this.spawnDocker(config);
    }
    return this.spawnLocal(config);
  }

  /**
   * Spawn a local CLI process inside a PTY (original behaviour).
   */
  private spawnLocal(config: CLISpawnConfig): CLISession {
    const id = uuidv4();
    const env = this.buildEnv(config);

    const ptyProcess = pty.spawn(config.command, config.args, {
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
      mode: 'local',
      context: config.context,
    };

    this.wireSession(id, ptyProcess, session);
    return session;
  }

  /**
   * Spawn a Docker-backed CLI session (T04).
   *
   * Builds a `docker run -it --rm` command and runs it through node-pty
   * so the same PTY → IPC → xterm.js pipeline is used.
   */
  private spawnDocker(config: CLISpawnConfig): CLISession {
    const id = uuidv4();
    const env = this.buildEnv(config);

    const image = config.dockerImage || 'ghcr.io/anthropics/claude-code:latest';
    const dockerArgs: string[] = ['run', '-it', '--rm'];

    // Linux host networking workaround
    dockerArgs.push('--add-host=host.docker.internal:host-gateway');

    // Mount repo if provided
    if (config.context?.repoPath) {
      dockerArgs.push('-v', `${config.context.repoPath}:/workspace`);
      dockerArgs.push('-w', '/workspace');
    }

    // Inject context as env vars
    if (config.context?.githubIssue) {
      dockerArgs.push('-e', `GITHUB_ISSUE=${config.context.githubIssue}`);
    }

    if (config.instanceId) {
      dockerArgs.push('-e', `CLAUDE_INSTANCE_ID=${config.instanceId}`);
    }

    // Propagate any custom env vars
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    dockerArgs.push(image);

    // Append the command + args to run inside the container
    dockerArgs.push(config.command);
    if (config.args.length > 0) {
      dockerArgs.push(...config.args);
    }

    // Append system prompt if provided via context
    if (config.context?.systemPrompt) {
      dockerArgs.push('--system-prompt', config.context.systemPrompt);
    }

    const ptyProcess = pty.spawn('docker', dockerArgs, {
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
      mode: 'docker',
      context: config.context,
    };

    this.wireSession(id, ptyProcess, session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  private buildEnv(config: CLISpawnConfig): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    if (config.env) {
      Object.assign(env, config.env);
    }
    if (config.instanceId) {
      env.CLAUDE_INSTANCE_ID = config.instanceId;
    }
    return env;
  }

  /**
   * Wire PTY data/exit events and register the session (shared by both modes).
   * Includes bounded output buffer for back-pressure (T12).
   */
  private wireSession(id: string, ptyProcess: pty.IPty, session: CLISession): void {
    const entry: PTYEntry = { pty: ptyProcess, session, outputBuffer: '' };

    ptyProcess.onData((data: string) => {
      // Bounded buffer: cap at OUTPUT_BUFFER_MAX characters
      entry.outputBuffer += data;
      if (entry.outputBuffer.length > OUTPUT_BUFFER_MAX) {
        entry.outputBuffer = entry.outputBuffer.slice(-OUTPUT_BUFFER_MAX);
        this.mainWindow?.webContents.send(IPC_CHANNELS.CLI_OUTPUT, {
          sessionId: id,
          data: '\r\n[output truncated — buffer limit reached]\r\n',
        });
      }

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

    this.sessions.set(id, entry);
  }

  // -------------------------------------------------------------------------
  // Session management (unchanged public API)
  // -------------------------------------------------------------------------

  /**
   * Send kill signal to the session PTY. If it does not exit within 5
   * seconds, escalate to a forced kill.
   */
  kill(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;

    entry.pty.kill();

    setTimeout(() => {
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
   * Get the accumulated output buffer for a session (used for session summary).
   */
  getOutputBuffer(sessionId: string): string {
    return this.sessions.get(sessionId)?.outputBuffer ?? '';
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
