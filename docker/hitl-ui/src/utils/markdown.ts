/**
 * Markdown parsing and processing utilities
 */

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract headings from markdown content to build a table of contents
 */
export function extractTableOfContents(markdown: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = generateHeadingId(text);
    toc.push({ id, text, level });
  }

  return toc;
}

/**
 * Generate a URL-safe ID from heading text
 */
export function generateHeadingId(text: string): string {
  return text
    .trim() // Trim first before other operations
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract code blocks from markdown
 */
export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
}

export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const codeBlockRegex = /\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g;
  const blocks: CodeBlock[] = [];
  let match;
  let lineNumber = 1;

  // Count lines before each match
  let lastIndex = 0;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const textBefore = markdown.slice(lastIndex, match.index);
    lineNumber += (textBefore.match(/\n/g) || []).length;

    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      startLine: lineNumber,
    });

    lineNumber += (match[0].match(/\n/g) || []).length;
    lastIndex = match.index + match[0].length;
  }

  return blocks;
}

/**
 * Count words in markdown content (excluding code blocks)
 */
export function countWords(markdown: string): number {
  // Remove code blocks
  const withoutCode = markdown.replace(/\`\`\`[\s\S]*?\`\`\`/g, '');
  // Remove inline code
  const withoutInlineCode = withoutCode.replace(/\`[^\`]+\`/g, '');
  // Remove markdown syntax
  const plainText = withoutInlineCode
    .replace(/[#*_\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (!plainText) return 0;
  return plainText.split(/\s+/).length;
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(markdown: string, wordsPerMinute = 200): number {
  const words = countWords(markdown);
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Check if content appears to be markdown
 */
export function isMarkdown(content: string): boolean {
  const markdownIndicators = [
    /^#{1,6}\s/m, // Headings
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /\[.+\]\(.+\)/, // Links
    /\`\`\`[\s\S]*?\`\`\`/, // Code blocks
    /^\s*[-*+]\s/m, // Unordered lists
    /^\s*\d+\.\s/m, // Ordered lists
    /^\s*>\s/m, // Blockquotes
  ];

  return markdownIndicators.some((regex) => regex.test(content));
}

/**
 * Strip markdown formatting and return plain text
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
    // Remove inline code
    .replace(/\`([^\`]+)\`/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headings
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes
    .replace(/^\s*>\s*/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Get a preview/excerpt of markdown content
 */
export function getMarkdownExcerpt(markdown: string, maxLength = 150): string {
  const plainText = stripMarkdown(markdown);
  if (plainText.length <= maxLength) return plainText;

  // Try to break at a word boundary
  const truncated = plainText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Detect the primary language in a markdown document based on code blocks
 */
export function detectPrimaryLanguage(markdown: string): string | null {
  const blocks = extractCodeBlocks(markdown);
  if (blocks.length === 0) return null;

  const languageCounts = new Map<string, number>();
  for (const block of blocks) {
    if (block.language && block.language !== 'text') {
      languageCounts.set(
        block.language,
        (languageCounts.get(block.language) || 0) + 1
      );
    }
  }

  if (languageCounts.size === 0) return null;

  let maxCount = 0;
  let primaryLanguage = null;
  for (const [lang, count] of languageCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = lang;
    }
  }

  return primaryLanguage;
}
