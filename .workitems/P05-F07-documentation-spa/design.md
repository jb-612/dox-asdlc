# P05-F07 Documentation SPA - Technical Design

**Version:** 1.0
**Date:** 2026-01-24
**Status:** Draft

## 1. Overview

Integrate system documentation and Mermaid diagrams into the HITL UI SPA, replacing mock data in the DocsPage with real documentation content from the repository.

### 1.1 Goals

1. Render Mermaid diagrams (14 files from wiki/Diagrams/) interactively in the browser
2. Load and display system documentation (System_Design.md, Main_Features.md, etc.)
3. Provide navigation and search across all documentation
4. Maintain responsive, accessible UI consistent with existing SPA design

### 1.2 Non-Goals

- Real-time collaborative editing of documentation
- User-generated documentation (read-only from repo)
- Full-text indexing backend (client-side search only)

## 2. Technical Architecture

### 2.1 Mermaid.js Integration

**Library:** `mermaid` (npm package)

**Approach:**
- Install mermaid as a production dependency
- Create a `MermaidDiagram` component that renders `.mmd` content
- Use mermaid's `render()` API for SVG generation
- Support dark/light theme switching via mermaid configuration

**Configuration:**
```typescript
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,  // Manual render control
  theme: 'default',    // Or 'dark' based on UI theme
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif',
});
```

**Rendering Strategy:**
- Lazy render diagrams when they scroll into view (IntersectionObserver)
- Cache rendered SVG to avoid re-rendering on navigation
- Show loading skeleton while rendering large diagrams

### 2.2 Documentation Loading Strategy

**Option A: Static File Serving (Recommended for MVP)**

Serve documentation files as static assets through Vite's public directory or a dedicated docs endpoint.

```
docker/hitl-ui/public/docs/
  system-design.md
  main-features.md
  diagrams/
    00-reference-pipeline.mmd
    01-system-architecture.mmd
    ...
```

**Fetch Pattern:**
```typescript
// src/api/docs.ts
export async function fetchDocument(path: string): Promise<string> {
  const response = await fetch(`/docs/${path}`);
  if (!response.ok) throw new Error(`Document not found: ${path}`);
  return response.text();
}

export async function fetchDiagram(name: string): Promise<string> {
  const response = await fetch(`/docs/diagrams/${name}.mmd`);
  if (!response.ok) throw new Error(`Diagram not found: ${name}`);
  return response.text();
}
```

**Option B: API Endpoint (Future Enhancement)**

Backend serves documentation with metadata, versioning, and search support:
```
GET /api/docs - List available documents
GET /api/docs/:path - Get document content
GET /api/docs/search?q=query - Search documents
```

For MVP, use Option A with static files. The API layer is designed to support either approach.

### 2.3 Component Architecture

```
src/
  components/
    docs/
      MermaidDiagram.tsx          # Mermaid rendering component
      MermaidDiagram.test.tsx
      DiagramViewer.tsx           # Full-screen diagram viewer with controls
      DiagramViewer.test.tsx
      DiagramGallery.tsx          # Grid of diagram thumbnails
      DiagramGallery.test.tsx
      DocBrowser.tsx              # Document list with navigation
      DocBrowser.test.tsx
      DocViewer.tsx               # Markdown document viewer
      DocViewer.test.tsx
      DocSearch.tsx               # Client-side search component
      DocSearch.test.tsx
  api/
    docs.ts                       # Documentation fetching API
    docs.test.ts
    mocks/
      docs.ts                     # Mock documentation data
  pages/
    DocsPage.tsx                  # Updated with real content
    DiagramDetailPage.tsx         # Full diagram view (new route)
```

### 2.4 DocsPage Restructure

Current tabs:
- **Learn** - System overview, methodology, glossary
- **Apply** - Getting started, workflows

Proposed structure:
- **Overview** - BlueprintMap, MethodologyStepper (existing components)
- **Diagrams** - DiagramGallery with all system diagrams
- **Reference** - DocBrowser with System_Design.md, Main_Features.md, etc.
- **Glossary** - InteractiveGlossary (existing component)

### 2.5 Routing

Add route for diagram detail view:

```typescript
// App.tsx additions
<Route path="docs" element={<DocsPage />} />
<Route path="docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
<Route path="docs/:docPath" element={<DocDetailPage />} />
```

### 2.6 Data Model

```typescript
// src/api/types.ts additions

export interface DocumentMeta {
  id: string;
  title: string;
  path: string;
  category: 'system' | 'feature' | 'architecture' | 'workflow';
  description: string;
  lastModified?: string;
}

export interface DiagramMeta {
  id: string;
  title: string;
  filename: string;
  category: 'architecture' | 'flow' | 'sequence' | 'decision';
  description: string;
  thumbnail?: string;  // Base64 or URL to pre-rendered thumbnail
}

export interface DocumentContent {
  meta: DocumentMeta;
  content: string;  // Markdown content
}

export interface DiagramContent {
  meta: DiagramMeta;
  content: string;  // Mermaid syntax
}
```

### 2.7 Mock Data Structure

```typescript
// src/api/mocks/docs.ts

export const mockDocuments: DocumentMeta[] = [
  {
    id: 'system-design',
    title: 'System Design',
    path: 'System_Design.md',
    category: 'system',
    description: 'Core system architecture and design principles',
  },
  {
    id: 'main-features',
    title: 'Main Features',
    path: 'Main_Features.md',
    category: 'feature',
    description: 'Feature specifications and capabilities',
  },
  // ...
];

export const mockDiagrams: DiagramMeta[] = [
  {
    id: '00-reference-pipeline',
    title: 'Reference Pipeline',
    filename: '00-Reference-Pipeline.mmd',
    category: 'architecture',
    description: 'High-level aSDLC pipeline overview',
  },
  {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-System-Architecture.mmd',
    category: 'architecture',
    description: 'System component overview',
  },
  // ... 12 more diagrams
];
```

## 3. Component Specifications

### 3.1 MermaidDiagram

**Props:**
```typescript
interface MermaidDiagramProps {
  content: string;        // Mermaid syntax
  className?: string;
  onRender?: (svg: string) => void;
  onError?: (error: Error) => void;
}
```

**Behavior:**
- Renders mermaid content to SVG on mount
- Shows loading skeleton during render
- Displays error state if syntax is invalid
- Supports zoom/pan via mouse/touch
- Accessible: SVG has aria-label with diagram title

### 3.2 DiagramViewer

**Props:**
```typescript
interface DiagramViewerProps {
  diagram: DiagramContent;
  onClose?: () => void;
  showControls?: boolean;
}
```

**Features:**
- Full-width/full-height rendering
- Zoom controls (fit, 100%, zoom in/out)
- Pan via drag
- Download as SVG/PNG
- Copy mermaid source
- Toggle dark/light theme

### 3.3 DiagramGallery

**Props:**
```typescript
interface DiagramGalleryProps {
  diagrams: DiagramMeta[];
  onSelect: (diagramId: string) => void;
  filter?: string;
}
```

**Features:**
- Grid layout (responsive: 1-4 columns)
- Category filter tabs
- Thumbnail preview (rendered mermaid or placeholder)
- Click to open DiagramViewer
- Keyboard navigation

### 3.4 DocBrowser

**Props:**
```typescript
interface DocBrowserProps {
  documents: DocumentMeta[];
  selectedId?: string;
  onSelect: (docId: string) => void;
}
```

**Features:**
- Sidebar list grouped by category
- Active document highlight
- Document metadata preview
- Collapsible category sections

### 3.5 DocViewer

**Props:**
```typescript
interface DocViewerProps {
  document: DocumentContent;
  className?: string;
}
```

**Features:**
- Uses existing MarkdownRenderer internally
- Table of contents sidebar
- Code block syntax highlighting (existing)
- Copy code button (existing)
- Embedded mermaid blocks rendered inline

### 3.6 DocSearch

**Props:**
```typescript
interface DocSearchProps {
  documents: DocumentMeta[];
  diagrams: DiagramMeta[];
  onResultSelect: (type: 'doc' | 'diagram', id: string) => void;
}
```

**Features:**
- Fuzzy search across titles and descriptions
- Result categorization (docs vs diagrams)
- Keyboard navigation
- Recent searches (localStorage)

## 4. State Management

Use React Query for data fetching with local state for UI:

```typescript
// src/api/docs.ts

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: listDocuments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDocument(docId: string) {
  return useQuery({
    queryKey: ['document', docId],
    queryFn: () => getDocument(docId),
    enabled: !!docId,
  });
}

export function useDiagrams() {
  return useQuery({
    queryKey: ['diagrams'],
    queryFn: listDiagrams,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDiagram(diagramId: string) {
  return useQuery({
    queryKey: ['diagram', diagramId],
    queryFn: () => getDiagram(diagramId),
    enabled: !!diagramId,
  });
}
```

## 5. Accessibility

- All diagrams have descriptive aria-labels
- Keyboard navigation for gallery and browser
- Focus management when opening/closing viewers
- Color contrast compliance for text overlays
- Screen reader announcements for loading/error states

## 6. Performance Considerations

1. **Lazy Loading:** Diagrams render on scroll into view
2. **Caching:** React Query caches fetched content
3. **Code Splitting:** DiagramViewer loaded via React.lazy
4. **SVG Optimization:** Mermaid outputs optimized SVG
5. **Thumbnail Pre-render:** Consider pre-rendering diagram thumbnails at build time

## 7. Testing Strategy

- **Unit Tests:** Each component with mocked data
- **Integration Tests:** DocsPage with mock API responses
- **Visual Tests:** Mermaid rendering produces expected output
- **Accessibility Tests:** axe-core integration

## 8. Dependencies

**New Production Dependencies:**
```json
{
  "mermaid": "^10.6.0"
}
```

**No new dev dependencies required** - existing testing setup is sufficient.

## 9. Migration Path

1. Install mermaid dependency
2. Create mock data layer for documentation
3. Build components with tests (TDD)
4. Update DocsPage to use new components
5. Add routes for detail views
6. Copy documentation files to public/docs/
7. Remove mock data from DocsPage when complete

## 10. Open Questions

1. Should diagrams support user annotations/notes?
2. Should we implement diagram export to various formats (PNG, PDF)?
3. Should documentation support versioning in the UI?
4. Should we add a print-friendly view for documentation?

## 11. Future Enhancements

- Full-text search with backend indexing
- Documentation versioning tied to git tags
- Collaborative annotations
- Diagram diff view between versions
- Integration with Plane CE for task linking
