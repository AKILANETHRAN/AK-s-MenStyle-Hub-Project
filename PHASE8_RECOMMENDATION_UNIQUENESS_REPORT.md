# AK's MEN STYLE — Phase 8 Recommendation Uniqueness Verification Report
**Date:** September 29, 2026  
**Focus:** Recommendation Eligibility, Deterministic Uniqueness Allocation, and Accessory Standalone Behavior  
**Stack:** React (Vite :5173), Express (Node.js :5000), Better-SQLite3, Flask FASHN VTON (:7860)

---

## 1. Recommendation Eligibility Categories
The `COMPLETE THE LOOK` recommendation system is strictly restricted by category metadata:
- **Eligible Categories (Tops & Bottoms Only)**:
  - **Tops** (Products 1–20, 31–50): `Shirts`, `T-Shirts`, `Hoodies`, `Jackets` (`vton_supported = 1`, `vton_garment_category = 'tops'`).
  - **Bottoms** (Products 21–30): `Pants & Trousers` (`vton_supported = 1`, `vton_garment_category = 'bottoms'`).
- **Ineligible Categories (Accessories Only - Standalone Products)**:
  - **Shoes** (Products 51–60)
  - **Watches** (Products 61–70)
  - **Caps** (Products 71–80)
  - **Belts** (Products 81–90)
  - **Sunglasses** (Products 91–100)
- **API Response for Accessories**:
  ```json
  {
    "status": "success",
    "available": false,
    "reason": "Recommendations are only available for tops and bottoms",
    "recommendations": []
  }
  ```

---

## 2. Top Recommendation Rules
When the anchor product is a **TOP** (e.g. Shirt, T-Shirt, Polo, Hoodie, Jacket):
- Constructs a 4-piece outfit:
  $$\text{TOP (Anchor)} + \text{BOTTOM} + \text{SHOES} + \text{WATCH}$$
- Complementary roles:
  - **Bottom**: Pants & Trousers matching the top's style archetype and color harmony.
  - **Shoes**: Footwear suitable for the silhouette (Oxford/Derby for formal, Loafers/Sneakers for casual, Trainers/Skate shoes for streetwear).
  - **Watch**: Timepiece accent (Minimalist/Dress for formal, Chronograph/Field for casual, Digital/Pilot for streetwear).
- Signature Format: `${anchorId}-${bottomId}-${shoeId}-${watchId}`.

---

## 3. Bottom Recommendation Rules
When the anchor product is a **BOTTOM** (e.g. Formal Trousers, Chinos, Cargo Pants, Joggers):
- Constructs a 4-piece outfit:
  $$\text{BOTTOM (Anchor)} + \text{TOP} + \text{SHOES} + \text{WATCH}$$
- Complementary roles:
  - **Top**: Compatible shirt, t-shirt, hoodie, or jacket matching the cut and tone.
  - **Shoes**: Complementary footwear.
  - **Watch**: Complementary watch.
- Signature Format: `${anchorId}-${topId}-${shoeId}-${watchId}`.

---

## 4. Accessory Standalone Behavior
When viewing any accessory (Products 51–100):
- **NO** "COMPLETE THE LOOK" section is displayed.
- **NO** outfit combos or related products are automatically attached.
- Displays standard product interface:
  - `[ ADD TO CART ]`
  - `[ ADD TO WISHLIST ]`
  - `[ PURCHASE NOW ]`
- Clicking `[ PURCHASE NOW ]` purchases **only** the selected accessory directly.

---

## 5. Unique Combination Strategy
- Implemented in `stylehub-backend/services/recommendationEngine.js`:
  1. Identifies compatible in-stock items (`stock > 0`, `status = 'IN_STOCK'`, `id != anchor.id`).
  2. Scores items according to style archetype cloth types (+10) and color harmony (+8 for compatible palette, +4 for neutral palette).
  3. Traverses candidate combinations deterministically in rank order.
  4. Generates signature:
     - Top: `${anchor.id}-${bottom.id}-${shoe.id}-${watch.id}`
     - Bottom: `${anchor.id}-${top.id}-${shoe.id}-${watch.id}`
  5. Tracks globally assigned signatures and recommended trios.
  6. Rejects any combination whose signature or recommended trio is already assigned to another anchor.
  7. Persists selected unique combination to the SQLite database table `outfit_recommendations`.
  8. Refreshes load the persisted stable combination without random fluctuations.

---

## 6. Uniqueness Validation
Every single clothing anchor (all 40 Tops and all 10 Bottoms, total 50 products) was queried and verified:
- **Total Clothing Anchors Tested**: 50
- **Total Unique Signatures Returned**: 50
- **Duplicate Signatures**: **0** (Zero duplicates)
- Each anchor in the catalog received a 100% unique combination signature.

---

## 7. Out-Of-Stock Validation
- Dynamic re-allocation was tested by marking a currently recommended item as `SOLD_OUT` (`stock = 0`).
- The engine detected the stale combination, removed it from `outfit_recommendations`, generated a brand-new unique combination using other in-stock items, and verified that:
  - The out-of-stock item was strictly excluded.
  - All recommended items had `stock > 0`.
  - The new combination signature remained unique.

---

## 8. Purchase Regression
- **Accessory Purchase**: Purchasing Shoe #51 via `POST /api/purchases/product` confirmed that the purchase record contained strictly 1 item (Product #51), with `purchase_type = 'SINGLE'`.
- **Top/Bottom Single Purchase**: "BUY PRODUCT ONLY" on Product #1 created a single-item purchase.
- **Top/Bottom Combo Purchase**: "PURCHASE COMPLETE OUTFIT" created a 4-item combo purchase containing the anchor and the 3 recommended items.
- All transactional stock checks and delivery address validations remained fully operational.

---

## 9. Test Counts (`npm test`)
- **Phase 2 Database Schema Integrity**: 16 passed
- **Phase 3 Auth & Persistence**: 16 passed
- **Phase 4 Product Catalog Verification**: 22 passed
- **Phase 6 Cart & Wishlist Verification**: 23 passed
- **Phase 6 E2E Verification**: 8 passed
- **Phase 7 Friends & Wishlist Sharing**: 20 passed
- **Phase 7 Persistence Across Restarts**: 4 passed
- **Phase 8 Recommendation Uniqueness & Purchase**: 143 passed
- **Total Assertions**: **252 passed, 0 failed (100%)**

---

## 10. Frontend Build Result
- Command: `npm run build` in `stylehub-frontend-merged` (and `stylehub/stylehub-frontend`)
- Result: **0 errors** (built in 4.31s)
- Output Bundle: `dist/assets/index-D3iEB19S.js` (310.93 kB), `dist/assets/index-DpJzfw9S.css` (4.11 kB).

---

## FINAL STATUS FORMAT

```text
RECOMMENDATION RULE:

TOPS: PASS
BOTTOMS: PASS
SHOES: NO RECOMMENDATION
WATCHES: NO RECOMMENDATION
CAPS: NO RECOMMENDATION
BELTS: NO RECOMMENDATION
SUNGLASSES: NO RECOMMENDATION

UNIQUE COMPLETE-THE-LOOK COMBINATIONS: 50/50
DUPLICATE COMBINATIONS: 0

PURCHASE REGRESSION: PASS
BACKEND TESTS: 252/252
FRONTEND BUILD: PASS
```
