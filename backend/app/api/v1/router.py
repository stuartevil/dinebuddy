from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, restaurant, user_restaurant, menu_category, 
    menu_items, menu_item_variant, addon, user, auth, opt_auth,
    table, billing, inventory, reports, upload, public_customer
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, tags=["health"])
api_router.include_router(restaurant.router, tags=["restaurant"])
api_router.include_router(user_restaurant.router, tags=["user_restaurant"])
api_router.include_router(menu_category.router, tags=["menu_category"])
api_router.include_router(menu_items.router, tags=["menu_items"])
api_router.include_router(menu_item_variant.router, tags=["menu_item_variant"])
api_router.include_router(addon.router, tags=["Menu Add-ons & Modifiers"])
api_router.include_router(user.router, tags=["Users"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(opt_auth.router, tags=["Customer Auth"])
api_router.include_router(table.router, prefix="/tables", tags=["Tables"])
api_router.include_router(billing.router, tags=["Dine-In Billing & Sessions"])
api_router.include_router(inventory.router, tags=["Inventory & Stock Management"])
api_router.include_router(reports.router, tags=["Sales Reports & Analytics"])
api_router.include_router(upload.router, tags=["File Uploads"])
api_router.include_router(public_customer.router, tags=["Public Customer QR"])