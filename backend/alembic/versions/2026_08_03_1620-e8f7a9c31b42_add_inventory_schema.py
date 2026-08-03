"""add_inventory_schema

Revision ID: e8f7a9c31b42
Revises: cb2227518e5f
Create Date: 2026-08-03 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f7a9c31b42'
down_revision: Union[str, None] = 'cb2227518e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ingredients table
    op.create_table(
        'ingredients',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=False),
        sa.Column('current_stock_qty', sa.Numeric(precision=12, scale=3), server_default='0.000', nullable=False),
        sa.Column('reorder_threshold', sa.Numeric(precision=12, scale=3), server_default='0.000', nullable=False),
        sa.Column('reorder_qty', sa.Numeric(precision=12, scale=3), server_default='0.000', nullable=False),
        sa.Column('cost_per_unit', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('supplier_name', sa.String(length=255), nullable=True),
        sa.Column('supplier_contact', sa.String(length=255), nullable=True),
        sa.Column('track_expiry', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ingredients_id'), 'ingredients', ['id'], unique=False)
    op.create_index(op.f('ix_ingredients_restaurant_id'), 'ingredients', ['restaurant_id'], unique=False)
    op.create_index(op.f('ix_ingredients_name'), 'ingredients', ['name'], unique=False)
    op.create_index(op.f('ix_ingredients_category'), 'ingredients', ['category'], unique=False)
    op.create_index('ix_ingredients_restaurant_category', 'ingredients', ['restaurant_id', 'category'], unique=False)
    op.create_index('ix_ingredients_restaurant_name', 'ingredients', ['restaurant_id', 'name'], unique=False)

    # 2. recipe_items table
    op.create_table(
        'recipe_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('menu_item_id', sa.Integer(), nullable=False),
        sa.Column('ingredient_id', sa.Integer(), nullable=False),
        sa.Column('quantity_used', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['menu_item_id'], ['menu_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recipe_items_id'), 'recipe_items', ['id'], unique=False)
    op.create_index(op.f('ix_recipe_items_restaurant_id'), 'recipe_items', ['restaurant_id'], unique=False)
    op.create_index(op.f('ix_recipe_items_menu_item_id'), 'recipe_items', ['menu_item_id'], unique=False)
    op.create_index(op.f('ix_recipe_items_ingredient_id'), 'recipe_items', ['ingredient_id'], unique=False)
    op.create_index('ix_recipe_items_menu_ingredient', 'recipe_items', ['menu_item_id', 'ingredient_id'], unique=True)

    # 3. stock_transactions table
    transaction_type_enum = sa.Enum('Purchase', 'Sale_Deduction', 'Wastage', 'Adjustment', name='transactiontype')
    
    op.create_table(
        'stock_transactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('ingredient_id', sa.Integer(), nullable=False),
        sa.Column('type', transaction_type_enum, nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('stock_after', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('reference_id', sa.String(length=100), nullable=True),
        sa.Column('staff_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_transactions_id'), 'stock_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_stock_transactions_restaurant_id'), 'stock_transactions', ['restaurant_id'], unique=False)
    op.create_index(op.f('ix_stock_transactions_ingredient_id'), 'stock_transactions', ['ingredient_id'], unique=False)
    op.create_index(op.f('ix_stock_transactions_type'), 'stock_transactions', ['type'], unique=False)
    op.create_index(op.f('ix_stock_transactions_reference_id'), 'stock_transactions', ['reference_id'], unique=False)
    op.create_index(op.f('ix_stock_transactions_staff_id'), 'stock_transactions', ['staff_id'], unique=False)
    op.create_index(op.f('ix_stock_transactions_created_at'), 'stock_transactions', ['created_at'], unique=False)
    op.create_index('ix_stock_tx_restaurant_ingredient', 'stock_transactions', ['restaurant_id', 'ingredient_id'], unique=False)


def downgrade() -> None:
    op.drop_table('stock_transactions')
    sa.Enum(name='transactiontype').drop(op.get_bind(), checkfirst=True)
    op.drop_table('recipe_items')
    op.drop_table('ingredients')
