"""Search router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.product import Product
from models.user import User
from routers.auth import get_current_user
from routers.products import ProductResponse

router = APIRouter()


@router.get("", response_model=list[ProductResponse])
async def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search products by title, description, notes, and domain."""
    search_term = f"%{q.lower()}%"

    query = (
        select(Product)
        .where(
            Product.user_id == current_user.id,
            or_(
                func.lower(Product.title).like(search_term),
                func.lower(Product.description).like(search_term),
                func.lower(Product.user_notes).like(search_term),
                func.lower(Product.domain).like(search_term),
            ),
        )
        .order_by(Product.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    products = result.scalars().all()
    return list(products)
