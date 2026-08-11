# 🚀 Task Plan: DineBuddy AWS Migration & Performance Optimization

This document serves as a complete blueprint and task plan to migrate **DineBuddy** from **Render + Supabase + Vercel** to **AWS**, resolving all performance bottlenecks and ensuring 100% data preservation.

---

## 📌 Objectives & Benefits
1. **Zero Cold Starts**: App Runner / EC2 backend runs 24/7 without sleeping.
2. **Sub-5ms Database Latency**: Co-locating backend API and PostgreSQL in the same AWS VPC/Region (e.g. `ap-south-1` Mumbai).
3. **100% Data Preservation**: Complete schema, tables, relationships, order history, and media files migrated with zero data loss.
4. **Optimized Queries**: Eliminate N+1 SQL queries in `billing_service.py` and `sales_report_service.py`.

---

## 📋 Task Checklist & Execution Plan

### Phase 1: AWS Environment Setup
- [ ] Create AWS Account & set up IAM User.
- [ ] Select AWS Region (e.g., `ap-south-1` Mumbai or nearest to restaurant operations).
- [ ] Spin up **AWS RDS PostgreSQL** instance (`db.t4g.micro` or `db.t3.micro`).
- [ ] Create **AWS S3 Bucket** (`dinebuddy-media-uploads`) for dish images & restaurant logos.

---

### Phase 2: Database Data Migration (Zero Data Loss)
- [ ] **Step 1: Take Full Supabase Dump**
  ```bash
  pg_dump -h aws-1-ap-northeast-2.pooler.supabase.com -U postgres.iahzjepenwomwvjjtszo -p 6543 -d postgres -F c -f dinebuddy_full_backup.dump
  ```
- [ ] **Step 2: Create Target Database in AWS RDS**
  ```sql
  CREATE DATABASE dinebuddy;
  ```
- [ ] **Step 3: Restore Complete Data to AWS RDS**
  ```bash
  pg_restore --no-owner --no-privileges -h <AWS_RDS_ENDPOINT> -U postgres -d dinebuddy dinebuddy_full_backup.dump
  ```
- [ ] **Step 4: Verify Migration Integrity**
  - Verify total count of `users`, `customers`, `restaurants`, `menu_items`, `orders`, and `table_sessions`.
  - Run `alembic upgrade head` to confirm migration table status.

---

### Phase 3: Media File Assets Migration
- [ ] Sync local uploads / static assets to AWS S3:
  ```bash
  aws s3 sync ./backend/app/static/uploads s3://dinebuddy-media-uploads/uploads --acl public-read
  ```
- [ ] Update frontend/backend media URL handler to point to S3 / CloudFront.

---

### Phase 4: Backend Deployment on AWS App Runner / EC2
- [ ] Build Docker container for backend API.
- [ ] Deploy container on **AWS App Runner** or **AWS EC2**.
- [ ] Configure Environment Variables on AWS:
  - `DATABASE_URL=postgresql://postgres:<PASSWORD>@<AWS_RDS_ENDPOINT>:5432/dinebuddy`
  - `ENVIRONMENT=production`
  - `CORS_ORIGINS=https://dinebuddy.vercel.app,*`
  - `SECRET_KEY=<SECURE_PRODUCTION_SECRET>`

---

### Phase 5: Code Optimizations (Performance Boost)
- [ ] **Fix N+1 SQL Queries**: Update `billing_service.py` to use SQLAlchemy `joinedload(Order.items)` & `joinedload(Order.session)`.
- [ ] **Adjust Polling Intervals**: Increase polling in `KDSView.jsx` and `OrdersModule.jsx` from 5s/8s to 15s-20s.
- [ ] **Console Log Clean**: Ensure `echo=False` in `database.py` for production.

---

### Phase 6: DNS Cutover & Final Verification
- [ ] Update `VITE_API_BASE_URL` in Vercel to point to AWS API.
- [ ] Trigger Vercel deploy.
- [ ] Perform End-to-End testing (Login, POS Order, Customer QR Order, KDS, Billing, Sales Reports).

---

**Task Status**: Saved & Pending Execution  
**Created Date**: August 2026  
