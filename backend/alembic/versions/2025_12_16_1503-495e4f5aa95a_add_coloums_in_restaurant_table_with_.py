"""add columns in restaurant table with slug

Revision ID: 495e4f5aa95a
Revises: d96a40c9bd47
Create Date: 2025-12-16 15:03:25.970036
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = '495e4f5aa95a'
down_revision: Union[str, None] = 'd96a40c9bd47'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'restaurants',
        sa.Column('slug', sa.String(), nullable=False)
    )
    op.add_column(
        'restaurants',
        sa.Column('address', sa.String(), nullable=True)
    )
    op.add_column(
        'restaurants',
        sa.Column('phone', sa.String(), nullable=True)
    )
    op.add_column(
        'restaurants',
        sa.Column('email', sa.String(), nullable=True)
    )
    op.add_column(
        'restaurants',
        sa.Column('logo_url', sa.String(), nullable=True)
    )
    op.add_column(
        'restaurants',
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False)
    )
    op.add_column(
        'restaurants',
        sa.Column('timezone', sa.String(), nullable=True)
    )
    op.add_column(
        'restaurants',
        sa.Column('currency', sa.String(), nullable=True)
    )

    op.create_unique_constraint(
        'uq_restaurants_slug',
        'restaurants',
        ['slug']
    )
    op.create_index(
        'ix_restaurants_slug',
        'restaurants',
        ['slug']
    )


def downgrade() -> None:
    op.drop_index('ix_restaurants_slug', table_name='restaurants')
    op.drop_constraint('uq_restaurants_slug', 'restaurants', type_='unique')

    op.drop_column('restaurants', 'currency')
    op.drop_column('restaurants', 'timezone')
    op.drop_column('restaurants', 'is_active')
    op.drop_column('restaurants', 'logo_url')
    op.drop_column('restaurants', 'email')
    op.drop_column('restaurants', 'phone')
    op.drop_column('restaurants', 'address')
    op.drop_column('restaurants', 'slug')
