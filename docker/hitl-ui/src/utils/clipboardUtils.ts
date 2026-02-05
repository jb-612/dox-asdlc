/**
 * Clipboard utilities for copying content
 */

import { ReviewFinding } from '../api/types';

/**
 * Copy text to clipboard using the Clipboard API
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers or non-secure context
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Format a review finding as Markdown
 */
export function findingToMarkdown(finding: ReviewFinding): string {
  const lines: string[] = [];

  lines.push(`## ${finding.title}`);
  lines.push('');
  lines.push(`**Severity:** ${finding.severity.toUpperCase()}`);
  lines.push(`**Category:** ${finding.category}`);
  lines.push(`**Reviewer:** ${finding.reviewer_type}`);
  lines.push(`**Confidence:** ${(finding.confidence * 100).toFixed(0)}%`);
  lines.push('');
  lines.push(`**File:** \`${finding.file_path}\``);

  if (finding.line_start !== null) {
    const lineInfo = finding.line_end && finding.line_end !== finding.line_start
      ? `Lines ${finding.line_start}-${finding.line_end}`
      : `Line ${finding.line_start}`;
    lines.push(`**Location:** ${lineInfo}`);
  }

  lines.push('');
  lines.push('### Description');
  lines.push('');
  lines.push(finding.description);

  if (finding.code_snippet) {
    lines.push('');
    lines.push('### Code');
    lines.push('');
    lines.push('```');
    lines.push(finding.code_snippet);
    lines.push('```');
  }

  lines.push('');
  lines.push('### Recommendation');
  lines.push('');
  lines.push(finding.recommendation);

  return lines.join('\n');
}

/**
 * Copy a finding to clipboard as Markdown
 */
export async function copyFindingToClipboard(finding: ReviewFinding): Promise<boolean> {
  const markdown = findingToMarkdown(finding);
  return copyToClipboard(markdown);
}
