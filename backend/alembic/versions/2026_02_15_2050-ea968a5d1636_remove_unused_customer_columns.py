"""remove_unused_customer_columns

Revision ID: ea968a5d1636
Revises: 65bfe937230c
Create Date: 2026-02-15 20:50:05.891815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea968a5d1636'
down_revision: Union[str, None] = '65bfe937230c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():

    op.drop_column("customers", "otp_code")
    op.drop_column("customers", "otp_expires_at")
    op.drop_column("customers", "otp_verified_at")
    op.drop_column("customers", "is_phone_verified")


def downgrade():

    op.add_column(
        "customers",
        sa.Column("otp_code", sa.String(6), nullable=True)
    )

    op.add_column(
        "customers",
        sa.Column("otp_expires_at", sa.DateTime(), nullable=True)
    )

    op.add_column(
        "customers",
        sa.Column("otp_verified_at", sa.DateTime(), nullable=True)
    )

    op.add_column(
        "customers",
        sa.Column('is_phone_verified', sa.Boolean(), nullable=False)
    )
