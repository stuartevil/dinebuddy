"""fix userrole enum casing

Revision ID: ddd17c9839ec
Revises: 8e1d942ad168
Create Date: 2026-01-13 12:40:04.303562

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ddd17c9839ec'
down_revision: Union[str, None] = '8e1d942ad168'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute(
        "ALTER TYPE userrole RENAME VALUE 'restaurant_admin' TO 'RESTAURANT_ADMIN'"
    )

def downgrade():
    op.execute(
        "ALTER TYPE userrole RENAME VALUE 'RESTAURANT_ADMIN' TO 'restaurant_admin'"
    )