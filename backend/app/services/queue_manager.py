"""
Alpha India Queue Manager
Sprint 28.2
"""

from collections import deque
from sqlalchemy.orm import Session

from app.models.company import Company


class QueueManager:

    queue = deque()
    completed = set()
    running = None

    @classmethod
    def bootstrap(cls, db: Session):
        cls.queue.clear()
        cls.completed.clear()
        cls.running = None

        companies = (
            db.query(Company)
            .order_by(Company.company.asc())
            .all()
        )

        for company in companies:
            cls.queue.append(company.symbol)

        return len(cls.queue)

    @classmethod
    def next_company(cls):
        if not cls.queue:
            cls.running = None
            return None

        cls.running = cls.queue.popleft()
        return cls.running

    @classmethod
    def remove_company(cls, symbol: str):
        """
        Remove company from queue even if discovered directly.
        """
        try:
            cls.queue.remove(symbol)
            return True
        except ValueError:
            return False

    @classmethod
    def complete_company(cls, symbol: str):
        cls.remove_company(symbol)
        cls.completed.add(symbol)
        cls.running = None

    @classmethod
    def status(cls):
        return {
            "pending": len(cls.queue),
            "completed": len(cls.completed),
            "running": cls.running,
            "total": len(cls.queue) + len(cls.completed),
        }