"""
Script to clear all restaurant data from the database.
Deletes all restaurants, user-restaurant mappings, ingredients, transactions, recipes, and related records.
"""
from app.core.database import SessionLocal, engine
from app.db.base import Base
from sqlalchemy import text


def clear_all_restaurant_data():
    # Ensure tables are created first
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Clearing all restaurant data from database...")

        # Delete records safely
        tables_to_clear = [
            "stock_transactions",
            "recipe_items",
            "ingredients",
            "order_items",
            "orders",
            "bills",
            "tables",
            "menu_items",
            "user_restaurants_map",
            "restaurants",
        ]

        for table in tables_to_clear:
            try:
                db.execute(text(f"DELETE FROM {table};"))
            except Exception as e:
                print(f"Skipping table {table}: {e}")

        db.commit()
        print("Successfully deleted all restaurants and associated data!")
    except Exception as e:
        db.rollback()
        print(f"Error clearing data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    clear_all_restaurant_data()
