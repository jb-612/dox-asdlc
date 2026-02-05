# Smart Product Saver - Technical Design

## Overview

A unified capture → aggregate → manage solution for saving products from any website. Users can capture products with one click, organize them into collections, and compare options side-by-side.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CHROME EXTENSION (Manifest V3)                                 │
│  - One-click capture from any product page                      │
│  - Extract: URL, title, images, price, description              │
│  - Optional user notes                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/products
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI + PostgreSQL)                                 │
│  - Store captured products with metadata                        │
│  - LLM-powered attribute extraction (price, dimensions)         │
│  - Natural language search (Elasticsearch)                      │
│  - Collections/folders management                               │
│  - REST API for all operations                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  MOBILE-FIRST SPA (React + Vite + TailwindCSS)                  │
│  - List saved products with filters                             │
│  - Organize into collections                                    │
│  - Edit notes & attributes                                      │
│  - Side-by-side comparison view                                 │
│  - Natural language search bar                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Product
```python
class Product:
    id: UUID
    url: str                    # Original product URL
    title: str                  # Product title
    description: str | None     # Product description
    price: Decimal | None       # Extracted price
    currency: str | None        # Price currency (USD, EUR, etc.)
    images: list[str]           # List of image URLs
    thumbnail: str | None       # Primary thumbnail URL
    domain: str                 # Source domain (amazon.com, etc.)
    raw_html: str | None        # Captured HTML for re-extraction
    attributes: dict            # LLM-extracted attributes (dimensions, color, etc.)
    user_notes: str | None      # User-provided notes
    user_id: UUID               # Owner
    collection_id: UUID | None  # Optional collection
    created_at: datetime
    updated_at: datetime
```

### Collection
```python
class Collection:
    id: UUID
    name: str
    description: str | None
    color: str | None           # UI accent color
    user_id: UUID
    parent_id: UUID | None      # Nested collections
    created_at: datetime
    updated_at: datetime
```

### User
```python
class User:
    id: UUID
    email: str
    api_key: str               # For extension auth
    created_at: datetime
```

## API Endpoints

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/products | Create new product |
| GET | /api/products | List products (paginated, filterable) |
| GET | /api/products/{id} | Get single product |
| PUT | /api/products/{id} | Update product |
| DELETE | /api/products/{id} | Delete product |
| POST | /api/products/{id}/extract | Re-run LLM extraction |

### Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/collections | Create collection |
| GET | /api/collections | List collections |
| GET | /api/collections/{id} | Get collection with products |
| PUT | /api/collections/{id} | Update collection |
| DELETE | /api/collections/{id} | Delete collection |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/search?q= | Natural language search |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get auth token |
| GET | /api/auth/me | Get current user |

## Chrome Extension Architecture

### Manifest V3 Components
- **Service Worker (background.js)**: Handles extension lifecycle, context menu, API calls
- **Content Script (content.js)**: Extracts product data from pages
- **Popup (popup.html/js)**: Quick capture UI

### Extraction Strategy
1. **DOM Parsing**: Extract structured data (Open Graph, Schema.org, meta tags)
2. **Heuristics**: Site-specific selectors for common e-commerce sites
3. **Fallback**: Generic extraction (title, first image, URL)

### Supported Data Formats
- Open Graph (`og:title`, `og:image`, `og:description`)
- Schema.org Product (`@type: "Product"`)
- Twitter Cards
- Standard meta tags

## Frontend Components

### Core Views
- **ProductList**: Grid/list view of saved products with filters
- **ProductCard**: Individual product display with actions
- **ProductDetail**: Full product view with edit capability
- **CompareView**: Side-by-side comparison of 2-4 products
- **CollectionSidebar**: Collection navigation and management
- **SearchBar**: Natural language search input

### State Management
- Zustand for global state (products, collections, UI state)
- React Query for API data fetching and caching

## Security Considerations

### Authentication
- Token-based auth (JWT or simple API key for v1)
- Extension stores token securely in `chrome.storage.local`
- All API endpoints require authentication except register/login

### Data Privacy
- Products are private to each user
- No cross-user data sharing in v1
- HTTPS required for all API communication

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Extension | Manifest V3 + Vanilla JS | Modern, lightweight, no build step |
| Backend | FastAPI + PostgreSQL | Type safety, async, good ecosystem |
| Search | Elasticsearch | Full-text + vector search ready |
| Frontend | React + Vite + Tailwind | Fast dev, mobile-first CSS |
| ORM | SQLAlchemy 2.0 | Async support, type hints |
| Migrations | Alembic | Industry standard |

## Future Enhancements (v2+)
- LLM-powered attribute extraction
- Price tracking and alerts
- Browser extension for Firefox
- Mobile app (React Native)
- Sharing collections publicly
- Import from browser bookmarks
