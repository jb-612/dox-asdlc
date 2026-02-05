# Smart Product Saver - Tasks

## Phase 1: Backend Foundation

### T1.1: Project Setup
- [x] Create directory structure
- [ ] Initialize Python project with pyproject.toml
- [ ] Set up FastAPI application skeleton
- [ ] Configure logging and error handling

### T1.2: Database Models
- [ ] Create SQLAlchemy models (Product, Collection, User)
- [ ] Set up Alembic migrations
- [ ] Create initial migration
- [ ] Add seed data for development

### T1.3: Authentication
- [ ] Implement user registration endpoint
- [ ] Implement login endpoint (returns JWT)
- [ ] Create auth middleware
- [ ] Implement API key generation for extension

### T1.4: Product CRUD API
- [ ] POST /api/products - Create product
- [ ] GET /api/products - List with pagination
- [ ] GET /api/products/{id} - Get single
- [ ] PUT /api/products/{id} - Update
- [ ] DELETE /api/products/{id} - Delete

### T1.5: Collection CRUD API
- [ ] POST /api/collections - Create
- [ ] GET /api/collections - List
- [ ] GET /api/collections/{id} - Get with products
- [ ] PUT /api/collections/{id} - Update
- [ ] DELETE /api/collections/{id} - Delete

### T1.6: Search API
- [ ] GET /api/search - Basic text search
- [ ] Add filters (collection, domain, date)
- [ ] Integrate Elasticsearch (optional for v1)

---

## Phase 2: Chrome Extension MVP

### T2.1: Extension Setup
- [ ] Create manifest.json (Manifest V3)
- [ ] Set up service worker (background.js)
- [ ] Configure permissions (activeTab, storage, host)
- [ ] Create extension icons (16, 32, 48, 128px)

### T2.2: Content Script
- [ ] Create content.js for page extraction
- [ ] Implement Open Graph extraction
- [ ] Implement Schema.org Product extraction
- [ ] Implement fallback extraction (title, images, meta)
- [ ] Handle edge cases (SPAs, lazy-loaded content)

### T2.3: Popup UI
- [ ] Create popup.html structure
- [ ] Style with minimal CSS
- [ ] Show extracted product preview
- [ ] Add notes input field
- [ ] Add collection selector
- [ ] Add save button with loading state

### T2.4: API Integration
- [ ] Create api-client.js
- [ ] Implement login/token storage
- [ ] Implement save product call
- [ ] Handle errors and retry logic
- [ ] Show success/error notifications

### T2.5: Context Menu
- [ ] Add "Save to Smart Product Saver" context menu
- [ ] Handle right-click on images
- [ ] Handle right-click on links

---

## Phase 3: Mobile-First SPA

### T3.1: Frontend Setup
- [ ] Initialize Vite + React project
- [ ] Configure TailwindCSS
- [ ] Set up React Router
- [ ] Configure Zustand for state management
- [ ] Set up React Query for API calls

### T3.2: Layout Components
- [ ] Create AppLayout (header, sidebar, content)
- [ ] Create responsive sidebar (mobile: bottom sheet)
- [ ] Create header with search bar
- [ ] Create mobile navigation

### T3.3: Authentication UI
- [ ] Create LoginPage
- [ ] Create RegisterPage
- [ ] Create auth context/hooks
- [ ] Implement protected routes

### T3.4: Product List View
- [ ] Create ProductCard component
- [ ] Create ProductList with grid/list toggle
- [ ] Implement infinite scroll
- [ ] Add filter chips
- [ ] Add sort options

### T3.5: Product Detail View
- [ ] Create ProductDetail page
- [ ] Show all product attributes
- [ ] Implement edit mode
- [ ] Add delete with confirmation

### T3.6: Collection Management
- [ ] Create CollectionSidebar
- [ ] Create collection CRUD modals
- [ ] Implement drag-drop organization
- [ ] Show product counts per collection

### T3.7: Compare View
- [ ] Create CompareView component
- [ ] Implement product selection UI
- [ ] Side-by-side comparison layout
- [ ] Mobile swipeable cards
- [ ] Highlight differences

### T3.8: Search
- [ ] Create SearchBar component
- [ ] Implement debounced search
- [ ] Show search results with highlighting
- [ ] Add search filters

---

## Phase 4: Docker & Deployment

### T4.1: Dockerize Backend
- [ ] Create backend Dockerfile
- [ ] Configure for production (gunicorn/uvicorn)
- [ ] Add health check endpoint

### T4.2: Dockerize Frontend
- [ ] Create frontend Dockerfile (multi-stage build)
- [ ] Configure nginx for SPA routing
- [ ] Add environment variable injection

### T4.3: Docker Compose
- [ ] Create docker-compose.yml
- [ ] Configure PostgreSQL service
- [ ] Configure Elasticsearch service (optional)
- [ ] Add volume mounts for data persistence
- [ ] Configure networking

### T4.4: Documentation
- [ ] Write README.md
- [ ] Document API endpoints
- [ ] Create extension installation guide
- [ ] Add development setup instructions

---

## Definition of Done

- [ ] Code passes linting
- [ ] Unit tests for critical paths
- [ ] API endpoints documented
- [ ] Works in Docker Compose environment
- [ ] Extension loads in Chrome without errors
- [ ] Mobile-responsive UI verified
