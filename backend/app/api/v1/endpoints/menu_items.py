from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
    BackgroundTasks,
)
from sqlalchemy.orm import Session
from io import StringIO
import json
import csv

from app.core.database import get_db, SessionLocal
from app.core.permission import require_roles
from app.core.dependencies import CurrentUser, check_restaurant_access
from app.models.user import UserRole
from app.schemas.menu_items_schema import (
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
    MenuItemAvailabilityUpdate,
    MenuItemTimingUpdate,
)
from app.services import (
    menu_items_service,
    bulk_import_items_service,
)

router = APIRouter(
    prefix="/restaurants/{restaurant_id}/menu-items",
    tags=["Restaurant Menu Items"],
)


# ------------------------------------------------------------------
# GET MENU ITEM BY ID (PUBLIC)
# ------------------------------------------------------------------
@router.get("/{item_id}", response_model=MenuItemRead)
def get_menu_item(
    restaurant_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    item = menu_items_service.get_menu_item(
        db,
        item_id=item_id,
        restaurant_id=restaurant_id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    return item


# =================================================
# IMPORT ROUTES (STATIC)
# =================================================

@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
def import_menu_items(
    restaurant_id: int,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    if current_user.is_restaurant_admin:
        check_restaurant_access(restaurant_id, current_user, db)

    job = bulk_import_items_service.create_job(db, restaurant_id)
    filename = file.filename.lower()

    # ---------- CSV ----------
    if filename.endswith(".csv"):
        content = file.file.read().decode("utf-8")
        csv.DictReader(StringIO(content))  # validate CSV

        background_tasks.add_task(
            menu_items_service._run_import_job,
            job.id,
            restaurant_id,
            "csv",
            content,  # ✅ Pass the CSV content string, not the file
        )

    # ---------- JSON ----------
    elif filename.endswith(".json"):
        content = file.file.read().decode("utf-8")
        items = json.loads(content)
        if not isinstance(items, list):
            raise HTTPException(400, "JSON must be an array")

        background_tasks.add_task(
            menu_items_service.run_import_job,
            job.id,
            restaurant_id,
            "json",
            items,  # ✅ Already a list of dicts
        )


    else:
        raise HTTPException(400, "Only CSV or JSON supported")

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Import started",
    }


@router.get("/import/{job_id}")
def get_import_job_status(
    restaurant_id: int,
    job_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    check_restaurant_access(restaurant_id, current_user, db)

    return bulk_import_items_service.get_import_job(
        db=db,
        job_id=job_id,
        restaurant_id=restaurant_id,
    )


# =================================================
# MENU ITEM CRUD
# =================================================
@router.get("/", response_model=list[MenuItemRead])
def list_menu_items(
    restaurant_id: int,
    category_id: int | None = None,
    available_now: bool = True,
    db: Session = Depends(get_db),
):
    return menu_items_service.list_menu_items(
        db=db,
        restaurant_id=restaurant_id,
        category_id=category_id,
        only_currently_available=available_now,
    )


@router.post("/", response_model=MenuItemRead)
def create_menu_item(
    restaurant_id: int,
    data: MenuItemCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    check_restaurant_access(restaurant_id, current_user, db)
    data.restaurant_id = restaurant_id
    return menu_items_service.create_menu_item(db, data)


@router.patch("/{item_id}", response_model=MenuItemRead)
def update_menu_item(
    restaurant_id: int,
    item_id: int,
    data: MenuItemUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    check_restaurant_access(restaurant_id, current_user, db)
    item = menu_items_service.get_menu_item(
        db=db,
        item_id=item_id,
        restaurant_id=restaurant_id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    return menu_items_service.update_menu_item(db, item, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    restaurant_id: int,
    item_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(
        db=db,
        item_id=item_id,
        restaurant_id=restaurant_id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    menu_items_service.delete_menu_item(db, item)


# =================================================
# AVAILABILITY
# =================================================
@router.patch("/{item_id}/availability", response_model=dict)
def update_menu_item_availability(
    restaurant_id: int,
    item_id: int,
    data: MenuItemAvailabilityUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(
        db=db,
        item_id=item_id,
        restaurant_id=restaurant_id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    menu_items_service.update_menu_item_availability(
        db=db,
        item=item,
        is_available=data.is_available,
    )

    
    return {
        "item_id": item.id,
        "is_available": item.is_available,
        "status": "updated",
    }


# =================================================
# TIMING
# =================================================
@router.patch("/{item_id}/timings", response_model=dict)
def update_menu_item_timings(
    restaurant_id: int,
    item_id: int,
    data: MenuItemTimingUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(
        current_user,
        (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN),
    )

    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(
        db=db,
        item_id=item_id,
        restaurant_id=restaurant_id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    menu_items_service.update_menu_item_timing(
        db=db,
        item=item,
        available_from=data.available_from,
        available_to=data.available_to,
    )

    return {
        "item_id": item.id,
        "available_from": str(item.available_from) if item.available_from else None,
        "available_to": str(item.available_to) if item.available_to else None,
        "status": "updated",
    }
