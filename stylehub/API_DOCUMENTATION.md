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

### GET `/api/auth/google/config`
Retrieves public Google OAuth configuration for frontend initialization.
- **Auth Required**: No
- **Response `200 OK`**:
  ```json
  {
    "clientId": "your_google_client_id.apps.googleusercontent.com",
    "configured": true,
    "redirectUri": "http://localhost:5000/api/auth/google/callback"
  }
  ```

### GET `/api/auth/google/url`
Generates Google OAuth2 authorization consent URL for redirect authentication flow.
- **Auth Required**: No
- **Query Parameters**: `redirect_uri` (optional), `state` (optional)
- **Response `200 OK`**:
  ```json
  {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=your_google_client_id.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fauth%2Fgoogle%2Fcallback&response_type=code&scope=openid+email+profile&access_type=offline&prompt=select_account&state=...",
    "state": "...",
    "redirectUri": "http://localhost:5000/api/auth/google/callback"
  }
  ```

### POST `/api/auth/google`
Authenticates via Google Identity Services (GIS) ID Token or exchanges Authorization Code. Synchronizes the user account in SQLite and returns standard JWT session.
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "credential": "<GOOGLE_ID_TOKEN_JWT>"
  }
  ```
  *or with authorization code:*
  ```json
  {
    "code": "<AUTHORIZATION_CODE>",
    "redirectUri": "http://localhost:5173/auth/google/callback"
  }
  ```
- **Response `200 OK` (Existing User) / `201 Created` (New User)**:
  ```json
  {
    "status": "success",
    "token": "<JWT_STRING>",
    "user": {
      "id": 1011,
      "username": "akil_customer",
      "fullName": "Akil Customer",
      "email": "customer@gmail.com",
      "role": "USER",
      "avatarUrl": "https://lh3.googleusercontent.com/..."
    }
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

---

## 12. Google OAuth Integration (`/api/auth/google`)

### GET `/api/auth/google/config`
Returns public Google OAuth Client ID and configuration state for the client interface.

- **Auth Required**: No
- **Response `200 OK`**:
  ```json
  {
    "clientId": "your_google_client_id.apps.googleusercontent.com",
    "configured": true
  }
  ```

### GET `/api/auth/google/url`
Generates a secure Google OAuth consent redirect URL with CSRF state protection.

- **Auth Required**: No
- **Query Parameters**:
  - `redirect_uri` *(optional)*: Override callback destination (defaults to `/auth/google/callback`)
  - `state` *(optional)*: Cryptographic CSRF state token
- **Response `200 OK`**:
  ```json
  {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile&access_type=offline&prompt=select_account&state=...",
    "state": "<16_BYTE_HEX_STATE>"
  }
  ```

### GET `/api/auth/google/callback`
Server-side callback relay that safely forwards code/state to the frontend application.

- **Auth Required**: No
- **Query Parameters**: `code`, `state`, `error`
- **Response**: `302 Redirect` to `/auth/google/callback?code=...&state=...`

### POST `/api/auth/google`
Authenticates a user via Google Identity Services (GIS) ID Token or Authorization Code. Matches existing verified email or creates a new account with role `USER`. Returns standard AK'S MEN STYLE JWT.

- **Auth Required**: No
- **Request Body** *(One of the following)*:
  ```json
  { "credential": "<GOOGLE_ID_TOKEN>" }
  ```
  *or*
  ```json
  { "code": "<AUTHORIZATION_CODE>", "redirectUri": "http://localhost:5173/auth/google/callback" }
  ```
- **Response `200 OK` / `201 Created`**:
  ```json
  {
    "status": "success",
    "token": "<JWT_STRING>",
    "user": {
      "id": 14,
      "username": "akil_sundaram",
      "fullName": "Akil Sundaram",
      "email": "akil.sundaram@gmail.com",
      "role": "USER",
      "avatarUrl": "https://lh3.googleusercontent.com/..."
    }
  }
  ```

---

## 13. Settings & Preferences (`/api/settings`)

### GET `/api/settings`
Retrieves authenticated user's color theme, language preference, communication channel toggles, and delivery account summary.

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "settings": {
      "theme": "gold-silver",
      "language": "en",
      "communication": {
        "email": true,
        "sms": true,
        "whatsapp": true
      },
      "account": {
        "id": 1,
        "username": "akil_sundaram",
        "fullName": "Akil Sundaram",
        "email": "akil.sundaram@aksmenstyle.com",
        "phone": "+91-9840112345",
        "address": "42 Poes Garden",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600086",
        "role": "USER"
      }
    }
  }
  ```

### PUT `/api/settings`
Updates appearance theme (`gold-silver`, `midnight-silver`, `black-champagne`), interface language (`en`, `ta`), and notification preferences in SQLite.

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Request Body**:
  ```json
  {
    "theme": "midnight-silver",
    "language": "ta",
    "communication": {
      "email": true,
      "sms": false,
      "whatsapp": true
    }
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "message": "Settings updated successfully.",
    "settings": {
      "theme": "midnight-silver",
      "language": "ta",
      "communication": {
        "email": true,
        "sms": false,
        "whatsapp": true
      }
    }
  }
  ```

### GET `/api/settings/notifications/history`
Returns logged notification delivery attempts and statuses for purchases belonging strictly to the authenticated user.

- **Auth Required**: Yes (`Bearer <TOKEN>`)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "deliveries": [
      {
        "id": 12,
        "purchase_id": 45,
        "channel": "EMAIL",
        "status": "NOT_CONFIGURED",
        "recipient": "akil.sundaram@aksmenstyle.com",
        "created_at": "2026-09-30 14:15:00",
        "total_amount": 540,
        "purchase_type": "SINGLE"
      },
      {
        "id": 13,
        "purchase_id": 45,
        "channel": "SMS",
        "status": "DISABLED",
        "recipient": "+919840112345",
        "created_at": "2026-09-30 14:15:00",
        "total_amount": 540,
        "purchase_type": "SINGLE"
      },
      {
        "id": 14,
        "purchase_id": 45,
        "channel": "WHATSAPP",
        "status": "NOT_CONFIGURED",
        "recipient": "+919840112345",
        "created_at": "2026-09-30 14:15:00",
        "total_amount": 540,
        "purchase_type": "SINGLE"
      }
    ]
  }
  ```

---

## 14. Purchase Notification Integration (`/api/purchases`)

Both `/api/purchases/product` and `/api/purchases/combo` automatically dispatch asynchronous communication jobs after the SQLite database transaction commits. Notification status is returned in the response object without blocking or rolling back successful orders:

```json
{
  "status": "success",
  "message": "PURCHASE SUCCESSFUL",
  "purchase": {
    "id": 46,
    "purchase_type": "SINGLE",
    "total_amount": 540,
    "delivery_name": "Akil Sundaram",
    "delivery_phone": "+91-9840112345",
    "delivery_address": "42 Poes Garden",
    "delivery_city": "Chennai",
    "delivery_state": "Tamil Nadu",
    "delivery_pincode": "600086",
    "created_at": "2026-09-30T08:45:00.000Z",
    "items": [ ... ]
  },
  "notifications": {
    "email": { "status": "NOT_CONFIGURED" },
    "sms": { "status": "DISABLED" },
    "whatsapp": { "status": "NOT_CONFIGURED" }
  }
}
```

