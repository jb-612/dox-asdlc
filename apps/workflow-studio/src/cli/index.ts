import { parseArgs, collectEnvVars } from './arg-parser';
import { runHeadless } from './run';
import { runExport } from './export';
import { createWebhookServer } from './webhook-server';

const USAGE = `Usage: dox <command> [options]

Commands:
  run       Execute a workflow headlessly
  export    Export a workflow to JSON or GHA YAML
  webhook   Start webhook server

Options:
  --workflow <path>       Path to workflow JSON file
  --var KEY=VALUE         Set a workflow variable
  --repo <path>           Repository path
  --mock                  Run in mock mode
  --json                  Output NDJSON
  --gate-mode <mode>      Gate handling: auto | fail
  --workflow-dir <path>   Directory containing workflow files
  --format <fmt>          Export format: json | gha
  --out <path>            Output file path
  --port <num>            Webhook server port (default: 9480)
  --secret <str>          Webhook HMAC secret
`;

const VALID_FORMATS = ['json', 'gha'];

export async function dispatch(args: string[]): Promise<number> {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    process.stderr.write(USAGE);
    return 1;
  }

  const rest = args.slice(1);

  switch (command) {
    case 'run': {
      const config = parseArgs(rest);
      const envVars = collectEnvVars();
      config.variables = { ...envVars, ...config.variables };
      return runHeadless(config);
    }
    case 'export': {
      let workflowPath = '';
      let format: 'json' | 'gha' = 'json';
      let outPath: string | undefined;

      for (let i = 0; i < rest.length; i++) {
        switch (rest[i]) {
          case '--workflow': workflowPath = rest[++i] ?? ''; break;
          case '--format': {
            const f = rest[++i] ?? 'json';
            if (!VALID_FORMATS.includes(f)) {
              process.stderr.write(`Error: Invalid --format: "${f}". Must be json or gha\n`);
              return 1;
            }
            format = f as 'json' | 'gha';
            break;
          }
          case '--out': outPath = rest[++i]; break;
        }
      }

      if (!workflowPath) {
        process.stderr.write('Error: --workflow is required for export\n');
        return 1;
      }

      return runExport({ workflowPath, format, outPath });
    }
    // HIGH-3 fix: implement webhook command
    case 'webhook': {
      let port = 9480;
      let secret = '';
      let workflowDir = '.';
      let mock = false;

      for (let i = 0; i < rest.length; i++) {
        switch (rest[i]) {
          case '--port': port = parseInt(rest[++i] ?? '9480', 10); break;
          case '--secret': secret = rest[++i] ?? ''; break;
          case '--workflow-dir': workflowDir = rest[++i] ?? '.'; break;
          case '--mock': mock = true; break;
        }
      }

      if (!secret) {
        process.stderr.write('Error: --secret is required for webhook server\n');
        return 1;
      }

      const server = createWebhookServer({ port, secret, workflowDir, mockMode: mock });
      await server.start();
      process.stderr.write(`Webhook server listening on 127.0.0.1:${port}\n`);

      // Block until SIGINT/SIGTERM
      await new Promise<void>((resolve) => {
        process.on('SIGINT', () => { server.stop().then(resolve); });
        process.on('SIGTERM', () => { server.stop().then(resolve); });
      });
      return 0;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}
