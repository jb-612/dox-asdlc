import { config as loadDotenv } from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import { execFile } from "node:child_process";
import { writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the same directory as server.ts regardless of cwd.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, ".env") });

interface ExecuteRequest {
  prompt: string;
  model?: string;
  mode?: "agent" | "plan" | "ask";
  timeoutSeconds?: number;
  workspacePath?: string;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  agentRole?: string;
  extraFlags?: string[];
}

interface ExecuteResponse {
  success: boolean;
  result: string;
  sessionId?: string;
  durationMs?: number;
  durationApiMs?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Auth middleware (#267)
// If CURSOR_API_KEY is set, all /execute requests must carry a matching
// Bearer token. The /health endpoint is always unauthenticated.
// ---------------------------------------------------------------------------

const CONFIGURED_API_KEY = process.env.CURSOR_API_KEY || "";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!CONFIGURED_API_KEY) {
    // No key configured — open access (development / local use)
    next();
    return;
  }
  const authHeader = req.headers.authorization ?? "";
  if (authHeader !== `Bearer ${CONFIGURED_API_KEY}`) {
    res.status(401).json({
      success: false,
      result: "",
      error: "Unauthorized",
    } satisfies ExecuteResponse);
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Path validation (#276)
// All workspace paths must resolve within /workspace to prevent traversal.
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = "/workspace";

function resolveWorkspacePath(requested: string): string {
  const resolved = resolve(requested);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(
      `workspacePath must be within ${WORKSPACE_ROOT}, got: ${resolved}`,
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Agent binary resolution
// AGENT_BINARY env var allows overriding the executable path (useful on macOS
// where the bundled node is in a different directory than the agent script).
// Falls back to "agent" for PATH-based lookup (Linux containers).
// ---------------------------------------------------------------------------

const AGENT_BINARY = process.env.AGENT_BINARY || "agent";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "cursor-agent",
    timestamp: new Date().toISOString(),
  });
});

app.post("/execute", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as ExecuteRequest;

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({
      success: false,
      result: "",
      error: "Missing required field: prompt",
    } satisfies ExecuteResponse);
    return;
  }

  let workspacePath: string;
  try {
    workspacePath = resolveWorkspacePath(body.workspacePath ?? WORKSPACE_ROOT);
  } catch (err) {
    res.status(400).json({
      success: false,
      result: "",
      error: err instanceof Error ? err.message : "Invalid workspacePath",
    } satisfies ExecuteResponse);
    return;
  }

  const timeoutSeconds = body.timeoutSeconds ?? 300;
  const model = body.model ?? "auto";
  const mode = body.mode ?? "agent";

  // Write dynamic permissions if provided
  if (body.permissions) {
    const cursorDir = join(workspacePath, ".cursor");
    await mkdir(cursorDir, { recursive: true });
    const cliConfig = {
      version: 1,
      permissions: {
        allow: body.permissions.allow ?? [],
        deny: body.permissions.deny ?? [],
      },
    };
    await writeFile(
      join(cursorDir, "cli.json"),
      JSON.stringify(cliConfig, null, 2),
    );
  }

  // Copy role-specific cursor rules into workspace if agentRole is specified
  if (body.agentRole) {
    const rulesDir = join(workspacePath, ".cursor", "rules");
    const defaultRulesDir = "/app/.cursor-defaults/rules";
    const roleFile = `${body.agentRole}.mdc`;

    try {
      await mkdir(rulesDir, { recursive: true });
      await copyFile(join(defaultRulesDir, roleFile), join(rulesDir, roleFile));
    } catch {
      console.warn(`Could not copy role rules for "${body.agentRole}": ${roleFile}`);
    }
  }

  // Build command arguments
  const args: string[] = ["-p", body.prompt, "--force", "--output-format", "json"];

  if (model !== "auto") {
    args.push("--model", model);
  }

  if (mode !== "agent") {
    args.push("--mode", mode);
  }

  if (body.extraFlags) {
    args.push(...body.extraFlags);
  }

  // Restrict environment to only what the agent binary needs (#274)
  const agentEnv: NodeJS.ProcessEnv = {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
    ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
    REDIS_URL: process.env.REDIS_URL,
  };

  const startTime = Date.now();

  try {
    const result = await new Promise<ExecuteResponse>((resolve) => {
      execFile(
        AGENT_BINARY,
        args,
        {
          cwd: workspacePath,
          timeout: timeoutSeconds * 1000,
          env: agentEnv,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        },
        (error, stdout, stderr) => {
          const elapsed = Date.now() - startTime;

          if (error) {
            if (error.killed) {
              resolve({
                success: false,
                result: "",
                durationMs: elapsed,
                error: `Execution timed out after ${timeoutSeconds} seconds`,
              });
              return;
            }

            if (
              error.code === "ENOENT" ||
              (error.message && error.message.includes("ENOENT"))
            ) {
              resolve({
                success: false,
                result: "",
                durationMs: elapsed,
                error: `agent binary not found (AGENT_BINARY=${AGENT_BINARY})`,
              });
              return;
            }

            resolve({
              success: false,
              result: stderr || "",
              durationMs: elapsed,
              error: `CLI exited with code ${error.code}: ${stderr}`,
            });
            return;
          }

          // Try to parse JSON output
          try {
            const parsed = JSON.parse(stdout);
            resolve({
              success: !parsed.is_error,
              result: parsed.result ?? stdout,
              sessionId: parsed.session_id,
              durationMs: parsed.duration_ms ?? elapsed,
              durationApiMs: parsed.duration_api_ms,
            });
          } catch {
            // JSON parse failed, use raw stdout
            resolve({
              success: true,
              result: stdout,
              durationMs: elapsed,
            });
          }
        },
      );
    });

    res.json(result);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    res.status(500).json({
      success: false,
      result: "",
      durationMs: elapsed,
      error: err instanceof Error ? err.message : String(err),
    } satisfies ExecuteResponse);
  }
});

const port = parseInt(process.env.SERVICE_PORT ?? "8090", 10);
app.listen(port, () => {
  console.log(`cursor-agent server listening on port ${port}`);
});
