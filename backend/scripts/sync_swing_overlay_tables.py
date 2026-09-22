import sys
sys.path.insert(0, 'backend')
from app.db.database import engine, Base
import app.models

print("Creating swing overlay tables...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")
