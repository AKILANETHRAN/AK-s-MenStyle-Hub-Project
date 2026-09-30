# AK'S MEN STYLE — RESTful API Documentation

This document provides a comprehensive technical reference for the backend REST APIs powering the **AK'S MEN STYLE** luxury menswear and neural virtual fitting platform.

---

## Architecture Overview

- **Protocol**: HTTP/1.1 REST JSON
- **Base URL**: `http://localhost:5000`
- **Authentication**: JWT Bearer Token passed via HTTP Header: `Authorization: Bearer <TOKEN>`
- **Database**: SQLite with WAL mode, foreign key enforcement, and indexes
- **AI Inference**: Local FASHN Diffusion v1.5 with NVIDIA RTX 2050 CUDA acceleration (`http://127.0.0.1:7860`)

---

## 1. System Health

### GET `/api/health`
Checks operational status of the Express server, SQLite database, and local neural VTON pipeline.

- **Auth Required**: No
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "StyleHub Express Backend",
    "database": "connected",
    "vton": "FASHN VTON v1.5 LOCAL (CUDA)"
  }
  ```

---

## 2. Authentication & Profile (`/api/auth`)

### POST `/api/auth/register`
Creates a new customer account with auto-generated unique username and encrypted password hash.

- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "fullName": "Akil Sundaram",
    "email": "akil.sundaram@aksmenstyle.com",
    "password": "AkilStyle2026!",
    "phone": "+91-9840112345",
    "age": 29,
    "address": "42 Poes Garden",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600086"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "status": "success",
    "token": "<JWT_STRING>",
    "user": {
      "id": 1006,
      "username": "akil_sundaram",
      "fullName": "Akil Sundaram",
      "email": "akil.sundaram@aksmenstyle.com",
      "role": "USER"
    }
  }
  ```

### POST `/api/auth/login`
Authenticates existing credentials (email or username) and issues a signed JWT.

- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "akil.sundaram@aksmenstyle.com",
    "password": "AkilStyle2026!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "token": "<JWT_STRING>",
    "user": {
      "id": 1006,
      "username": "akil_sundaram",
      "fullName": "Akil Sundaram",
      "email": "akil.sundaram@aksmenstyle.com",
      "role": "USER"
    }
  }
  ```

### GET `/api/auth/me`
Retrieves current authenticated user session data securely from token.

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Response `200 OK`**:
  ```json
  {
    "id": 1006,
    "username": "akil_sundaram",
    "fullName": "Akil Sundaram",
    "email": "akil.sundaram@aksmenstyle.com",
    "role": "USER",
    "phone": "+91-9840112345",
    "city": "Chennai",
    "state": "Tamil Nadu"
  }
  ```

---

## 3. Product Catalog (`/api/products`)

### GET `/api/products`
Retrieves paginated and filtered catalog products.

- **Auth Required**: No
- **Query Parameters**:
  - `category`: e.g. `Shirts`, `Pants`, `Jackets`, `Shoes`, `Watches`
  - `inStock`: `true` | `false`
  - `search`: search query
  - `limit`: number of items
  - `offset`: page offset
- **Response `200 OK`**:
  ```json
  {
    "products": [
      {
        "id": 1,
        "name": "Classic Oxford Slim-Fit Shirt",
        "brand": "AK Signature",
        "category": "Shirts",
        "cloth_type": "Top",
        "price": 499,
        "original_price": 599,
        "discount_percent": 20,
        "stock": 14,
        "status": "IN_STOCK",
        "image": "...",
        "garment_image": "...",
        "vton_supported": 1,
        "vton_garment_category": "tops"
      }
    ],
    "total": 100
  }
  ```

### GET `/api/products/:id`
Retrieves full details for a single product.

- **Auth Required**: No
- **Response `200 OK`**: Single product object.

---

## 4. Rule-Based Recommendations (`/api/recommendations`)

### GET `/api/recommendations/product/:id`
Returns deterministic rule-based complementary items (top, bottom, shoes, watch) ensuring zero color clash.

- **Auth Required**: No
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "available": true,
    "baseProduct": { "id": 1, "name": "Classic Oxford Slim-Fit Shirt", "clothType": "Top" },
    "recommendations": [
      {
        "slotType": "BOTTOM",
        "product": { "id": 21, "name": "Tailored Charcoal Chino Trousers", "price": 599 },
        "reason": "Charcoal creates balanced contrast with white Oxford weave."
      },
      {
        "slotType": "SHOES",
        "product": { "id": 51, "name": "Executive Leather Derby Shoes", "price": 649 },
        "reason": "Classic footwear anchor for smart-casual tailoring."
      },
      {
        "slotType": "WATCH",
        "product": { "id": 61, "name": "Minimalist Silver Chronograph Watch", "price": 699 },
        "reason": "Polished silver bezel matches structured executive tones."
      }
    ]
  }
  ```

---

## 5. Recently Accessed Products (`/api/recently-accessed`)

### GET `/api/recently-accessed`
Returns authenticated user's recently accessed products ordered latest first (limit 12).

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "count": 3,
    "products": [
      { "id": 55, "name": "Italian Silk Pocket Square", "price": 450, "image": "..." },
      { "id": 21, "name": "Tailored Charcoal Chino Trousers", "price": 599, "image": "..." },
      { "id": 1, "name": "Classic Oxford Slim-Fit Shirt", "price": 499, "image": "..." }
    ]
  }
  ```

### POST `/api/recently-accessed`
Records a product view for the authenticated user using atomic upsert.

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Request Body**:
  ```json
  { "productId": 1 }
  ```
- **Response `200 OK`**:
  ```json
  { "status": "success", "message": "Product access recorded.", "productId": 1 }
  ```

---

## 6. Social Styling & Friends (`/api/friends`, `/api/wishlist/shares`)

### POST `/api/friends/request`
Sends a friend request to another user by `@username`.

- **Auth Required**: Yes
- **Request Body**: `{ "username": "rahul_devan" }`
- **Response `201 Created`**

### POST `/api/friends/accept/:id`
Accepts an incoming friend request, establishing mutual friendship.

- **Auth Required**: Yes
- **Response `200 OK`**

### POST `/api/wishlist/shares`
Shares selected garments or a complete 4-piece coordinated look privately with a friend.

- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "receiverId": 1007,
    "shareType": "LOOK",
    "productIds": [1, 21, 51, 61],
    "message": "Check out this curated Oxford ensemble!"
  }
  ```
- **Response `201 Created`**: Returns created share record with unique share ID.

### POST `/api/wishlist/shares/:id/feedback`
Submits peer reaction (`LIKE`, `LOVE`, `FIRE`) or feedback comment on a shared look.

- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "reaction": "FIRE",
    "comment": "Incredible styling combination. Fits perfectly!"
  }
  ```
- **Response `200 OK`**

---

## 7. Direct & Combo Purchases (`/api/purchases`)

### POST `/api/purchases/product`
Direct single product purchase (quantity must be strictly 1).

- **Auth Required**: Yes
- **Request Body**: `{ "productId": 1, "quantity": 1 }`
- **Response `201 Created`**

### POST `/api/purchases/combo`
Atomic purchase of a complete 4-piece curated look.

- **Auth Required**: Yes
- **Request Body**: `{ "productIds": [1, 21, 51, 61] }`
- **Response `201 Created`**

### GET `/api/purchases`
Retrieves authenticated user's order history.

- **Auth Required**: Yes
- **Response `200 OK`**

---

## 8. Local Neural AI Virtual Try-On (`/api/vton`)

### POST `/api/vton/try-on`
Submits a user portrait and studio garment ID for local CUDA inference.

- **Auth Required**: Yes
- **Multipart Form Data**:
  - `userImage`: image file upload
  - `productId`: ID of studio garment (1–50)
- **Response `200 OK` / `202 Accepted`**: Returns processing status and generated fitting image path.

---

## 9. Chatbot Assistant (`/api/chatbot`)

### POST `/api/chatbot/message`
Deterministic, rule-based fashion guide answering questions about products, styling, VTON, and checkout.

- **Auth Required**: No
- **Request Body**:
  ```json
  { "message": "Show me shirts" }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "reply": "Here are premium Shirts from our current catalog (prices strictly ₹400–₹700 with verified discounts):",
    "products": [ ... ],
    "action": { "type": "NAVIGATE", "label": "View All Shirts", "path": "/products?category=Shirts" },
    "suggestions": [ "Suggest pants for white shirt", "What can I try with VTON?", "How do I purchase?" ]
  }
  ```

---

## 10. Administrator Console (`/api/admin`)
*Strictly guarded by `requireAdmin` middleware. Unauthorized requests return `401 Unauthorized` or `403 Forbidden`.*

### GET `/api/admin/metrics`
Returns real SQLite database aggregate counts.

- **Auth Required**: Yes (`role === 'ADMIN'`)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "metrics": {
      "totalUsers": 68,
      "totalProducts": 100,
      "totalPurchases": 23,
      "totalWishlistItems": 18,
      "totalFriendConnections": 6,
      "totalVtonResults": 39,
      "totalRecentlyAccessed": 15,
      "totalRevenue": 30770
    }
  }
  ```

### GET `/api/admin/products`
Returns all 100 catalog products with stock, pricing, and VTON capability flags.

- **Auth Required**: Yes (`role === 'ADMIN'`)

### PATCH `/api/admin/products/:id`
Safely updates product pricing (₹400–₹700), discount tier (0%, 20%, 30%, 40%), or stock without touching garment image identity.

- **Auth Required**: Yes (`role === 'ADMIN'`)
- **Request Body**:
  ```json
  { "price": 520, "discountPercent": 20, "stock": 15 }
  ```

### GET `/api/admin/users`
Returns user account metadata with passphrases and password hashes strictly suppressed.

- **Auth Required**: Yes (`role === 'ADMIN'`)

### GET `/api/admin/purchases`
Returns orders with buyer usernames, item breakdowns, and amounts.

- **Auth Required**: Yes (`role === 'ADMIN'`)

### GET `/api/admin/vton-stats`
Returns neural try-on telemetry: total runs, tops count, bottoms count, success count.

- **Auth Required**: Yes (`role === 'ADMIN'`)

### GET `/api/admin/recent-activity`
Returns aggregate recent transactions, registrations, and peer look sharing events.

- **Auth Required**: Yes (`role === 'ADMIN'`)
