"""add_addon_groups_and_options_tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-16 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create addon_groups table
    op.create_table(
        'addon_groups',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('restaurant_id', sa.Integer(), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('min_selectable', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_selectable', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_addon_groups_id', 'addon_groups', ['id'])
    op.create_index('ix_addon_groups_restaurant_id', 'addon_groups', ['restaurant_id'])

    # 2. Create addon_options table
    op.create_table(
        'addon_options',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('addon_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('is_available', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_addon_options_id', 'addon_options', ['id'])
    op.create_index('ix_addon_options_group_id', 'addon_options', ['group_id'])

    # 3. Create menu_item_addon_group_map table
    op.create_table(
        'menu_item_addon_group_map',
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('addon_groups.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('menu_item_addon_group_map')
    op.drop_table('addon_options')
    op.drop_table('addon_groups')
