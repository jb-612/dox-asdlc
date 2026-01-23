/**
 * DocsPage - Documentation page with Learn and Apply tabs
 */

import { useState } from 'react';
import clsx from 'clsx';
import BlueprintMap, { Cluster } from '../components/docs/BlueprintMap';
import MethodologyStepper, { Stage } from '../components/docs/MethodologyStepper';
import InteractiveGlossary, { GlossaryTerm } from '../components/docs/InteractiveGlossary';

// Mock data for BlueprintMap
const mockClusters: Cluster[] = [
  {
    id: 'discovery',
    name: 'Discovery',
    description: 'Understand requirements and plan features',
    color: 'teal',
    items: [
      { id: 'prd-agent', name: 'PRD Agent', type: 'agent' },
      { id: 'acceptance-agent', name: 'Acceptance Agent', type: 'agent' },
      { id: 'prd-doc', name: 'PRD Document', type: 'artifact' },
      { id: 'discovery-gate', name: 'Discovery Gate', type: 'gate' },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Create technical design and architecture',
    color: 'purple',
    items: [
      { id: 'surveyor-agent', name: 'Surveyor Agent', type: 'agent' },
      { id: 'architect-agent', name: 'Architect Agent', type: 'agent' },
      { id: 'design-doc', name: 'Design Document', type: 'artifact' },
      { id: 'design-gate', name: 'Design Gate', type: 'gate' },
    ],
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Implement, test, and review code',
    color: 'blue',
    items: [
      { id: 'coding-agent', name: 'Coding Agent', type: 'agent' },
      { id: 'debugger-agent', name: 'Debugger Agent', type: 'agent' },
      { id: 'code-files', name: 'Code Files', type: 'artifact' },
      { id: 'development-gate', name: 'Development Gate', type: 'gate' },
    ],
  },
  {
    id: 'validation',
    name: 'Validation',
    description: 'Validate and deploy changes',
    color: 'green',
    items: [
      { id: 'validator-agent', name: 'Validator Agent', type: 'agent' },
      { id: 'deployer-agent', name: 'Deployer Agent', type: 'agent' },
      { id: 'test-reports', name: 'Test Reports', type: 'artifact' },
      { id: 'validation-gate', name: 'Validation Gate', type: 'gate' },
    ],
  },
];

// Mock data for MethodologyStepper
const mockStages: Stage[] = [
  {
    id: 'requirements',
    name: 'Requirements',
    description: 'Define what needs to be built',
    why: 'Clear requirements prevent scope creep and ensure alignment',
    inputs: ['User stories', 'Business goals'],
    outputs: ['PRD', 'Acceptance criteria'],
    approvals: ['Product Owner', 'Stakeholders'],
    issues: ['Unclear requirements', 'Changing scope'],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Plan how to build it',
    why: 'Good design reduces development time and prevents rework',
    inputs: ['PRD', 'Codebase context'],
    outputs: ['Technical design', 'Task breakdown'],
    approvals: ['Tech Lead', 'Architect'],
    issues: ['Over-engineering', 'Missing dependencies'],
  },
  {
    id: 'implementation',
    name: 'Implementation',
    description: 'Write the code',
    why: 'Quality implementation ensures maintainable code',
    inputs: ['Design doc', 'Test plan'],
    outputs: ['Code', 'Unit tests'],
    approvals: ['Code reviewer'],
    issues: ['Tech debt', 'Test coverage'],
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Verify it works',
    why: 'Testing catches bugs before production',
    inputs: ['Code', 'Test cases'],
    outputs: ['Test results', 'Bug reports'],
    approvals: ['QA Lead'],
    issues: ['Flaky tests', 'Missing edge cases'],
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Get feedback',
    why: 'Reviews improve code quality and share knowledge',
    inputs: ['Pull request', 'Code diff'],
    outputs: ['Review comments', 'Approval'],
    approvals: ['Code owners'],
    issues: ['Review bottlenecks', 'Unclear feedback'],
  },
  {
    id: 'integration',
    name: 'Integration',
    description: 'Merge changes',
    why: 'Integration testing catches system-level issues',
    inputs: ['Approved PR', 'Test suite'],
    outputs: ['Merged code', 'Integration test results'],
    approvals: ['CI system'],
    issues: ['Merge conflicts', 'Breaking changes'],
  },
  {
    id: 'deployment',
    name: 'Deployment',
    description: 'Ship to production',
    why: 'Controlled deployment minimizes downtime',
    inputs: ['Merged code', 'Deploy plan'],
    outputs: ['Deployed service', 'Metrics'],
    approvals: ['Release manager'],
    issues: ['Rollback needed', 'Config issues'],
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Watch for issues',
    why: 'Monitoring ensures system health',
    inputs: ['Production logs', 'Metrics'],
    outputs: ['Alerts', 'Dashboards'],
    approvals: ['On-call engineer'],
    issues: ['False alarms', 'Missing instrumentation'],
  },
];

// Mock data for InteractiveGlossary
const mockTerms: GlossaryTerm[] = [
  {
    id: 'agent',
    term: 'Agent',
    definition: 'An AI assistant specialized for a specific task in the development lifecycle',
    category: 'concept',
  },
  {
    id: 'artifact',
    term: 'Artifact',
    definition: 'A document or file generated during the development process',
    category: 'artifact',
  },
  {
    id: 'gate',
    term: 'Gate',
    definition: 'A human approval checkpoint before proceeding to the next stage',
    category: 'concept',
  },
  {
    id: 'prd',
    term: 'PRD',
    definition: 'Product Requirements Document describing what to build and why',
    category: 'artifact',
  },
  {
    id: 'context-pack',
    term: 'Context Pack',
    definition: 'Codebase analysis provided to agents for informed decision-making',
    category: 'technical',
  },
  {
    id: 'rlm',
    term: 'RLM',
    definition: 'Reinforcement Learning from Human Feedback for model improvement',
    category: 'technical',
  },
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'learn' | 'apply'>('learn');

  return (
    <div className="h-full flex flex-col bg-gray-50 max-w-7xl mx-auto" data-testid="docs-page">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
        <p className="text-sm text-gray-600 mt-1">
          Learn about the aSDLC methodology and how to use the system effectively
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="px-6">
          <nav className="flex gap-4" role="tablist" data-testid="tabs-container">
            <button
              onClick={() => setActiveTab('learn')}
              className={clsx(
                'py-3 px-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'learn'
                  ? 'border-accent-teal text-accent-teal'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
              role="tab"
              aria-selected={activeTab === 'learn'}
              data-testid="tab-learn"
            >
              Learn
            </button>
            <button
              onClick={() => setActiveTab('apply')}
              className={clsx(
                'py-3 px-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'apply'
                  ? 'border-accent-teal text-accent-teal'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
              role="tab"
              aria-selected={activeTab === 'apply'}
              data-testid="tab-apply"
            >
              Apply
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'learn' ? (
          <div className="space-y-8">
            {/* System Overview */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
              <BlueprintMap clusters={mockClusters} showFlow />
            </section>

            {/* Methodology Stages */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Methodology Stages</h2>
              <MethodologyStepper stages={mockStages} />
            </section>

            {/* Glossary */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Glossary</h2>
              <InteractiveGlossary terms={mockTerms} />
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Getting Started */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Getting Started</h2>
              <div className="bg-white rounded-lg border p-6">
                <p className="text-gray-700 mb-4">
                  Welcome to the aSDLC system! Here's how to get started with your first workflow.
                </p>
                <div data-testid="quick-actions" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium text-gray-900 mb-2">Start Discovery</h3>
                    <p className="text-sm text-gray-600">Begin a new discovery session for your project</p>
                  </div>
                  <div className="p-4 border rounded hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium text-gray-900 mb-2">Review Gates</h3>
                    <p className="text-sm text-gray-600">Check pending approval gates</p>
                  </div>
                  <div className="p-4 border rounded hover:bg-gray-50 cursor-pointer">
                    <h3 className="font-medium text-gray-900 mb-2">View Artifacts</h3>
                    <p className="text-sm text-gray-600">Browse generated artifacts</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Common Workflows */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Workflows</h2>
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Creating a New PRD</h3>
                  <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                    <li>Navigate to Discovery Studio</li>
                    <li>Start a chat session describing your requirements</li>
                    <li>Review the working outline as it develops</li>
                    <li>Preview and save the generated PRD</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Approving Code Changes</h3>
                  <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                    <li>Go to Gates page to see pending reviews</li>
                    <li>Click on a gate to view details</li>
                    <li>Review the code diff and evidence</li>
                    <li>Approve or reject with feedback</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Monitoring Agent Activity</h3>
                  <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                    <li>Open the Agent Cockpit</li>
                    <li>View KPIs and worker utilization</li>
                    <li>Check the workflow graph for bottlenecks</li>
                    <li>Review recent runs and their status</li>
                  </ol>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
