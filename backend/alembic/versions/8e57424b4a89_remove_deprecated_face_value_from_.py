"""remove_deprecated_face_value_from_companies

Revision ID: 8e57424b4a89
Revises: 5f542a43594b
Create Date: 2026-10-28 10:09:55.553963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e57424b4a89'
down_revision: Union[str, Sequence[str], None] = '5f542a43594b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: ensure face_value is safely dropped if it still exists."""
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS face_value;")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS face_value DOUBLE PRECISION;")
