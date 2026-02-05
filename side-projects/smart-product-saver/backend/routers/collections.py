"""Collections router."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.collection import Collection
from models.product import Product
from models.user import User
from routers.auth import get_current_user

router = APIRouter()


# Schemas
class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    parent_id: uuid.UUID | None = None


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    parent_id: uuid.UUID | None = None
    position: int | None = None


class CollectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    color: str | None
    parent_id: uuid.UUID | None
    position: int
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CollectionWithProductsResponse(CollectionResponse):
    products: list[dict] = []


# Endpoints
@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    collection_data: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new collection."""
    # Get max position for ordering
    result = await db.execute(
        select(func.max(Collection.position))
        .where(Collection.user_id == current_user.id)
    )
    max_position = result.scalar() or 0

    collection = Collection(
        name=collection_data.name,
        description=collection_data.description,
        color=collection_data.color,
        parent_id=collection_data.parent_id,
        position=max_position + 1,
        user_id=current_user.id,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        parent_id=collection.parent_id,
        position=collection.position,
        product_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("", response_model=list[CollectionResponse])
async def list_collections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all collections with product counts."""
    # Get collections with product counts
    query = (
        select(Collection, func.count(Product.id).label("product_count"))
        .outerjoin(Product, Product.collection_id == Collection.id)
        .where(Collection.user_id == current_user.id)
        .group_by(Collection.id)
        .order_by(Collection.position)
    )
    result = await db.execute(query)

    collections = []
    for row in result:
        collection = row[0]
        product_count = row[1]
        collections.append(
            CollectionResponse(
                id=collection.id,
                name=collection.name,
                description=collection.description,
                color=collection.color,
                parent_id=collection.parent_id,
                position=collection.position,
                product_count=product_count,
                created_at=collection.created_at,
                updated_at=collection.updated_at,
            )
        )
    return collections


@router.get("/{collection_id}", response_model=CollectionWithProductsResponse)
async def get_collection(
    collection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single collection with its products."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.products))
        .where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    return CollectionWithProductsResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        parent_id=collection.parent_id,
        position=collection.position,
        product_count=len(collection.products),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        products=[
            {
                "id": str(p.id),
                "title": p.title,
                "thumbnail": p.thumbnail,
                "price": str(p.price) if p.price else None,
                "currency": p.currency,
            }
            for p in collection.products
        ],
    )


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: uuid.UUID,
    collection_data: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a collection."""
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    update_data = collection_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(collection, field, value)

    await db.commit()
    await db.refresh(collection)

    # Get product count
    count_result = await db.execute(
        select(func.count(Product.id)).where(Product.collection_id == collection.id)
    )
    product_count = count_result.scalar() or 0

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        parent_id=collection.parent_id,
        position=collection.position,
        product_count=product_count,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a collection. Products are moved to uncategorized."""
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Move products to uncategorized
    await db.execute(
        Product.__table__.update()
        .where(Product.collection_id == collection_id)
        .values(collection_id=None)
    )

    await db.delete(collection)
    await db.commit()
