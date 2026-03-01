import type { HeadlessRunConfig, GateMode } from './types';

const VALID_GATE_MODES: GateMode[] = ['auto', 'fail'];

export function parseArgs(argv: string[]): HeadlessRunConfig {
  let workflowPath = '';
  let mock = false;
  let json = false;
  let gateMode: GateMode = 'auto';
  const variables: Record<string, string> = {};
  let repoPath: string | undefined;
  let workflowDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--workflow':
        workflowPath = argv[++i] ?? '';
        break;
      case '--var': {
        const pair = argv[++i] ?? '';
        const eq = pair.indexOf('=');
        if (eq > 0) {
          variables[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
        break;
      }
      case '--repo':
        repoPath = argv[++i];
        break;
      case '--mock':
        mock = true;
        break;
      case '--json':
        json = true;
        break;
      case '--gate-mode': {
        const val = argv[++i] ?? '';
        if (!VALID_GATE_MODES.includes(val as GateMode)) {
          throw new Error(`Invalid --gate-mode: "${val}". Must be one of: ${VALID_GATE_MODES.join(', ')}`);
        }
        gateMode = val as GateMode;
        break;
      }
      case '--workflow-dir':
        workflowDir = argv[++i];
        break;
    }
  }

  if (!workflowPath) {
    throw new Error('Missing required argument: --workflow <path>');
  }

  return { workflowPath, mock, json, gateMode, variables, repoPath, workflowDir };
}

const DOX_VAR_PREFIX = 'DOX_VAR_';

export function collectEnvVars(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(DOX_VAR_PREFIX) && value !== undefined) {
      result[key.slice(DOX_VAR_PREFIX.length)] = value;
    }
  }
  return result;
}
