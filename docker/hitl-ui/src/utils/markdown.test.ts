import { describe, it, expect } from 'vitest';
import {
  extractTableOfContents,
  generateHeadingId,
  extractCodeBlocks,
  countWords,
  estimateReadingTime,
  isMarkdown,
  stripMarkdown,
  getMarkdownExcerpt,
  detectPrimaryLanguage,
} from './markdown';

describe('markdown utilities', () => {
  describe('extractTableOfContents', () => {
    it('extracts headings from markdown', () => {
      const markdown = `
# Main Title
Some content
## Section 1
Content
### Subsection 1.1
More content
## Section 2
`;
      const toc = extractTableOfContents(markdown);
      expect(toc).toHaveLength(4);
      expect(toc[0]).toEqual({ id: 'main-title', text: 'Main Title', level: 1 });
      expect(toc[1]).toEqual({ id: 'section-1', text: 'Section 1', level: 2 });
      expect(toc[2]).toEqual({ id: 'subsection-11', text: 'Subsection 1.1', level: 3 });
      expect(toc[3]).toEqual({ id: 'section-2', text: 'Section 2', level: 2 });
    });

    it('returns empty array for content without headings', () => {
      const markdown = 'Just some plain text without any headings.';
      const toc = extractTableOfContents(markdown);
      expect(toc).toHaveLength(0);
    });
  });

  describe('generateHeadingId', () => {
    it('converts to lowercase', () => {
      expect(generateHeadingId('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(generateHeadingId("What's New?")).toBe('whats-new');
    });

    it('handles multiple spaces', () => {
      expect(generateHeadingId('Multiple   Spaces')).toBe('multiple-spaces');
    });

    it('handles leading/trailing spaces', () => {
      expect(generateHeadingId('  Trimmed  ')).toBe('trimmed');
    });
  });

  describe('extractCodeBlocks', () => {
    it('extracts code blocks with language', () => {
      const markdown = `
Some text
\`\`\`typescript
const x = 1;
\`\`\`
More text
\`\`\`python
print("hello")
\`\`\`
`;
      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('typescript');
      expect(blocks[0].code).toBe('const x = 1;');
      expect(blocks[1].language).toBe('python');
      expect(blocks[1].code).toBe('print("hello")');
    });

    it('handles code blocks without language', () => {
      const markdown = `
\`\`\`
plain code
\`\`\`
`;
      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('text');
    });

    it('returns empty array when no code blocks', () => {
      const markdown = 'No code blocks here';
      expect(extractCodeBlocks(markdown)).toHaveLength(0);
    });
  });

  describe('countWords', () => {
    it('counts words in plain text', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('One two three four five')).toBe(5);
    });

    it('excludes code blocks from count', () => {
      const markdown = `
Some text here
\`\`\`
code that should not be counted
\`\`\`
More text
`;
      expect(countWords(markdown)).toBe(5); // "Some text here" (3) + "More text" (2)
    });

    it('excludes inline code from count', () => {
      const markdown = 'Run `npm install` to install';
      expect(countWords(markdown)).toBe(3); // "Run" + "to" + "install"
    });

    it('returns 0 for empty content', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });
  });

  describe('estimateReadingTime', () => {
    it('returns at least 1 minute', () => {
      expect(estimateReadingTime('Short')).toBe(1);
    });

    it('calculates based on word count', () => {
      const words = Array(400).fill('word').join(' ');
      expect(estimateReadingTime(words, 200)).toBe(2);
    });

    it('uses custom words per minute', () => {
      const words = Array(300).fill('word').join(' ');
      expect(estimateReadingTime(words, 100)).toBe(3);
    });
  });

  describe('isMarkdown', () => {
    it('detects headings', () => {
      expect(isMarkdown('# Heading')).toBe(true);
      expect(isMarkdown('## Level 2')).toBe(true);
    });

    it('detects bold text', () => {
      expect(isMarkdown('This is **bold** text')).toBe(true);
    });

    it('detects italic text', () => {
      expect(isMarkdown('This is *italic* text')).toBe(true);
    });

    it('detects links', () => {
      expect(isMarkdown('[Link](https://example.com)')).toBe(true);
    });

    it('detects code blocks', () => {
      expect(isMarkdown('```\ncode\n```')).toBe(true);
    });

    it('detects lists', () => {
      expect(isMarkdown('- Item 1\n- Item 2')).toBe(true);
      expect(isMarkdown('1. Item 1\n2. Item 2')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(isMarkdown('Just plain text')).toBe(false);
    });
  });

  describe('stripMarkdown', () => {
    it('removes headings', () => {
      expect(stripMarkdown('# Heading\nContent')).toBe('Heading\nContent');
    });

    it('removes bold and italic', () => {
      expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
    });

    it('removes links but keeps text', () => {
      expect(stripMarkdown('[Link](https://example.com)')).toBe('Link');
    });

    it('removes images', () => {
      expect(stripMarkdown('![Alt](image.png)')).toBe('Alt');
    });

    it('removes code blocks', () => {
      expect(stripMarkdown('Before\n```\ncode\n```\nAfter')).toBe('Before\n\nAfter');
    });

    it('removes inline code but keeps content', () => {
      expect(stripMarkdown('Run `npm install`')).toBe('Run npm install');
    });

    it('removes blockquotes', () => {
      expect(stripMarkdown('> Quote')).toBe('Quote');
    });
  });

  describe('getMarkdownExcerpt', () => {
    it('returns full text if shorter than max', () => {
      expect(getMarkdownExcerpt('Short text', 100)).toBe('Short text');
    });

    it('truncates at word boundary', () => {
      const text = 'This is a longer text that needs to be truncated';
      const excerpt = getMarkdownExcerpt(text, 20);
      expect(excerpt).toBe('This is a longer...');
    });

    it('strips markdown before excerpting', () => {
      const markdown = '# Heading\n\nSome **bold** content here';
      const excerpt = getMarkdownExcerpt(markdown, 30);
      expect(excerpt).not.toContain('**');
      expect(excerpt).not.toContain('#');
    });
  });

  describe('detectPrimaryLanguage', () => {
    it('returns most common language', () => {
      const markdown = `
\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`typescript
const y = 2;
\`\`\`

\`\`\`python
print("hello")
\`\`\`
`;
      expect(detectPrimaryLanguage(markdown)).toBe('typescript');
    });

    it('returns null when no code blocks', () => {
      expect(detectPrimaryLanguage('No code here')).toBeNull();
    });

    it('ignores text language', () => {
      const markdown = `
\`\`\`
plain
\`\`\`
\`\`\`text
more plain
\`\`\`
`;
      expect(detectPrimaryLanguage(markdown)).toBeNull();
    });
  });
});
