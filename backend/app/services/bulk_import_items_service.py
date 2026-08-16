from typing import List, Dict, Any
import json
import csv
import io

from fastapi import HTTPException, UploadFile, BackgroundTasks,status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models.menu_items import MenuItem
from app.models.bulk_import_items import MenuItemImportJob


from app.models.menu_category import MenuCategory


def _parse_bool(val: Any, default: bool = True) -> bool:
    if val is None or val == "":
        return default
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("true", "1", "t", "yes")


# ------------------------------------------------
# CREATE IMPORT JOB
# ------------------------------------------------
def create_job(db: Session, restaurant_id: int) -> MenuItemImportJob:
    job = MenuItemImportJob(
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
    job = db.query(MenuItemImportJob).filter(MenuItemImportJob.id == job_id).first()
    if not job:
        return

    job.status = "PROCESSING"
    job.total_records = len(rows)
    db.commit()

    # Pre-fetch existing categories for restaurant
    categories = db.query(MenuCategory).filter(
        (MenuCategory.restaurant_id == restaurant_id) | (MenuCategory.is_global == True)
    ).all()
    cat_by_id = {c.id: c.id for c in categories}
    cat_by_name = {c.name.strip().lower(): c.id for c in categories}

    # Ensure at least one category exists
    fallback_cat_id = categories[0].id if categories else None
    if not fallback_cat_id:
        new_cat = MenuCategory(
            restaurant_id=restaurant_id,
            name="General",
            description="Default category for imported items",
            display_order=1,
            is_active=True,
            is_global=False,
        )
        db.add(new_cat)
        db.commit()
        db.refresh(new_cat)
        fallback_cat_id = new_cat.id
        cat_by_id[fallback_cat_id] = fallback_cat_id
        cat_by_name["general"] = fallback_cat_id

    success = 0
    failed = 0
    errors: list[dict] = []

    for index, row in enumerate(rows, start=1):
        try:
            # Category resolution logic: ID match -> Name match -> Fallback category
            resolved_cat_id = None
            if "category_id" in row and row["category_id"] is not None and str(row["category_id"]).strip() != "":
                try:
                    raw_id = int(row["category_id"])
                    if raw_id in cat_by_id:
                        resolved_cat_id = raw_id
                except ValueError:
                    pass

            if not resolved_cat_id:
                cat_name = str(row.get("category") or row.get("category_name") or "").strip().lower()
                if cat_name in cat_by_name:
                    resolved_cat_id = cat_by_name[cat_name]

            if not resolved_cat_id:
                resolved_cat_id = fallback_cat_id

            item = MenuItem(
                restaurant_id=restaurant_id,
                name=str(row["name"]).strip(),
                category_id=resolved_cat_id,
                price=float(row["price"]),
                description=row.get("description"),
                is_available=_parse_bool(row.get("is_available"), True),
                is_vegetarian=_parse_bool(row.get("is_vegetarian"), False),
                preparation_time_minutes=(
                    int(row["preparation_time_minutes"])
                    if row.get("preparation_time_minutes") not in (None, "")
                    else None
                ),
            )
            db.add(item)
            db.flush()   # validates row before commit
            success += 1

        except (KeyError, ValueError, SQLAlchemyError) as e:
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
# FILE PROCESSORS
# ------------------------------------------------
def process_csv(
    db: Session,
    job_id: int,
    restaurant_id: int,
    file: UploadFile,
):
    content = file.file.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(content)))
    process_rows(db, job_id, restaurant_id, rows)


def process_json(
    db: Session,
    job_id: int,
    restaurant_id: int,
    items: List[Dict[str, Any]],
):
    process_rows(db, job_id, restaurant_id, items)


# ------------------------------------------------
# GET JOB
# ------------------------------------------------
def get_job(db: Session, job_id: int) -> MenuItemImportJob | None:
    return db.query(MenuItemImportJob).filter(MenuItemImportJob.id == job_id).first()


def get_import_job(db: Session, job_id: int, restaurant_id: int) -> MenuItemImportJob:
    job = db.query(MenuItemImportJob).filter(
        MenuItemImportJob.id == job_id,
        MenuItemImportJob.restaurant_id == restaurant_id,
    ).first()

    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Import job not found")

    return job


# ------------------------------------------------
# BACKGROUND TASK ENTRY
# ------------------------------------------------
def start_import(
    job_id: int,
    restaurant_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
):
    filename = file.filename.lower()

    if filename.endswith(".csv"):
        content = file.file.read().decode("utf-8")
        background_tasks.add_task(
            _run_import_job,
            job_id,
            restaurant_id,
            "csv",
            content,
        )

    elif filename.endswith(".json"):
        items = json.loads(file.file.read().decode("utf-8"))
        if not isinstance(items, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="JSON must be an array"
            )

        background_tasks.add_task(
            _run_import_job,
            job_id,
            restaurant_id,
            "json",
            items,
        )
    else:
        raise ValueError("Only CSV or JSON supported")





# ------------------------------------------------
# BACKGROUND WORKER
# ------------------------------------------------
def _run_import_job(
    job_id: int,
    restaurant_id: int,
    file_type: str,
    payload,
):
    """
    Runs in background with isolated DB session
    """
    db = SessionLocal()
    try:
        if file_type == "json":
            process_rows(db, job_id, restaurant_id, payload)
        else:  # CSV
            rows = list(csv.DictReader(io.StringIO(payload)))
            process_rows(db, job_id, restaurant_id, rows)
    finally:
        db.close()
