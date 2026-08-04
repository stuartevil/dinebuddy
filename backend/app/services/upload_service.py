"""
Upload Service
--------------
Handles all file upload business logic:
  - MIME type validation
  - File size validation
  - Unique filename generation
  - Saving file to disk
"""
import os
import uuid
from fastapi import HTTPException, UploadFile, status

UPLOAD_BASE = os.getenv("UPLOAD_BASE", os.path.join(os.getcwd(), "uploads"))
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE_MB = 5


class UploadService:

    @staticmethod
    def validate_image_type(content_type: str) -> None:
        """Raise 400 if MIME type is not an allowed image format."""
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid file type '{content_type}'. "
                    f"Allowed types: JPEG, PNG, WebP, GIF"
                ),
            )

    @staticmethod
    def validate_file_size(contents: bytes) -> None:
        """Raise 413 if file exceeds MAX_FILE_SIZE_MB."""
        size_mb = len(contents) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File too large ({size_mb:.1f} MB). "
                    f"Maximum allowed is {MAX_FILE_SIZE_MB} MB."
                ),
            )

    @staticmethod
    def generate_unique_filename(original_filename: str | None) -> str:
        """Return a UUID-based filename preserving the original extension."""
        ext = os.path.splitext(original_filename or "logo.jpg")[-1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            ext = ".jpg"
        return f"{uuid.uuid4().hex}{ext}"

    @staticmethod
    def save_logo(contents: bytes, filename: str) -> str:
        """
        Write logo bytes to /app/uploads/logos/<filename>.
        Returns the public URL path: /static/logos/<filename>
        """
        logos_dir = os.path.join(UPLOAD_BASE, "logos")
        os.makedirs(logos_dir, exist_ok=True)

        dest_path = os.path.join(logos_dir, filename)
        with open(dest_path, "wb") as f:
            f.write(contents)

        return f"/static/logos/{filename}"

    @classmethod
    async def process_logo_upload(cls, file: UploadFile) -> dict:
        """
        Full pipeline:
          1. Validate content type
          2. Read & validate file size
          3. Generate unique filename
          4. Save to disk
          5. Return { url, filename }
        """
        cls.validate_image_type(file.content_type)

        contents = await file.read()
        cls.validate_file_size(contents)

        unique_name = cls.generate_unique_filename(file.filename)
        url = cls.save_logo(contents, unique_name)

        return {"url": url, "filename": unique_name}
