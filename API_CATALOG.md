# 🚀 Haatza Backend — Master API Catalog

This document is the **Single Source of Truth** for all active and implemented API endpoints in the **Haatza Backend**.

Base Production URL: `https://haatza-production-807150947524.asia-south1.run.app`  
Local Base URL: `http://localhost:8080`

---

## 📑 Table of Contents
1. [Authentication & Device Sessions](#1-authentication--device-sessions)
2. [Products & Buyer Catalog](#2-products--buyer-catalog)
3. [Categories Master & Hierarchy](#3-categories-master--hierarchy)
4. [Grow Plan & Subscriptions](#4-grow-plan--subscriptions)
5. [AppBar Categories (Banners)](#5-appbar-categories)
6. [Dashboard Widgets](#6-dashboard-widgets)

---

## 1. Authentication & Device Sessions

### Auth Endpoints
| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/auth/check-user` | `POST` | Public | Check if user exists by email or mobile | `Body: { identifier: string }` |
| `/api/v1/users/check` | `GET` | Public | Check if user exists via GET query | `Query: ?email=... or ?phoneNumber=...` |
| `/api/v1/auth/register` | `POST` | Public | Register new user (Buyer / Seller) | `Body: { name, email, mobile, password, isSeller? }` |
| `/api/v1/auth/login` | `POST` | Public | Authenticate user with password | `Body: { identifier, password }` |
| `/api/v1/auth/employee-login` | `POST` | Public | Employee / Staff login | `Body: { email, password }` |
| `/api/v1/auth/forgot-password` | `POST` | Public | Send password reset OTP | `Body: { identifier: string }` |
| `/api/v1/auth/reset-password` | `POST` | Public | Reset password with OTP code | `Body: { identifier, otp, newPassword }` |
| `/api/v1/auth/generate-otp` | `POST` | Public | Generate verification OTP | `Body: { identifier, purpose? }` |
| `/api/v1/auth/verify-otp` | `POST` | Public | Verify OTP code & authenticate | `Body: { identifier, otp }` |
| `/api/v1/auth/resend-otp` | `POST` | Public | Resend OTP to phone/email | `Body: { identifier, purpose? }` |
| `/api/v1/auth/refresh` | `POST` | Public | Issue new access token using refresh token | `Body: { refreshToken: string }` |
| `/api/v1/auth/logout` | `POST` | Public | Logout and invalidate session | `Body: { refreshToken: string }` |
| `/api/v1/auth/me` | `GET` | Bearer | Get authenticated user profile & active role | *Bearer Token Header* |

### Session Management Endpoints
| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/users/me/sessions` | `GET` | Bearer | **Get Sessions**: List all active device sessions for current user | *Bearer Token Header* |
| `/api/v1/users/me/sessions/:sessionId` | `DELETE` | Bearer | **Delete Session**: Terminate specific active device session | *URL Param: sessionId* |
| `/api/v1/users/me/sessions/revoke-others` | `POST` | Bearer | **Revoke Others**: Terminate all other sessions except current | *Bearer Token Header* |

---

## 2. Products & Buyer Catalog

| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/products` | `POST` | Public | **Create Product**: REST API to create a product | `Body: { name, price, subCategoryId, brand, ... }` |
| `/api/v1/sellerlisting` | `POST` | Public | **Seller Listing**: Create product listing via seller portal | `Body: { name, price, subCategoryId, brand, ... }` |
| `/api/v1/products-list` | `GET / POST`| Public | **Product List**: Paginated catalog product list | `Query: ?page=1&limit=20&search=...` |
| `/api/v1/products` | `GET` | Public | **Products REST Query**: Filter products by price/brand | `Query: ?page=1&limit=20&brand=...&min_price=...` |
| `/api/v1/products/:product_id` | `GET` | Public | **Product Details (REST)**: Fetch single product by ID | *URL Param: product_id* |
| `/api/v1/sellerProductDetails` | `GET` | Public | **Seller Product Details**: Details by productId | `Query: ?productId=... or ?id=...` |
| `/api/v1/updateSellerProduct` | `POST` | Public | **Update Product**: Update seller product details & pricing | `Body: { productId, name?, price?, inventory?, ... }` |
| `/api/v1/products/:product_id` | `PATCH` | Public | **Update Product (REST)**: Partial product update | `Body: { price?, name?, ... }` |
| `/api/v1/products/:product_id` | `DELETE` | Public | **Delete Product**: Remove product from catalog | *URL Param: product_id* |
| `/api/v1/productsBySubCategoryId` | `GET / POST`| Public | **Interleaved Buyer Catalog**: 2 Ads / 2 Organic + categoryFilters | `Query: ?module=haatza&subCategoryId=...&page=1&limit=20&brands=...&minPrice=...&maxPrice=...&sort=popularity` |
| `/api/v1/productsByCategory` | `GET` | Public | **Category Products**: Fetch products by category + filters | `Query: ?module=haatza&categoryId=...&page=1&count=10` |
| `/api/v1/productDetails` | `GET / POST` | Public | **Product Details (Wix-Compatible)**: Complete details, delivery fees, variants, and reviews in camelCase | `Query: ?productId=...&toPincode=...&userId=...` |
| `/api/v1/products/:product_id/inventory/increment` | `PATCH` | Public | Increment product stock inventory | `Body: { amount: number }` |
| `/api/v1/products/:product_id/inventory/decrement` | `PATCH` | Public | Decrement product stock inventory | `Body: { amount: number }` |

---

## 3. Categories Master & Hierarchy

| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/categories` | `GET` | Public | **Subcategories Drill-Down (Standard)**: Get subcategory tree for a category | `Query: ?module=haatza&category_id=CAT_ELEC` |
| `/api/v1/categories/main` | `GET` | Public | **Main Categories**: Top-level categories (parent IS NULL/0) | `Query: ?module=haatza&page=1&limit=10` |
| `/api/v1/categories/hierarchy` | `GET / POST`| Public | **Category Hierarchy Tree**: Full 3-tier tree (Main -> Category -> Subcategory) | `Query: ?module=haatza (or lite)` |
| `/api/v1/create_category` | `POST` | Public | **Create Category**: Create new category record | `Body: { categoryName, categoryType, parentCategoryId?, module }` |
| `/api/v1/get_category` | `GET` | Public | **Get Category**: Get single category details by ID | `Query: ?categoryId=...&module=haatza` |
| `/api/v1/update_category` | `PUT / POST`| Public | **Update Category**: Update category name, image, description | `Body: { categoryId, categoryName?, image? }` |
| `/api/v1/update_category_status` | `PUT / POST`| Public | **Update Category Status**: Toggle ACTIVE / INACTIVE | `Body: { categoryId, status: "ACTIVE" \| "INACTIVE" }` |
| `/api/v1/delete_category/:id` | `DELETE` | Public | **Delete Category**: Safe delete / deactivate category | *URL Param: id* |
| `/api/v1/category` | `GET` | Public | Legacy sorted category list | `Query: ?module=haatza` |
| `/api/v1/subcategorylist` | `GET` | Public | Legacy subcategory list with search | `Query: ?search=...&page=1&count=10&module=haatza` |


---

## 4. Grow Plan & Subscriptions

| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/subscription/create-order` | `POST` | Public | **Create Order**: Initialize subscription purchase order | `Body: { planId, planName, email, amount, durationMonths }` |
| `/api/v1/subscription/verify-payment` | `POST` | Public | **Verify Payment**: Verify Razorpay payment & activate plan | `Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, subscriptionId }` |
| `/api/v1/subscription/process-order` | `POST` | Public | **Process Order**: Process and activate verified order | `Body: { subscriptionId, razorpayPaymentId, razorpayOrderId }` |
| `/api/v1/subscription/reschedule` | `POST` | Public | **Reschedule**: Reschedule subscription start/end dates | `Body: { subscriptionId, startedDate, endedDate }` |
| `/api/v1/subscription/seller-subscription` | `GET` | Public | **Seller Subscription**: Get active plan & history by email | `Query: ?email=seller@haatza.com` |
| `/api/v1/getPlans` | `GET` | Public | **Get Plans**: Available master pricing plan tiers | None |
| `/api/v1/createSubscription` | `POST` | Public | **Create Subscription**: Direct subscription create/update | `Body: { email, planId, planName, startedDate, endedDate }` |
| `/api/v1/createRazorpayOrder` | `POST` | Bearer | **Create Razorpay Order**: Generate Razorpay order | `Body: { planId, amount }` |
| `/api/v1/grow-plans` | `GET / POST`| Public | **Grow Plans CRUD**: Manage Grow Plan page records | `Query: ?sellerId=... or Body: { planName, sellerId, ... }` |
| `/api/v1/grow-plans/:id` | `GET / PUT / DELETE` | Public | **Grow Plan by ID**: Fetch, update, or remove record | *URL Param: id* |

---

## 5. AppBar Categories

| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/appbar-categories/active` | `GET` | Public | Active icon banners for top mobile/web appbar | `Query: ?module=lite (or haatza)` |
| `/api/v1/appbar-categories` | `GET` | Public | List all appbar categories | `Query: ?warehouseId=...&module=...` |
| `/api/v1/appbar-categories` | `POST` | Public | Create new appbar category | `Body: { categoryName, image, primaryAppbarColor?, module? }` |
| `/api/v1/appbar-categories/:id` | `PUT` | Public | Update appbar category | `Body: { categoryName?, image?, status? }` |
| `/api/v1/appbar-categories/:id` | `DELETE` | Public | Delete appbar category | *URL Param: id* |

---

## 6. Dashboard Widgets

| Endpoint Path | Method | Auth | Description | Payload / Parameters |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/dashboard` | `GET` | Public | **Dashboard Widgets (GET)**: Retrieve grouped homepage widgets | `Query: ?module=HAATZA (or LITE)&warehouseId=...` |
| `/api/v1/dashboard/widgets` | `GET` | Public | **Dashboard Widgets (Alias)**: Alias route for widgets | `Query: ?module=HAATZA` |
| `/api/v1/dashboard/get_dashboard` | `POST` | Public | **Dashboard Widgets (POST)**: Retrieve grouped widgets via POST | `Body: { module: "HAATZA" \| "LITE", warehouseId? }` |
| `/api/v1/dashboard/ping` | `GET` | Public | Service health check | None |
| `/api/v1/dashboard/:id` | `DELETE` | Public | Delete dashboard widget | *URL Param: id* |

