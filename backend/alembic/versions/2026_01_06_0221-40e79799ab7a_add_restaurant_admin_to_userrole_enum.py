"""add_restaurant_admin_to_userrole_enum

Revision ID: 40e79799ab7a
Revises: 258f89b28c5e
Create Date: 2026-01-06 02:21:23.452430

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40e79799ab7a'
down_revision: Union[str, None] = '258f89b28c5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'restaurant_admin' to the userrole enum type
    # Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in PostgreSQL
    # Alembic handles this by running it outside the transaction
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'restaurant_admin'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly
    # To properly downgrade, we would need to recreate the enum type
    # For now, we'll leave it as a no-op since removing enum values is complex
    pass
