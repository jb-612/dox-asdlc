/**
 * GitHub issue templates for code review findings
 */

import { ReviewFinding } from '../api/types';

export const DEFAULT_TITLE_TEMPLATE = '[{severity}] {title} - {file_path}';

export const DEFAULT_BODY_TEMPLATE = `## Description

{description}

## Location

- **File**: \`{file_path}\`
- **Lines**: {line_range}
- **Category**: {category}

## Code

\`\`\`
{code_snippet}
\`\`\`

## Recommendation

{recommendation}

---

*Found by {reviewer_type} reviewer (confidence: {confidence}%)*
*Review ID: {swarm_id}*`;

/**
 * Interpolate template placeholders with finding data
 */
export function interpolateTemplate(
  template: string,
  finding: ReviewFinding,
  swarmId?: string
): string {
  const lineRange = finding.line_start
    ? finding.line_end && finding.line_end !== finding.line_start
      ? `${finding.line_start}-${finding.line_end}`
      : `${finding.line_start}`
    : 'N/A';

  const replacements: Record<string, string> = {
    '{severity}': finding.severity.toUpperCase(),
    '{title}': finding.title,
    '{file_path}': finding.file_path,
    '{description}': finding.description,
    '{line_range}': lineRange,
    '{line_start}': finding.line_start?.toString() || 'N/A',
    '{line_end}': finding.line_end?.toString() || finding.line_start?.toString() || 'N/A',
    '{category}': finding.category,
    '{code_snippet}': finding.code_snippet || 'No code snippet available',
    '{recommendation}': finding.recommendation,
    '{reviewer_type}': finding.reviewer_type,
    '{confidence}': (finding.confidence * 100).toFixed(0),
    '{swarm_id}': swarmId || 'N/A',
    '{finding_id}': finding.id,
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

/**
 * Generate issue title from finding
 */
export function generateIssueTitle(
  finding: ReviewFinding,
  template: string = DEFAULT_TITLE_TEMPLATE
): string {
  return interpolateTemplate(template, finding);
}

/**
 * Generate issue body from finding
 */
export function generateIssueBody(
  finding: ReviewFinding,
  swarmId?: string,
  template: string = DEFAULT_BODY_TEMPLATE
): string {
  return interpolateTemplate(template, finding, swarmId);
}
