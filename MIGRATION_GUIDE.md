# Live Migration Guide

## Overview

When deploying to live without terminal access, use the temporary migration URL to run database migrations. The endpoint is secured with a secret key.

## Setup

1. **Set MIGRATION_SECRET in `.env.local`** on your live server:
   ```
   MIGRATION_SECRET=your_secure_secret_key_here
   ```

2. Keep this secret safe and use it only when running migrations.

## Available Migrations

### 1. Token Version (JWT Invalidation)
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-token-version`

**What it does:**
- Adds `token_version INT DEFAULT 1` column to `users` table
- Enables JWT token invalidation when password changes

### 2. Sales Role
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-sales-role`

**What it does:**
- Adds `'sales'` role to users.role ENUM
- Supports per-store permissions for sales staff

### 3. User Meta
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-user-meta`

**What it does:**
- Creates `user_meta` table for storing user metadata
- Used for per-store permissions

### 4. Direct Stock Receipts
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-direct-stock-receipts`

**What it does:**
- Adds `store_id` column to `purchase_orders` table
- Adds `created_by` column to track who created receipts
- Updates status ENUM to include `'direct'` status
- Enables tracking of direct stock additions/removals

### 5. PO Link to Stock
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-po-link-to-stock`

**What it does:**
- Adds `purchase_order_id` column to `stock_items_new` table
- Links stock items to their source purchase order
- Enables audit trail for all stock changes

### 6. Product Delete Status
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-delete-status-to-products`

**What it does:**
- Adds `delete_status` column and index to `products` table
- Enables soft deletion for products

### 7. Product Sell On Website Status
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-sell-on-website-to-products`

**What it does:**
- Adds `sell_on_website` TINYINT column to `products` table
- Enables storefront visibility toggles

### 8. Brand Image
**Endpoint:** `GET /api/admin/run-migrations?secret=YOUR_SECRET&migration=add-brand-image`

**What it does:**
- Adds `image` column to `brands` table
- Supports uploading brand images

## How to Run

### View Available Migrations
```
GET https://yourdomain.com/api/admin/run-migrations
```

### Run a Specific Migration
```
GET https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=migration_name
```

### Example: Run All Required Migrations
```
1. https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=add-token-version
2. https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=add-sales-role
3. https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=add-user-meta
4. https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=add-direct-stock-receipts
5. https://yourdomain.com/api/admin/run-migrations?secret=YOUR_SECRET&migration=add-po-link-to-stock
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Migration \"add-token-version\" completed successfully",
  "output": "✅ Connected to MySQL database: store\n✅ Column \"token_version\" — Added to users table\n..."
}
```

### Error Response
```json
{
  "success": false,
  "message": "Invalid migration secret.",
  "error": "..."
}
```

## Features

✅ **Secure:** Requires MIGRATION_SECRET environment variable
✅ **Safe:** Checks if columns already exist before adding
✅ **Trackable:** Shows output of each migration
✅ **Available Migrations List:** Call endpoint without secret to see all options
✅ **Idempotent:** Running same migration twice is safe

## Troubleshooting

### "MIGRATION_SECRET env variable is not set"
- Add `MIGRATION_SECRET` to your `.env.local` on the live server
- Restart the application after adding the environment variable

### "Invalid migration secret"
- Check that you're using the correct secret from `.env.local`
- Ensure no extra spaces or typos

### "Unknown migration"
- Check the migration name spelling
- Visit `https://yourdomain.com/api/admin/run-migrations` to see available options

### Migration Shows Already Exists
- This is normal and safe
- The migration script checks before adding columns
- No action needed

## Security Notes

⚠️ **Important:**
- Never commit `MIGRATION_SECRET` to version control
- Use a strong, random secret key (at least 32 characters)
- Consider rotating the secret after completing all migrations
- Only grant the secret to authorized deployment personnel
- Remove/expire the secret after migrations are complete

## Local Development

For local development, you can run migrations directly:

```bash
node database/add-token-version.js
node database/add-sales-role.js
node database/add-user-meta.js
node database/add-direct-stock-receipts.js
node database/add-po-link-to-stock.js
```

Or use the migration runner with a test secret:
```bash
MIGRATION_SECRET=test_secret npm run dev
# Then visit: http://localhost:3000/api/admin/run-migrations?secret=test_secret&migration=add-token-version
```

---

**Last Updated:** August 2024
**Version:** 1.0
