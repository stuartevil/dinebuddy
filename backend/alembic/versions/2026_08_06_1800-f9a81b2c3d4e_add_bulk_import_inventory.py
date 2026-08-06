"""add_bulk_import_inventory

Revision ID: f9a81b2c3d4e
Revises: d324c7f19e82
Create Date: 2026-08-06 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a81b2c3d4e'
down_revision: Union[str, None] = 'd324c7f19e82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bulk_import_inventory',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('restaurant_id', sa.Integer(), sa.ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('total_records', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('success_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('errors', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('bulk_import_inventory')
