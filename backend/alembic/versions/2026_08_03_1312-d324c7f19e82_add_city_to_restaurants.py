"""add_city_to_restaurants

Revision ID: d324c7f19e82
Revises: e8f7a9c31b42
Create Date: 2026-08-03 13:12:01.691860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd324c7f19e82'
down_revision: Union[str, None] = 'e8f7a9c31b42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('restaurants', sa.Column('city', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('restaurants', 'city')
