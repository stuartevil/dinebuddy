import os
import sys

# Ensure backend root in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.menu_items import MenuItem

def clear_adler():
    db = SessionLocal()
    try:
        items = db.query(MenuItem).filter(MenuItem.description.ilike('%Alan Adler%')).all()
        print(f"Found {len(items)} matching menu item(s):")
        for item in items:
            print(f"  ID: {item.id}, Name: {item.name}, Description: {item.description}")
            item.description = None
        db.commit()
        print("Successfully cleared description from database.")
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_adler()
