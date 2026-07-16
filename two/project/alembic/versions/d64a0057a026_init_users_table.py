"""init users table - baseline snapshot

Revision ID: d64a0057a026
Revises: 
Create Date: 2026-07-16 21:57:09.154877

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd64a0057a026'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """基准版本快照，不执行任何操作。
    数据库表结构已由 init_db.py 手动建立，Alembic 从此版本开始接管后续变更。
    """
    pass


def downgrade() -> None:
    """基准版本无法回滚。"""
    pass
