import re
from sqlalchemy.orm import Session
from app.models.restaurant import Restaurant


def generate_slug(name: str) -> str:
    """
    Convert name into URL-safe slug.
    """
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)  # replace symbols with hyphens
    slug = slug.strip("-")
    return slug

def generate_unique_slug(
    db: Session,
    base_name: str,
    exclude_id: int | None = None
) -> str:
    base_slug = generate_slug(base_name)
    slug = base_slug
    counter = 1

    while True:
        query = db.query(Restaurant).filter(Restaurant.slug == slug)

        if exclude_id:
            query = query.filter(Restaurant.id != exclude_id)

        if not query.first():
            return slug

        slug = f"{base_slug}-{counter}"
        counter += 1

