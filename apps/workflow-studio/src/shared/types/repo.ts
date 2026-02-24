export type RepoSource = 'local' | 'github';

export interface RepoMount {
  source: RepoSource;
  /** Absolute path on disk — used when source === 'local' */
  localPath?: string;
  /** GitHub HTTPS URL — used when source === 'github' */
  githubUrl?: string;
  /** Branch or tag to check out (default: default branch) */
  branch?: string;
  /** Shallow clone depth (default: 1) */
  cloneDepth?: number;
  /** Glob patterns that restrict which files the agent may touch */
  fileRestrictions?: string[];
  /** Mount the repo read-only (appends :ro to Docker bind mount) */
  readOnly?: boolean;
}
