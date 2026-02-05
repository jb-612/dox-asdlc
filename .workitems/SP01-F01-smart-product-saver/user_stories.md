# Smart Product Saver - User Stories

## Epic: Product Capture

### US-001: One-Click Product Save
**As a** user browsing a product page
**I want to** save the product with one click
**So that** I can review it later without losing the link

**Acceptance Criteria:**
- [ ] Extension icon shows badge when on a product-like page
- [ ] Clicking the extension icon captures: URL, title, primary image, price (if found)
- [ ] Capture completes in under 2 seconds
- [ ] Success notification shows thumbnail of saved product
- [ ] Works on pages without explicit product schema (fallback extraction)

### US-002: Add Notes While Capturing
**As a** user saving a product
**I want to** add quick notes during capture
**So that** I remember why I saved it

**Acceptance Criteria:**
- [ ] Optional text field in capture popup
- [ ] Notes saved with product
- [ ] Can leave notes empty (not required)

### US-003: Save to Collection
**As a** user saving a product
**I want to** choose which collection to save it to
**So that** products are organized from the start

**Acceptance Criteria:**
- [ ] Dropdown shows existing collections
- [ ] "No collection" option available
- [ ] Can create new collection inline
- [ ] Remembers last used collection as default

---

## Epic: Product Management

### US-004: View Saved Products
**As a** user
**I want to** see all my saved products in a list
**So that** I can browse what I've collected

**Acceptance Criteria:**
- [ ] Grid view showing product thumbnails
- [ ] List view option for compact display
- [ ] Shows: thumbnail, title, price, domain, date saved
- [ ] Infinite scroll or pagination (20+ products)
- [ ] Mobile-responsive layout

### US-005: Filter Products
**As a** user with many saved products
**I want to** filter by collection, domain, or date
**So that** I can find products quickly

**Acceptance Criteria:**
- [ ] Filter by collection (dropdown)
- [ ] Filter by domain (e.g., "amazon.com only")
- [ ] Filter by date range
- [ ] Filters can be combined
- [ ] Active filters shown as chips

### US-006: Edit Product Details
**As a** user
**I want to** edit a saved product's notes and attributes
**So that** I can correct or add information

**Acceptance Criteria:**
- [ ] Edit title, notes, price manually
- [ ] Changes saved on blur or explicit save
- [ ] Can add custom attributes (key-value)
- [ ] View original URL (clickable)

### US-007: Delete Products
**As a** user
**I want to** delete products I no longer need
**So that** my collection stays relevant

**Acceptance Criteria:**
- [ ] Delete single product with confirmation
- [ ] Bulk delete with multi-select
- [ ] Undo available for 5 seconds after delete

---

## Epic: Collections

### US-008: Create Collections
**As a** user
**I want to** create named collections
**So that** I can organize products by category or project

**Acceptance Criteria:**
- [ ] Create collection with name and optional description
- [ ] Choose accent color for visual distinction
- [ ] Collection appears in sidebar immediately

### US-009: Manage Collections
**As a** user
**I want to** rename, reorder, and delete collections
**So that** my organization stays current

**Acceptance Criteria:**
- [ ] Rename collection inline
- [ ] Drag to reorder collections
- [ ] Delete collection (products move to "Uncategorized")
- [ ] Nested collections (one level deep)

### US-010: Move Products Between Collections
**As a** user
**I want to** move products to different collections
**So that** I can reorganize as my needs change

**Acceptance Criteria:**
- [ ] Drag-drop product to collection in sidebar
- [ ] Move via product context menu
- [ ] Bulk move with multi-select

---

## Epic: Search & Compare

### US-011: Search Products
**As a** user
**I want to** search my saved products by keyword
**So that** I can find specific items quickly

**Acceptance Criteria:**
- [ ] Search bar at top of product list
- [ ] Searches: title, description, notes, domain
- [ ] Results update as you type (debounced)
- [ ] Highlight matching text in results

### US-012: Compare Products
**As a** user
**I want to** compare 2-4 products side by side
**So that** I can make purchase decisions

**Acceptance Criteria:**
- [ ] Select products for comparison (checkbox)
- [ ] Compare button appears when 2+ selected
- [ ] Side-by-side view shows: image, title, price, attributes
- [ ] Highlight differences (e.g., price variance)
- [ ] Mobile: swipeable cards instead of columns

---

## Epic: Authentication

### US-013: Create Account
**As a** new user
**I want to** create an account
**So that** my products are saved securely

**Acceptance Criteria:**
- [ ] Register with email and password
- [ ] Email validation (format)
- [ ] Password requirements shown
- [ ] Redirects to product list after registration

### US-014: Login
**As a** returning user
**I want to** log in to access my products
**So that** I can continue where I left off

**Acceptance Criteria:**
- [ ] Login with email and password
- [ ] "Remember me" option
- [ ] Error message for invalid credentials
- [ ] Redirect to last viewed page

### US-015: Extension Authentication
**As a** user with the extension installed
**I want to** connect the extension to my account
**So that** captures go to my account

**Acceptance Criteria:**
- [ ] Extension shows login prompt if not connected
- [ ] Can enter API key or login credentials
- [ ] Connection status visible in extension popup
- [ ] Stays logged in across browser restarts

---

## Non-Functional Requirements

### Performance
- Page load under 2 seconds
- API responses under 500ms
- Extension capture under 2 seconds

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly

### Mobile
- Fully responsive (320px - 1920px)
- Touch-friendly targets (44px minimum)
- Mobile-first CSS approach
