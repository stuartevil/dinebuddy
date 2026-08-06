from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime
import json
import csv
import io

from fastapi import HTTPException, UploadFile, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models.ingredient import Ingredient
from app.models.stock_transaction import StockTransaction, TransactionType
from app.models.bulk_import_inventory import IngredientImportJob


# ------------------------------------------------
# CREATE IMPORT JOB
# ------------------------------------------------
def create_job(db: Session, restaurant_id: int) -> IngredientImportJob:
    job = IngredientImportJob(
        restaurant_id=restaurant_id,
        status="PENDING",
        total_records=0,
        success_count=0,
        failed_count=0,
        errors=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# ------------------------------------------------
# CORE PROCESSOR
# ------------------------------------------------
def process_rows(
    db: Session,
    job_id: int,
    restaurant_id: int,
    rows: List[Dict[str, Any]],
) -> None:
    job = db.query(IngredientImportJob).filter(IngredientImportJob.id == job_id).first()
    if not job:
        return

    job.status = "PROCESSING"
    job.total_records = len(rows)
    db.commit()

    success = 0
    failed = 0
    errors: list[dict] = []

    for index, row in enumerate(rows, start=1):
        try:
            name = row.get("name")
            if not name or not str(name).strip():
                raise ValueError("Ingredient name is required")

            unit = row.get("unit") or "kg"
            category = row.get("category") or "General"
            
            stock_qty_val = row.get("current_stock_qty") if row.get("current_stock_qty") is not None else row.get("stock_qty", 0)
            threshold_val = row.get("reorder_threshold") if row.get("reorder_threshold") is not None else row.get("min_threshold", 0)
            reorder_qty_val = row.get("reorder_qty", 0)
            cost_val = row.get("cost_per_unit") if row.get("cost_per_unit") is not None else row.get("unit_cost", 0)

            current_stock_qty = Decimal(str(stock_qty_val or 0))
            reorder_threshold = Decimal(str(threshold_val or 0))
            reorder_qty = Decimal(str(reorder_qty_val or 0))
            cost_per_unit = Decimal(str(cost_val or 0))

            supplier_name = str(row.get("supplier_name") or row.get("supplier") or "").strip() or None
            supplier_contact = str(row.get("supplier_contact") or "").strip() or None

            track_expiry_raw = row.get("track_expiry")
            track_expiry = False
            if isinstance(track_expiry_raw, bool):
                track_expiry = track_expiry_raw
            elif track_expiry_raw is not None:
                track_expiry = str(track_expiry_raw).strip().lower() in ["true", "1", "yes"]

            expiry_date = None
            if row.get("expiry_date"):
                exp_str = str(row.get("expiry_date")).strip()
                if exp_str:
                    try:
                        expiry_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                    except ValueError:
                        raise ValueError(f"Invalid expiry_date format '{exp_str}'. Expected YYYY-MM-DD")

            ingredient = Ingredient(
                restaurant_id=restaurant_id,
                name=str(name).strip(),
                unit=str(unit).strip(),
                category=str(category).strip(),
                current_stock_qty=current_stock_qty,
                reorder_threshold=reorder_threshold,
                reorder_qty=reorder_qty,
                cost_per_unit=cost_per_unit,
                supplier_name=supplier_name,
                supplier_contact=supplier_contact,
                track_expiry=track_expiry,
                expiry_date=expiry_date,
            )
            db.add(ingredient)
            db.flush()

            if current_stock_qty > Decimal("0"):
                tx = StockTransaction(
                    restaurant_id=restaurant_id,
                    ingredient_id=ingredient.id,
                    type=TransactionType.PURCHASE,
                    quantity=current_stock_qty,
                    stock_after=current_stock_qty,
                    notes="Initial stock recorded from bulk import",
                )
                db.add(tx)
                db.flush()

            db.commit()
            success += 1

        except (KeyError, ValueError, SQLAlchemyError, Exception) as e:
            db.rollback()
            failed += 1
            errors.append({
                "row": index,
                "error": str(e),
                "data": row
            })

    job.success_count = success
    job.failed_count = failed
    job.errors = errors
    job.status = "COMPLETED" if failed == 0 else ("COMPLETED" if success > 0 else "FAILED")
    db.commit()


# ------------------------------------------------
# GET JOB
# ------------------------------------------------
def get_import_job(db: Session, job_id: int, restaurant_id: int) -> IngredientImportJob:
    job = db.query(IngredientImportJob).filter(
        IngredientImportJob.id == job_id,
        IngredientImportJob.restaurant_id == restaurant_id,
    ).first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")

    return job


# ------------------------------------------------
# BACKGROUND WORKER
# ------------------------------------------------
def _run_import_job(
    job_id: int,
    restaurant_id: int,
    file_type: str,
    payload: Any,
):
    """Runs in background with isolated DB session"""
    db = SessionLocal()
    try:
        if file_type == "json":
            process_rows(db, job_id, restaurant_id, payload)
        else:  # CSV
            rows = list(csv.DictReader(io.StringIO(payload)))
            process_rows(db, job_id, restaurant_id, rows)
    finally:
        db.close()
