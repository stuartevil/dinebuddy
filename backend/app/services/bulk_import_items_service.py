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

    success = 0
    failed = 0
    errors: list[dict] = []

    for index, row in enumerate(rows, start=1):
        try:
            item = MenuItem(
                restaurant_id=restaurant_id,
                name=row["name"],
                category_id=int(row["category_id"]),
                price=float(row["price"]),
                description=row.get("description"),
                is_available=bool(row.get("is_available", True)),
                is_vegetarian=bool(row.get("is_vegetarian", False)),
                preparation_time_minutes=(
                    int(row["preparation_time_minutes"])
                    if row.get("preparation_time_minutes")
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
    job.status = "COMPLETED" if failed == 0 else "FAILED"
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
