# Smart Product Saver

A unified capture → aggregate → manage solution for saving products from any website.

## Features

- **Chrome Extension**: One-click product capture from any website
- **Product Extraction**: Automatic extraction of title, price, images, and description
- **Collections**: Organize products into folders/collections
- **Search**: Full-text search across all saved products
- **Compare**: Side-by-side comparison of 2-4 products
- **Mobile-First**: Responsive design optimized for mobile devices

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CHROME EXTENSION (Manifest V3)                                 │
│  - Content script extracts product data                         │
│  - Popup UI for quick capture                                   │
│  - Context menu integration                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/products
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI + PostgreSQL)                                 │
│  - REST API for products, collections, search                   │
│  - JWT + API key authentication                                 │
│  - SQLAlchemy ORM                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + TailwindCSS)                          │
│  - Mobile-first responsive design                               │
│  - Product list with grid/list views                            │
│  - Collection sidebar                                           │
│  - Compare view                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Docker Compose (Recommended)

```bash
cd side-projects/smart-product-saver
docker compose up -d
```

Access:
- **Frontend**: http://localhost:3456
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Test Credentials

After starting the services, register a new account or use these test credentials:
- **Email:** test@example.com
- **Password:** password123
- **API Key:** `SQkbWeBPLFDqGAUn1UuXfFuwNhTPPFy7tqMK3CFfTyQ`

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Extension:**
1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

## Extension Distribution

### For Testers (Developer Mode)

1. Download `smart-product-saver-extension-v1.0.0.zip`
2. Extract to a folder
3. Open Chrome → `chrome://extensions`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" → select the extracted folder
6. Navigate to any product page and click the extension icon

### Chrome Web Store (Production)

For public distribution:
1. Create a Chrome Web Store developer account ($5 one-time fee)
2. Zip the extension folder
3. Upload to Chrome Web Store dashboard
4. Publish as unlisted or public

## Configuration

### Environment Variables

**Backend:**
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection string |
| `SECRET_KEY` | `change-me...` | JWT signing key |
| `CORS_ORIGINS` | `["http://localhost:3456"]` | Allowed CORS origins |

### Extension Setup

1. Register an account at http://localhost:3456
2. Go to Settings to copy your API key
3. Click the extension icon
4. Enter server URL: `http://localhost:8000`
5. Paste your API key
6. Click "Connect"

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user

### Products
- `POST /api/products` - Create product
- `GET /api/products` - List products (with pagination)
- `GET /api/products/{id}` - Get product
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product

### Collections
- `POST /api/collections` - Create collection
- `GET /api/collections` - List collections
- `GET /api/collections/{id}` - Get collection with products
- `PUT /api/collections/{id}` - Update collection
- `DELETE /api/collections/{id}` - Delete collection

### Search
- `GET /api/search?q=query` - Search products

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, SQLAlchemy 2.0, PostgreSQL, asyncpg |
| Frontend | React 18, Vite, TailwindCSS, Zustand, React Query |
| Extension | Chrome Manifest V3, Vanilla JS |
| Infrastructure | Docker Compose |

## Project Structure

```
smart-product-saver/
├── backend/
│   ├── main.py           # FastAPI app entry
│   ├── config.py         # Settings
│   ├── database.py       # Database setup
│   ├── models/           # SQLAlchemy models
│   │   ├── user.py
│   │   ├── product.py
│   │   └── collection.py
│   ├── routers/          # API routes
│   │   ├── auth.py
│   │   ├── products.py
│   │   ├── collections.py
│   │   └── search.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductList.jsx
│   │   │   ├── CompareView.jsx
│   │   │   └── ...
│   │   ├── stores/       # Zustand stores
│   │   └── api/          # API client
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
├── extension/
│   ├── manifest.json
│   ├── icons/
│   └── src/
│       ├── background.js  # Service worker
│       ├── content.js     # Product extraction
│       └── popup/         # Extension popup UI
├── docker-compose.yml
└── README.md
```

## Product Extraction

The extension extracts product data using multiple strategies:

1. **Schema.org** - JSON-LD structured data
2. **Open Graph** - Facebook meta tags
3. **Twitter Cards** - Twitter meta tags
4. **DOM Fallback** - Direct DOM element detection

Extracted fields:
- Title, description, URL
- Price, currency
- Thumbnail image
- Brand (when available)

## Troubleshooting

### Extension shows "[object Object]" error
The extension has error handling for FastAPI validation errors. If you see this, ensure the backend is running and accessible at the configured URL.

### PostgreSQL "No space left on device"
Run Docker cleanup:
```bash
docker image prune -f
docker builder prune -f
```

### Backend 500 on registration
Ensure `bcrypt==4.2.0` is installed (pinned for passlib compatibility).

## License

MIT
