# AK'S MEN STYLE — Manual Real Gmail Purchase Notification Test Guide

This document describes the exact procedure for performing a manual, end-to-end real Gmail inbox verification for AK'S MEN STYLE.

> **CRITICAL SECURITY NOTICE**:  
> Never commit real Google App Passwords or SMTP credentials to Git, repositories, frontend code, or public documentation. All credentials must reside strictly in your private local `stylehub-backend/.env` file.

---

## 1. Prerequisites & Environment Setup

### 1.1 Generate Gmail App Password
1. Navigate to your Google Account: [https://myaccount.google.com/](https://myaccount.google.com/)
2. Ensure **2-Step Verification** is turned **ON** under Security.
3. In the search bar, search for **App passwords**.
4. Create a new app password with name `AK'S MEN STYLE Backend`.
5. Copy the 16-character generated password (e.g., `xxxx xxxx xxxx xxxx`).

### 1.2 Configure `stylehub-backend/.env`
Open `stylehub/stylehub-backend/.env` and update the email settings:

```ini
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=akmensstylehub@gmail.com
SMTP_PASS=your_16_char_app_password_here
EMAIL_FROM=akmensstylehub@gmail.com
EMAIL_FROM_NAME=AK'S MEN STYLE
```

### 1.3 Start Backend & Frontend
In terminal 1 (Backend):
```bash
cd stylehub/stylehub-backend
npm run start
```
*Expected: `[StyleHub Backend] Server running on port 5000`*

In terminal 2 (Frontend):
```bash
cd stylehub-frontend-merged
npm run dev
```
*Expected: Vite dev server running on `http://localhost:5173`*

---

## 2. Step-by-Step Real Inbox Verification Workflow

### Step 1: Customer Profile & Preference Confirmation
1. Open browser to `http://localhost:5173` and log in with your customer account.
2. In the profile page (`/profile`), ensure your email address matches a real, accessible Gmail inbox you control.
3. Open the **Settings Drawer** (gear icon in the top header).
4. Verify that:
   - **Email Notifications** checkbox is **checked** [✓].
   - The status badge reads: `✓ Email delivery configured`.

---

### Step 2: Single Product Purchase Email Test
1. Navigate to `/products` and select any available garment (e.g. *Minimalist Oxford Cotton Shirt*).
2. Click **PURCHASE NOW**.
3. In the Purchase Confirmation modal:
   - Verify header: `PURCHASE SUCCESSFUL`.
   - Verify Communication Notifications section: `✉️ Email` displays `✓ Sent`.
4. Open the customer's Gmail inbox:
   - **Sender**: `AK'S MEN STYLE <akmensstylehub@gmail.com>`
   - **Subject**: `AK'S MEN STYLE — Purchase Successful`
   - **Design**: Premium Black and Gold layout with clear purchase details, delivery owner, delivery address snapshot, and complimentary footer.
   - **Validation**: Confirm zero references to courier tracking, shipping progress, delivery ETA, or cancellation.

---

### Step 3: Complete Outfit Combo Purchase Test
1. Open any garment with compatible outfit recommendations.
2. Click **PURCHASE COMPLETE OUTFIT**.
3. In the confirmation modal:
   - Verify all selected outfit items are listed with quantity = 1.
   - Verify `✉️ Email` status is `✓ Sent`.
4. Check the customer's Gmail inbox:
   - **Subject**: `AK'S MEN STYLE — Outfit Purchase Successful`
   - **Body**: Lists all items comprising the outfit combo with total amount paid.

---

### Step 4: Cart Purchase with Buy More, Save More Reward
1. Add items totaling ≥ ₹1,000 to bag to unlock the *Buy More, Save More* discount tier.
2. Open `/cart` and click **PROCEED TO CHECKOUT**.
3. Complete the purchase.
4. Check the customer's Gmail inbox:
   - **Subject**: `AK'S MEN STYLE — Purchase Successful`
   - **Reward Breakdown**:
     - `Subtotal: ₹X,XXX`
     - `Buy More, Save More: X% OFF`
     - `Savings: -₹XXX`
     - `Final Total: ₹X,XXX`

---

### Step 5: Multilingual (Tamil) Purchase Email Test
1. Open the **Settings Drawer** and switch language to `தமிழ் [ TA ]`.
2. Complete any direct purchase.
3. Check the customer's Gmail inbox:
   - **Subject**: `AK'S MEN STYLE — வாங்குதல் வெற்றிகரமாக முடிந்தது`
   - **Heading**: `✓ வாங்குதல் வெற்றிகரமாக முடிந்தது`
   - **Greeting**: `வணக்கம் {fullName},`
   - **Details**: `வாங்கிய பொருள்:`, `மொத்தம்:`, `டெலிவரி பெறுநர்:`, `முகவரி:`
   - **Footer**: `AK'S MEN STYLE-ஐ பயன்படுத்தியதற்கு நன்றி.`

---

### Step 6: Idempotency & Duplicate Send Prevention Test
1. Refresh the `/purchases` history page multiple times.
2. Navigate away and return to the purchase details.
3. Check the customer's Gmail inbox:
   - **Expected**: No duplicate email is received.
4. Verify database audit:
   ```sql
   SELECT purchase_id, channel, status, provider_message_id, created_at
   FROM notification_deliveries
   WHERE purchase_id = <tested_id> AND channel = 'EMAIL';
   ```
   - Only one `SENT` record exists for that purchase.

---

### Step 7: Preference Disabling Test (Email OFF)
1. In the **Settings Drawer**, uncheck **Email Notifications**.
2. Make a purchase.
3. Verify:
   - Purchase succeeds normally.
   - In-App notification is created in `notifications` table.
   - No email is received in customer inbox.
   - Database audit records: `status = 'DISABLED'`.
