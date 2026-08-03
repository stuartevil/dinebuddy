"""
Upload Endpoints
----------------
Route handlers for file upload operations.
All business logic is delegated to UploadService.
"""
from fastapi import APIRouter, UploadFile, File, Depends, status
from fastapi.responses import JSONResponse

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.upload_service import UploadService

router = APIRouter(prefix="/upload", tags=["uploads"])


@router.post(
    "/logo",
    status_code=status.HTTP_200_OK,
    summary="Upload a restaurant logo",
    description="Accepts JPEG, PNG, WebP or GIF. Max 5 MB. Returns the public URL.",
)
async def upload_restaurant_logo(
    file: UploadFile = File(..., description="Logo image file"),
    current_user: User = Depends(get_current_user),
):
    result = await UploadService.process_logo_upload(file)
    return JSONResponse(content=result)
