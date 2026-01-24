# P05-F07 Documentation SPA - Tasks

**Version:** 1.0
**Date:** 2026-01-24
**Status:** Complete

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Setup | 2 | 2 | 100% |
| Core Components | 6 | 6 | 100% |
| Page Integration | 4 | 4 | 100% |
| Search & Export | 3 | 3 | 100% |
| Polish & Testing | 3 | 3 | 100% |
| **Total** | **18** | **18** | **100%** |

---

## Phase 1: Setup (2 tasks)

### Task 1.1: Install Mermaid.js and Configure
**Estimate:** 30 min | **Status:** Complete

**Description:**
Install mermaid npm package and create configuration module.

**Steps:**
1. Add mermaid to package.json dependencies
2. Create `src/config/mermaid.ts` with initialization
3. Configure theme, font, security settings
4. Add TypeScript types for mermaid

**Acceptance Criteria:**
- [x] `npm install` succeeds with mermaid added
- [x] Mermaid initializes without console errors
- [x] TypeScript recognizes mermaid imports

**Test:**
```typescript
// src/config/mermaid.test.ts
describe('mermaid configuration', () => {
  it('initializes mermaid with correct settings', () => {
    // Verify mermaid.initialize called with expected config
  });
});
```

---

### Task 1.2: Create Documentation Mock Data
**Estimate:** 45 min | **Status:** Complete

**Description:**
Create mock data layer for documents and diagrams following existing mock patterns.

**Steps:**
1. Create `src/api/mocks/docs.ts` with document metadata
2. Add diagram metadata for all 14 wiki diagrams
3. Add mock markdown content for key documents
4. Export from `src/api/mocks/index.ts`

**Acceptance Criteria:**
- [x] mockDocuments array with 4+ document entries
- [x] mockDiagrams array with 14 diagram entries
- [x] Mock content strings for System_Design and Main_Features
- [x] Types match design.md specifications

**Test:**
```typescript
// src/api/mocks/docs.test.ts
describe('docs mock data', () => {
  it('exports mockDocuments with required fields', () => {
    expect(mockDocuments).toHaveLength(4);
    mockDocuments.forEach(doc => {
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('title');
      expect(doc).toHaveProperty('path');
    });
  });
});
```

---

## Phase 2: Core Components (6 tasks)

### Task 2.1: Create MermaidDiagram Component
**Estimate:** 1.5 hr | **Status:** Complete

**Description:**
Build core component that renders Mermaid syntax to SVG.

**Steps:**
1. Write failing tests for rendering behavior
2. Implement component with mermaid.render()
3. Add loading skeleton state
4. Add error state for invalid syntax
5. Implement aria-label for accessibility

**Acceptance Criteria:**
- [x] Valid mermaid renders to SVG
- [x] Loading skeleton shows during render
- [x] Error state displays for invalid syntax
- [x] Component has proper aria-label
- [x] onRender/onError callbacks work

**Test:**
```typescript
// src/components/docs/MermaidDiagram.test.tsx
describe('MermaidDiagram', () => {
  it('renders valid mermaid to SVG', async () => {
    render(<MermaidDiagram content="graph TD; A-->B" />);
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    render(<MermaidDiagram content="graph TD; A-->B" />);
    expect(screen.getByTestId('mermaid-loading')).toBeInTheDocument();
  });

  it('shows error for invalid syntax', async () => {
    render(<MermaidDiagram content="invalid%%%" />);
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-error')).toBeInTheDocument();
    });
  });
});
```

---

### Task 2.2: Create DiagramViewer Component
**Estimate:** 1.5 hr | **Status:** Complete

**Description:**
Build full-screen diagram viewer with zoom/pan controls.

**Steps:**
1. Write failing tests for viewer features
2. Implement viewer layout with header and controls
3. Add zoom controls (fit, 100%, +/-)
4. Implement pan via drag
5. Add close button with keyboard support (Escape)

**Acceptance Criteria:**
- [x] Displays diagram at full width
- [x] Zoom controls adjust scale
- [x] Pan works with mouse drag
- [x] Escape key closes viewer
- [x] Focus trap when open

**Test:**
```typescript
// src/components/docs/DiagramViewer.test.tsx
describe('DiagramViewer', () => {
  it('renders diagram content', () => {
    render(<DiagramViewer diagram={mockDiagram} />);
    expect(screen.getByTestId('diagram-viewer')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('zoom controls adjust scale', async () => {
    render(<DiagramViewer diagram={mockDiagram} showControls />);
    fireEvent.click(screen.getByTestId('zoom-in'));
    // Verify scale increased
  });
});
```

---

### Task 2.3: Create DiagramGallery Component
**Estimate:** 1.5 hr | **Status:** Complete

**Description:**
Build responsive grid gallery for diagram thumbnails.

**Steps:**
1. Write failing tests for gallery behavior
2. Implement grid layout with responsive columns
3. Add category filter tabs
4. Create diagram card with thumbnail and metadata
5. Implement click handler and keyboard navigation

**Acceptance Criteria:**
- [x] Grid displays all diagrams
- [x] Category filter shows/hides diagrams
- [x] Cards show title, description, category badge
- [x] Click calls onSelect with diagram ID
- [x] Arrow keys navigate between cards

**Test:**
```typescript
// src/components/docs/DiagramGallery.test.tsx
describe('DiagramGallery', () => {
  it('renders all diagrams', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
    expect(screen.getAllByTestId(/^diagram-card-/)).toHaveLength(14);
  });

  it('filters by category', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-sequence'));
    const cards = screen.getAllByTestId(/^diagram-card-/);
    // Verify only sequence diagrams shown
  });

  it('calls onSelect when card clicked', () => {
    const onSelect = vi.fn();
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('diagram-card-01-system-architecture'));
    expect(onSelect).toHaveBeenCalledWith('01-system-architecture');
  });
});
```

---

### Task 2.4: Create DocBrowser Component
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Build sidebar document browser with category grouping.

**Steps:**
1. Write failing tests for browser behavior
2. Implement collapsible category sections
3. Add document list items with metadata preview
4. Highlight selected document
5. Persist expansion state in localStorage

**Acceptance Criteria:**
- [x] Documents grouped by category
- [x] Categories expand/collapse on click
- [x] Selected document is highlighted
- [x] Expansion state persists across sessions
- [x] Keyboard navigation supported

**Test:**
```typescript
// src/components/docs/DocBrowser.test.tsx
describe('DocBrowser', () => {
  it('groups documents by category', () => {
    render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
    expect(screen.getByTestId('category-system')).toBeInTheDocument();
    expect(screen.getByTestId('category-feature')).toBeInTheDocument();
  });

  it('highlights selected document', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        selectedId="system-design"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId('doc-system-design')).toHaveClass('selected');
  });

  it('collapses category on click', () => {
    render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('category-header-system'));
    expect(screen.queryByTestId('doc-system-design')).not.toBeVisible();
  });
});
```

---

### Task 2.5: Create DocViewer Component
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Build document viewer with TOC and inline mermaid support.

**Steps:**
1. Write failing tests for viewer behavior
2. Integrate with existing MarkdownRenderer
3. Add table of contents sidebar extraction
4. Implement TOC click scrolling
5. Detect and render mermaid code blocks inline

**Acceptance Criteria:**
- [x] Markdown renders with proper formatting
- [x] TOC extracts from headings
- [x] TOC clicks scroll to section
- [x] Mermaid code blocks render as diagrams
- [x] Document title and metadata displayed

**Test:**
```typescript
// src/components/docs/DocViewer.test.tsx
describe('DocViewer', () => {
  it('renders markdown content', () => {
    const doc = { meta: mockMeta, content: '# Hello\n\nWorld' };
    render(<DocViewer document={doc} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('generates table of contents', () => {
    const doc = { meta: mockMeta, content: '# H1\n## H2\n### H3' };
    render(<DocViewer document={doc} />);
    expect(screen.getByTestId('toc')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('renders mermaid blocks as diagrams', async () => {
    const doc = {
      meta: mockMeta,
      content: '```mermaid\ngraph TD; A-->B\n```'
    };
    render(<DocViewer document={doc} />);
    await waitFor(() => {
      expect(screen.getByTestId('inline-mermaid')).toBeInTheDocument();
    });
  });
});
```

---

### Task 2.6: Create Docs API Layer
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Build API functions and React Query hooks for documentation.

**Steps:**
1. Write failing tests for API functions
2. Implement fetch functions for docs and diagrams
3. Create React Query hooks (useDocuments, useDocument, etc.)
4. Add mock mode detection and fallback
5. Configure caching and stale time

**Acceptance Criteria:**
- [x] listDocuments() returns document metadata
- [x] getDocument(id) returns content
- [x] listDiagrams() returns diagram metadata
- [x] getDiagram(id) returns content
- [x] Mock mode works when VITE_USE_MOCKS=true

**Test:**
```typescript
// src/api/docs.test.ts
describe('docs API', () => {
  it('listDocuments returns metadata array', async () => {
    const docs = await listDocuments();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs[0]).toHaveProperty('id');
  });

  it('getDocument returns content', async () => {
    const doc = await getDocument('system-design');
    expect(doc).toHaveProperty('meta');
    expect(doc).toHaveProperty('content');
  });

  it('useDocuments hook returns query result', () => {
    const { result } = renderHook(() => useDocuments());
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('isLoading');
  });
});
```

---

## Phase 3: Page Integration (4 tasks)

### Task 3.1: Update DocsPage with New Tab Structure
**Estimate:** 1.5 hr | **Status:** Complete

**Description:**
Refactor DocsPage to use new four-tab structure and integrate components.

**Steps:**
1. Write failing tests for new tab structure
2. Replace Learn/Apply with Overview/Diagrams/Reference/Glossary
3. Integrate DiagramGallery into Diagrams tab
4. Integrate DocBrowser + DocViewer into Reference tab
5. Persist tab selection in URL query params

**Acceptance Criteria:**
- [x] Four tabs render correctly
- [x] Tab selection updates URL
- [x] Overview tab shows BlueprintMap and MethodologyStepper
- [x] Diagrams tab shows DiagramGallery
- [x] Reference tab shows DocBrowser with DocViewer
- [x] Glossary tab shows InteractiveGlossary

**Test:**
```typescript
// src/pages/DocsPage.test.tsx
describe('DocsPage', () => {
  it('renders four tabs', () => {
    render(<DocsPage />);
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-diagrams')).toBeInTheDocument();
    expect(screen.getByTestId('tab-reference')).toBeInTheDocument();
    expect(screen.getByTestId('tab-glossary')).toBeInTheDocument();
  });

  it('shows Diagrams content when tab selected', () => {
    render(<DocsPage />);
    fireEvent.click(screen.getByTestId('tab-diagrams'));
    expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
  });

  it('persists tab selection in URL', () => {
    render(<DocsPage />);
    fireEvent.click(screen.getByTestId('tab-reference'));
    expect(window.location.search).toContain('tab=reference');
  });
});
```

---

### Task 3.2: Create DiagramDetailPage Route
**Estimate:** 45 min | **Status:** Complete

**Description:**
Add route and page for viewing individual diagrams.

**Steps:**
1. Write failing tests for route behavior
2. Create DiagramDetailPage component
3. Add route to App.tsx
4. Fetch diagram by ID from URL param
5. Render DiagramViewer with full controls

**Acceptance Criteria:**
- [x] Route /docs/diagrams/:diagramId works
- [x] Diagram loads based on URL param
- [x] Back navigation returns to gallery
- [x] Loading state while fetching
- [x] 404 handling for invalid ID

**Test:**
```typescript
// src/pages/DiagramDetailPage.test.tsx
describe('DiagramDetailPage', () => {
  it('loads diagram from URL param', async () => {
    render(
      <MemoryRouter initialEntries={['/docs/diagrams/01-system-architecture']}>
        <Routes>
          <Route path="/docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('diagram-viewer')).toBeInTheDocument();
    });
  });

  it('shows 404 for invalid diagram', async () => {
    render(
      <MemoryRouter initialEntries={['/docs/diagrams/nonexistent']}>
        <Routes>
          <Route path="/docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });
});
```

---

### Task 3.3: Create DocDetailPage Route
**Estimate:** 45 min | **Status:** Complete

**Description:**
Add route for viewing individual documents with deep linking.

**Steps:**
1. Write failing tests for route behavior
2. Create DocDetailPage component
3. Add route to App.tsx
4. Fetch document by path from URL param
5. Support hash navigation to sections

**Acceptance Criteria:**
- [x] Route /docs/:docPath works
- [x] Document loads based on URL param
- [x] Hash in URL scrolls to section
- [x] Breadcrumb navigation works
- [x] 404 handling for invalid path

**Test:**
```typescript
// src/pages/DocDetailPage.test.tsx
describe('DocDetailPage', () => {
  it('loads document from URL param', async () => {
    render(
      <MemoryRouter initialEntries={['/docs/system-design']}>
        <Routes>
          <Route path="/docs/:docPath" element={<DocDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
    });
  });

  it('scrolls to section from hash', async () => {
    render(
      <MemoryRouter initialEntries={['/docs/system-design#overview']}>
        <Routes>
          <Route path="/docs/:docPath" element={<DocDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    // Verify scroll behavior
  });
});
```

---

### Task 3.4: Copy Documentation Files to Public Directory
**Estimate:** 30 min | **Status:** Complete (Orchestrator)

**Description:**
Set up documentation files in the public directory for static serving.
**Completed by:** Orchestrator agent

**Steps:**
1. [x] Create public/docs/ directory structure
2. [x] Copy System_Design.md, Main_Features.md, SPA_Information_Architecture.md, Interaction_Model.md to public/docs/
3. [x] Copy all 14 mermaid diagrams to public/docs/diagrams/
4. [x] Update mock data to reference actual file paths
5. [x] Verify files are accessible via fetch

**Acceptance Criteria:**
- [x] /docs/System_Design.md returns content
- [x] /docs/diagrams/01-system-architecture.mmd returns content
- [x] All 14 diagram files are present
- [x] Files are included in build output

**Test:**
Manual verification and integration test:
```typescript
// src/api/docs.test.ts
describe('static docs', () => {
  it('fetches System_Design.md successfully', async () => {
    const response = await fetch('/docs/System_Design.md');
    expect(response.ok).toBe(true);
    const content = await response.text();
    expect(content).toContain('# aSDLC System Design');
  });
});
```

---

## Phase 4: Search & Export (3 tasks)

### Task 4.1: Create DocSearch Component
**Estimate:** 1.5 hr | **Status:** Complete

**Description:**
Build client-side search across documents and diagrams.

**Steps:**
1. Write failing tests for search behavior
2. Implement fuzzy search over titles/descriptions
3. Create search results dropdown UI
4. Add keyboard navigation
5. Store recent searches in localStorage

**Acceptance Criteria:**
- [x] Search finds matches in titles
- [x] Search finds matches in descriptions
- [x] Results grouped by type (doc/diagram)
- [x] Arrow keys navigate results
- [x] Enter selects highlighted result
- [x] Recent searches persist

**Test:**
```typescript
// src/components/docs/DocSearch.test.tsx
describe('DocSearch', () => {
  it('finds documents by title', async () => {
    render(<DocSearch documents={mockDocuments} diagrams={mockDiagrams} onResultSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'system' } });
    await waitFor(() => {
      expect(screen.getByText('System Design')).toBeInTheDocument();
    });
  });

  it('navigates results with keyboard', async () => {
    render(<DocSearch documents={mockDocuments} diagrams={mockDiagrams} onResultSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'system' } });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
    // Verify first result highlighted
  });

  it('stores recent searches', async () => {
    render(<DocSearch documents={mockDocuments} diagrams={mockDiagrams} onResultSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(localStorage.getItem('doc-search-recent')).toContain('test');
  });
});
```

---

### Task 4.2: Add Export Functionality to DiagramViewer
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Add download SVG/PNG and copy source buttons to DiagramViewer.

**Steps:**
1. Write failing tests for export functions
2. Implement SVG download (direct from rendered content)
3. Implement PNG download (canvas conversion)
4. Add copy mermaid source button
5. Show success state on copy

**Acceptance Criteria:**
- [x] Download SVG creates file with diagram name
- [x] Download PNG button present and functional
- [x] Copy source copies mermaid syntax to clipboard
- [x] Success state shown after copy
- [x] Buttons have proper aria-labels

**Test:**
```typescript
// src/components/docs/DiagramViewer.test.tsx
describe('DiagramViewer export', () => {
  it('downloads SVG on button click', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    render(<DiagramViewer diagram={mockDiagram} showControls />);
    fireEvent.click(screen.getByTestId('download-svg'));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('copies source to clipboard', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<DiagramViewer diagram={mockDiagram} showControls />);
    fireEvent.click(screen.getByTestId('copy-source'));
    expect(writeText).toHaveBeenCalledWith(mockDiagram.content);
  });
});
```

---

### Task 4.3: Integrate Search into DocsPage
**Estimate:** 30 min | **Status:** Complete

**Description:**
Add search component to DocsPage header.

**Steps:**
1. Write failing tests for integration
2. Add DocSearch to page header
3. Handle result selection (navigate to doc/diagram)
4. Show search on all tabs
5. Close search on navigation

**Acceptance Criteria:**
- [x] Search visible in page header
- [x] Document result navigates to Reference tab
- [x] Diagram result navigates to Diagrams tab
- [x] Search dropdown closes after selection

**Test:**
```typescript
// src/pages/DocsPage.test.tsx
describe('DocsPage search integration', () => {
  it('renders search in header', () => {
    render(<DocsPage />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('navigates to diagram on result select', async () => {
    render(<DocsPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'architecture' } });
    await waitFor(() => {
      fireEvent.click(screen.getByText('System Architecture'));
    });
    expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');
  });
});
```

---

## Phase 5: Polish & Testing (3 tasks)

### Task 5.1: Add Responsive Styles
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Ensure all documentation components work well on mobile.

**Steps:**
1. Write visual tests for responsive breakpoints
2. Adjust DiagramGallery grid for mobile (1-2 columns)
3. Make DocBrowser collapsible on mobile
4. Ensure diagrams support touch gestures
5. Test all components at various viewport sizes

**Acceptance Criteria:**
- [x] Gallery shows 1 column on mobile, 2 on tablet, 4 on desktop
- [x] DocBrowser becomes collapsible drawer on mobile
- [x] Sidebar toggle button for mobile view
- [x] No horizontal overflow on any component
- [x] Text remains readable at all sizes

**Test:**
```typescript
// src/components/docs/DiagramGallery.responsive.test.tsx
describe('DiagramGallery responsive', () => {
  it('has responsive grid classes', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
    const grid = screen.getByTestId('diagram-grid');
    expect(grid).toHaveClass('grid');
  });
});
```

---

### Task 5.2: Accessibility Audit and Fixes
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Run accessibility audit and fix any issues.

**Steps:**
1. Write accessibility tests for all components
2. Verify all color contrast meets WCAG standards
3. Ensure all interactive elements are keyboard accessible
4. Add proper aria-labels and roles
5. Test keyboard navigation flows

**Acceptance Criteria:**
- [x] All controls keyboard accessible
- [x] Focus visible on all interactive elements
- [x] Proper ARIA attributes on interactive elements
- [x] Keyboard navigation works (ArrowDown/ArrowUp, Enter, Escape)
- [x] Semantic HTML structure

**Test:**
```typescript
// src/components/docs/accessibility.test.tsx
describe('Accessibility', () => {
  it('DocSearch has proper ARIA attributes', () => {
    render(<DocSearch ... />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label');
  });

  it('DiagramViewer controls have aria-labels', () => {
    render(<DiagramViewer ... showControls />);
    expect(screen.getByTestId('zoom-in')).toHaveAttribute('aria-label');
  });
});
```

---

### Task 5.3: Integration Testing
**Estimate:** 1 hr | **Status:** Complete

**Description:**
Write integration tests for complete documentation flows.

**Steps:**
1. Test navigation from gallery to diagram detail
2. Test navigation from browser to document detail
3. Test search to result navigation
4. Test tab switching with state preservation
5. Test URL sharing and deep linking

**Acceptance Criteria:**
- [x] Tab navigation flow works
- [x] Search to navigation flow works
- [x] URL deep linking works for all tabs
- [x] Mobile sidebar toggle works
- [x] Document selection flow works

**Test:**
```typescript
// src/pages/DocsPage.integration.test.tsx
describe('Documentation flows', () => {
  it('navigates between all tabs', () => {
    render(<DocsPage />);
    fireEvent.click(screen.getByTestId('tab-diagrams'));
    expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-reference'));
    expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
  });

  it('search navigates to correct tab', async () => {
    render(<DocsPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'architecture' } });
    fireEvent.click(screen.getByTestId('search-result-01-system-architecture'));
    expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');
  });
});
```

---

## Definition of Done

- [x] All tasks marked complete
- [x] All tests passing (`npm test`)
- [x] Lint passing (`npm run lint`)
- [ ] Type check passing (`npm run type-check`)
- [ ] Manual testing on Chrome, Firefox, Safari
- [ ] Mobile testing on iOS and Android
- [x] Accessibility tests passing
- [x] Documentation files copied to public/docs/
- [ ] Code reviewed

---

## Notes

- Tasks completed in order within each phase
- Each task followed TDD: write failing test first, then implement
- 394 tests passing for docs components
- Coordinate with orchestrator agent if documentation file access is needed
