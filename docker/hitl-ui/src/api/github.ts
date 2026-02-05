/**
 * GitHub API client for creating issues from code review findings
 */

import { ReviewFinding } from './types';
import { generateIssueTitle, generateIssueBody } from '../utils/issueTemplates';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
}

export interface IssueCreate {
  title: string;
  body: string;
  labels?: string[];
}

// Mock data
const MOCK_REPOSITORIES: Repository[] = [
  { id: 1, name: 'dox-asdlc', full_name: 'org/dox-asdlc', description: 'Agentic SDLC project', html_url: 'https://github.com/org/dox-asdlc' },
  { id: 2, name: 'frontend', full_name: 'org/frontend', description: 'Frontend application', html_url: 'https://github.com/org/frontend' },
  { id: 3, name: 'backend', full_name: 'org/backend', description: 'Backend services', html_url: 'https://github.com/org/backend' },
];

const MOCK_LABELS: Label[] = [
  { id: 1, name: 'bug', color: 'd73a4a', description: 'Something isn\'t working' },
  { id: 2, name: 'security', color: 'b60205', description: 'Security vulnerability' },
  { id: 3, name: 'performance', color: 'fbca04', description: 'Performance improvement' },
  { id: 4, name: 'code-quality', color: '0075ca', description: 'Code quality improvement' },
  { id: 5, name: 'documentation', color: '0052cc', description: 'Documentation update needed' },
];

let mockIssueCounter = 1;

/**
 * List repositories accessible to the user
 */
export async function listRepositories(): Promise<Repository[]> {
  if (USE_MOCKS) {
    await simulateDelay();
    return MOCK_REPOSITORIES;
  }

  // Real implementation would call GitHub API
  throw new Error('GitHub API not configured. Set VITE_GITHUB_TOKEN and disable mocks.');
}

/**
 * List labels for a repository
 */
export async function listLabels(repo: string): Promise<Label[]> {
  if (USE_MOCKS) {
    await simulateDelay();
    return MOCK_LABELS;
  }

  throw new Error('GitHub API not configured');
}

/**
 * Create a single issue
 */
export async function createIssue(repo: string, issue: IssueCreate): Promise<Issue> {
  if (USE_MOCKS) {
    await simulateDelay();
    const mockIssue: Issue = {
      id: mockIssueCounter * 1000,
      number: mockIssueCounter++,
      title: issue.title,
      html_url: `https://github.com/${repo}/issues/${mockIssueCounter - 1}`,
      state: 'open',
    };
    return mockIssue;
  }

  throw new Error('GitHub API not configured');
}

/**
 * Create multiple issues with rate limiting
 */
export async function createBulkIssues(
  repo: string,
  issues: IssueCreate[],
  onProgress?: (created: number, total: number) => void
): Promise<{ created: Issue[]; failed: { issue: IssueCreate; error: string }[] }> {
  const created: Issue[] = [];
  const failed: { issue: IssueCreate; error: string }[] = [];

  for (let i = 0; i < issues.length; i++) {
    try {
      const issue = await createIssue(repo, issues[i]);
      created.push(issue);
      onProgress?.(i + 1, issues.length);

      // Rate limiting: wait 1 second between issues
      if (i < issues.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failed.push({
        issue: issues[i],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { created, failed };
}

/**
 * Create an issue from a review finding
 */
export async function createIssueFromFinding(
  repo: string,
  finding: ReviewFinding,
  swarmId: string,
  labels?: string[]
): Promise<Issue> {
  const issue: IssueCreate = {
    title: generateIssueTitle(finding),
    body: generateIssueBody(finding, swarmId),
    labels,
  };

  return createIssue(repo, issue);
}

/**
 * Create issues from multiple findings
 */
export async function createIssuesFromFindings(
  repo: string,
  findings: ReviewFinding[],
  swarmId: string,
  labels?: string[],
  onProgress?: (created: number, total: number) => void
): Promise<{ created: Issue[]; failed: { finding: ReviewFinding; error: string }[] }> {
  const issues: IssueCreate[] = findings.map(finding => ({
    title: generateIssueTitle(finding),
    body: generateIssueBody(finding, swarmId),
    labels,
  }));

  const result = await createBulkIssues(repo, issues, onProgress);

  // Map failed issues back to findings
  const failedFindings = result.failed.map((f, i) => ({
    finding: findings[findings.findIndex(finding =>
      generateIssueTitle(finding) === f.issue.title
    )],
    error: f.error,
  }));

  return {
    created: result.created,
    failed: failedFindings,
  };
}

// Helper
function simulateDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
