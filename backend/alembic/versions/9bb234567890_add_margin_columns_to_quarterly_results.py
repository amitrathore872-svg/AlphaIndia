"""add_margin_columns_to_quarterly_results

Revision ID: 9bb234567890
Revises: 8e57424b4a89
Create Date: 2026-10-28 11:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9bb234567890'
down_revision: Union[str, Sequence[str], None] = '8e57424b4a89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: ensure operating_margin and net_profit_margin columns exist."""
    op.execute("ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS operating_margin DOUBLE PRECISION;")
    op.execute("ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS net_profit_margin DOUBLE PRECISION;")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE quarterly_results DROP COLUMN IF EXISTS operating_margin;")
    op.execute("ALTER TABLE quarterly_results DROP COLUMN IF EXISTS net_profit_margin;")
