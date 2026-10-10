/**
 * Utility functions for clothing sizing support (S, M, L, XL, XXL)
 * Applies strictly to Tops and Bottoms.
 * Accessories (Shoes, Watches, Caps, Belts, Sunglasses) have no size (NULL).
 */

export const ALLOWED_CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/**
 * Determines whether a product is clothing (Tops or Bottoms).
 */
export function isClothingProduct(product) {
  if (!product) return false;
  const vtonCat = (product.vton_garment_category || product.vtonCategory || '').toLowerCase();
  if (vtonCat === 'tops' || vtonCat === 'bottoms') return true;

  const cat = (product.category || '').toLowerCase();
  if (['shirts', 't-shirts', 'hoodies', 'jackets', 'pants & trousers', 'pants', 'trousers', 'tops', 'bottoms'].includes(cat)) {
    return true;
  }

  return false;
}

/**
 * Returns available sizes for product: ['S', 'M', 'L', 'XL', 'XXL'] for clothing, [] for accessories.
 */
export function getProductSizes(product) {
  return isClothingProduct(product) ? [...ALLOWED_CLOTHING_SIZES] : [];
}

/**
 * Validates requested size for a given product.
 * Returns { isValid: boolean, size: string|null, error?: string }
 */
export function validateProductSize(product, requestedSize) {
  const isClothing = isClothingProduct(product);

  if (isClothing) {
    if (!requestedSize || typeof requestedSize !== 'string' || !requestedSize.trim()) {
      return {
        isValid: false,
        size: null,
        error: 'Please select a size.'
      };
    }

    const normalizedSize = requestedSize.trim().toUpperCase();
    if (!ALLOWED_CLOTHING_SIZES.includes(normalizedSize)) {
      return {
        isValid: false,
        size: null,
        error: `Invalid size "${requestedSize}". Allowed clothing sizes are: ${ALLOWED_CLOTHING_SIZES.join(', ')}.`
      };
    }

    return {
      isValid: true,
      size: normalizedSize
    };
  }

  // Accessories must not have a size
  return {
    isValid: true,
    size: null
  };
}
