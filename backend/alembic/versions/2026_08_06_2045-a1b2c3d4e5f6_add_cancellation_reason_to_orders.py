"""add_cancellation_reason_to_orders

Revision ID: a1b2c3d4e5f6
Revises: f9a81b2c3d4e
Create Date: 2026-08-06 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f9a81b2c3d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('cancellation_reason', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'cancellation_reason')
