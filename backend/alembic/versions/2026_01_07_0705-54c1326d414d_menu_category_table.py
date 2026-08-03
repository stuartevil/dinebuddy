"""menu_category_table

Revision ID: 54c1326d414d
Revises: c33fde117a87
Create Date: 2026-01-07 07:05:10.500238

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '54c1326d414d'
down_revision: Union[str, None] = 'c33fde117a87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "menu_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "restaurant_id",
            sa.Integer(),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_global", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "uq_menu_categories_restaurant_name_non_global",
        "menu_categories",
        ["restaurant_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_global = false"),
    )



def downgrade() -> None:
    # Drop index first
    op.drop_index(
        "uq_menu_categories_restaurant_name_non_global",
        table_name="menu_categories",
    )

    # Drop table
    op.drop_table("menu_categories")
