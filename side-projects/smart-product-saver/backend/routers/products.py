"""Products router."""

import uuid
from datetime import datetime
from decimal import Decimal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.product import Product
from models.user import User
from routers.auth import get_current_user

router = APIRouter()


# Schemas
class ProductCreate(BaseModel):
    url: HttpUrl
    title: str
    description: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    images: list[str] = []
    thumbnail: str | None = None
    raw_html: str | None = None
    attributes: dict = {}
    user_notes: str | None = None
    collection_id: uuid.UUID | None = None


class ProductUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    images: list[str] | None = None
    thumbnail: str | None = None
    attributes: dict | None = None
    user_notes: str | None = None
    collection_id: uuid.UUID | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    url: str
    title: str
    description: str | None
    price: Decimal | None
    currency: str | None
    images: list[str]
    thumbnail: str | None
    domain: str
    attributes: dict
    user_notes: str | None
    collection_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Endpoints
@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product."""
    # Extract domain from URL
    parsed_url = urlparse(str(product_data.url))
    domain = parsed_url.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]

    product = Product(
        url=str(product_data.url),
        title=product_data.title,
        description=product_data.description,
        price=product_data.price,
        currency=product_data.currency,
        images=product_data.images,
        thumbnail=product_data.thumbnail or (product_data.images[0] if product_data.images else None),
        domain=domain,
        raw_html=product_data.raw_html,
        attributes=product_data.attributes,
        user_notes=product_data.user_notes,
        user_id=current_user.id,
        collection_id=product_data.collection_id,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    collection_id: uuid.UUID | None = None,
    domain: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List products with pagination and filters."""
    query = select(Product).where(Product.user_id == current_user.id)

    if collection_id:
        query = query.where(Product.collection_id == collection_id)
    if domain:
        query = query.where(Product.domain == domain.lower())

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination
    query = query.order_by(Product.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    products = result.scalars().all()

    return ProductListResponse(
        items=list(products),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/domains", response_model=list[dict])
async def list_domains(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of unique domains with product counts."""
    query = (
        select(Product.domain, func.count(Product.id).label("count"))
        .where(Product.user_id == current_user.id)
        .group_by(Product.domain)
        .order_by(func.count(Product.id).desc())
    )
    result = await db.execute(query)
    return [{"domain": row.domain, "count": row.count} for row in result]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single product."""
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a product."""
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product."""
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)
    await db.commit()
