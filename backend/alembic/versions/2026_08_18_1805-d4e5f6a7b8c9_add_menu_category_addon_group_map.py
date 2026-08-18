"""add_menu_category_addon_group_map

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-18 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'menu_category_addon_group_map',
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('menu_categories.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('addon_groups.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('menu_category_addon_group_map')
