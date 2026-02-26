import type { AgentNodeType } from './types/workflow';

export interface NodeTypeMetadata {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  category: 'discovery' | 'design' | 'development' | 'validation' | 'deployment' | 'governance';
  description: string;
}

export const NODE_TYPE_METADATA: Record<AgentNodeType, NodeTypeMetadata> = {
  ideation: {
    label: 'Ideation',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    icon: 'LightBulbIcon',
    category: 'discovery',
    description: 'Generate ideas and PRDs',
  },
  prd: {
    label: 'PRD Generator',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    icon: 'DocumentTextIcon',
    category: 'discovery',
    description: 'Create product requirements documents',
  },
  acceptance: {
    label: 'Acceptance',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    icon: 'ClipboardDocumentCheckIcon',
    category: 'discovery',
    description: 'Generate acceptance criteria',
  },
  architect: {
    label: 'Architect',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    icon: 'CubeTransparentIcon',
    category: 'design',
    description: 'Design system architecture',
  },
  surveyor: {
    label: 'Surveyor',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    icon: 'MagnifyingGlassIcon',
    category: 'design',
    description: 'Survey codebase structure',
  },
  planner: {
    label: 'Planner',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    icon: 'ClipboardDocumentListIcon',
    category: 'design',
    description: 'Create task plans',
  },
  coding: {
    label: 'Coder',
    color: '#10B981',
    bgColor: '#10B98120',
    icon: 'CodeBracketIcon',
    category: 'development',
    description: 'Write implementation code',
  },
  utest: {
    label: 'Unit Test',
    color: '#10B981',
    bgColor: '#10B98120',
    icon: 'BeakerIcon',
    category: 'development',
    description: 'Write unit tests (TDD)',
  },
  debugger: {
    label: 'Debugger',
    color: '#10B981',
    bgColor: '#10B98120',
    icon: 'BugAntIcon',
    category: 'development',
    description: 'Debug failing tests',
  },
  reviewer: {
    label: 'Reviewer',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    icon: 'EyeIcon',
    category: 'governance',
    description: 'Review code quality',
  },
  orchestrator: {
    label: 'Orchestrator',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    icon: 'CogIcon',
    category: 'governance',
    description: 'Coordinate and commit',
  },
  security: {
    label: 'Security',
    color: '#EF4444',
    bgColor: '#EF444420',
    icon: 'ShieldCheckIcon',
    category: 'validation',
    description: 'Security scanning',
  },
  validation: {
    label: 'Validation',
    color: '#EF4444',
    bgColor: '#EF444420',
    icon: 'CheckBadgeIcon',
    category: 'validation',
    description: 'E2E validation',
  },
  deployment: {
    label: 'Deployment',
    color: '#6366F1',
    bgColor: '#6366F120',
    icon: 'RocketLaunchIcon',
    category: 'deployment',
    description: 'Generate deployment plans',
  },
  monitor: {
    label: 'Monitor',
    color: '#6366F1',
    bgColor: '#6366F120',
    icon: 'ChartBarIcon',
    category: 'deployment',
    description: 'Configure monitoring',
  },
  release: {
    label: 'Release',
    color: '#6366F1',
    bgColor: '#6366F120',
    icon: 'TagIcon',
    category: 'deployment',
    description: 'Generate release manifests',
  },
  backend: {
    label: 'Backend',
    color: '#10B981',
    bgColor: '#10B98120',
    icon: 'ServerIcon',
    category: 'development',
    description: 'Backend implementation',
  },
  frontend: {
    label: 'Frontend',
    color: '#10B981',
    bgColor: '#10B98120',
    icon: 'ComputerDesktopIcon',
    category: 'development',
    description: 'Frontend implementation',
  },
  devops: {
    label: 'DevOps',
    color: '#6366F1',
    bgColor: '#6366F120',
    icon: 'WrenchScrewdriverIcon',
    category: 'deployment',
    description: 'Infrastructure operations',
  },
};

// ---------------------------------------------------------------------------
// Block type metadata for Studio Block Composer (P15-F01)
// ---------------------------------------------------------------------------

export interface BlockTypeMetadata {
  agentNodeType: AgentNodeType;
  label: string;
  description: string;
  icon: string;
  defaultSystemPromptPrefix: string;
  defaultOutputChecklist: string[];
  /** Phase in which this block becomes available in the palette. */
  phase: number;
}

export const BLOCK_TYPE_METADATA: Record<import('./types/workflow').BlockType, BlockTypeMetadata> = {
  plan: {
    agentNodeType: 'planner',
    label: 'Plan',
    description: 'Interview the user, gather requirements, and produce a task plan',
    icon: 'ClipboardDocumentListIcon',
    defaultSystemPromptPrefix:
      'You are a senior technical planner. Interview the user to gather requirements and context.\n' +
      'Ask clarifying questions before producing any output. Focus on understanding goals,\n' +
      'constraints, and success criteria.',
    defaultOutputChecklist: [
      'Requirements document with user stories',
      'Acceptance criteria for each story',
      'Task breakdown with estimates',
      'Dependency map',
    ],
    phase: 1,
  },
  dev: {
    agentNodeType: 'coding',
    label: 'Dev',
    description: 'Write implementation code following TDD',
    icon: 'CodeBracketIcon',
    defaultSystemPromptPrefix:
      'You are a senior software engineer following strict TDD.\n' +
      'For each task: 1) Write a failing test first (RED), 2) Write minimal code to pass (GREEN),\n' +
      '3) Refactor while tests stay green. Never skip the failing-test step.',
    defaultOutputChecklist: [
      'Failing tests written before implementation',
      'All tests passing',
      'Lint and type-check clean',
      'No breaking changes to existing tests',
    ],
    phase: 2,
  },
  test: {
    agentNodeType: 'utest',
    label: 'Test',
    description: 'Write and run unit tests',
    icon: 'BeakerIcon',
    defaultSystemPromptPrefix:
      'You are a QA engineer writing comprehensive tests.\n' +
      'Target >85% code coverage. Cover happy paths, edge cases, and error handling.\n' +
      'Include performance tests for hot paths.',
    defaultOutputChecklist: [
      'Coverage report generated (target >85%)',
      'All tests passing',
      'Edge cases and error paths covered',
      'Performance tests for critical paths',
    ],
    phase: 2,
  },
  review: {
    agentNodeType: 'reviewer',
    label: 'Review',
    description: 'Review code quality and security',
    icon: 'EyeIcon',
    defaultSystemPromptPrefix:
      'You are a senior code reviewer.\n' +
      'Evaluate: code quality, performance implications, security vulnerabilities,\n' +
      'test coverage gaps, and adherence to project conventions.',
    defaultOutputChecklist: [
      'Security findings documented',
      'Quality concerns listed with severity',
      'Performance assessment complete',
      'Test coverage gaps identified',
    ],
    phase: 2,
  },
  devops: {
    agentNodeType: 'deployment',
    label: 'DevOps',
    description: 'Generate deployment plans and infrastructure',
    icon: 'RocketLaunchIcon',
    defaultSystemPromptPrefix:
      'You are a DevOps engineer.\n' +
      'Produce Docker, Kubernetes, and CI/CD artifacts.\n' +
      'Ensure health checks, resource limits, and monitoring are configured.',
    defaultOutputChecklist: [
      'Dockerfile with multi-stage build',
      'Kubernetes manifests with resource limits',
      'CI/CD pipeline configuration',
      'Health checks and monitoring setup',
    ],
    phase: 2,
  },
};

/** Block types available in the current phase (Phase 2). */
export const AVAILABLE_BLOCK_TYPES = (
  Object.entries(BLOCK_TYPE_METADATA) as [import('./types/workflow').BlockType, BlockTypeMetadata][]
).filter(([, meta]) => meta.phase <= 2).map(([type]) => type);

export const NODE_CATEGORIES = [
  'discovery',
  'design',
  'development',
  'validation',
  'deployment',
  'governance',
] as const;

export type NodeCategory = typeof NODE_CATEGORIES[number];
