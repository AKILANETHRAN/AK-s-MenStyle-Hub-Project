import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [addingToCart, setAddingToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const isSoldOut = product.stock === 0 || product.status === 'SOLD_OUT';
  const inWishlist = isInWishlist(product.id);

  const handleTryOn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Safety verification: VTON receives product.garment_image (isolated garment), NOT product.image
    navigate(`/virtual-try-on?productId=${product.id}&garmentImage=${encodeURIComponent(product.garment_image)}`);
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut || addingToCart) return;

    setAddingToCart(true);
    try {
      await addToCart(product.id, 1);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistLoading) return;

    setWishlistLoading(true);
    try {
      await toggleWishlist(product.id);
    } catch (err) {
      alert(err.message || 'Failed to update wishlist.');
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem',
        overflow: 'hidden',
        position: 'relative',
        transition: 'var(--transition-smooth)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)'
      }}
    >
      {/* Product Display Photo Container */}
      <Link
        to={`/products/${product.id}`}
        style={{
          display: 'block',
          position: 'relative',
          width: '100%',
          paddingTop: '130%',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backgroundColor: '#12151b',
          textDecoration: 'none',
          marginBottom: '1rem'
        }}
      >
        <img
          src={product.image}
          alt={product.name}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease'
          }}
          loading="lazy"
        />

        {/* VTON Badge */}
        {product.vton_supported === 1 && (
          <span
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(16, 185, 129, 0.9)',
              color: '#ffffff',
              letterSpacing: '0.04em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 2
            }}
          >
            VTON READY
          </span>
        )}

        {/* Stock Badge */}
        <span
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            fontSize: '10px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isSoldOut ? 'rgba(239, 68, 68, 0.95)' : (product.stock <= 3 ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0, 0, 0, 0.75)'),
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            zIndex: 2
          }}
        >
          {isSoldOut ? 'OUT OF STOCK' : (product.stock <= 3 ? `${product.stock} left (Low)` : `${product.stock} left`)}
        </span>

        {/* Wishlist Heart Icon Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 18, 24, 0.85)',
            backdropFilter: 'blur(6px)',
            border: inWishlist ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
            color: inWishlist ? 'var(--accent-gold)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 3,
            transition: 'var(--transition-smooth)'
          }}
        >
          {inWishlist ? '♥' : '♡'}
        </button>
      </Link>

      {/* Product Information */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '11px', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            {product.brand}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {product.category}
          </span>
        </div>

        <Link
          to={`/products/${product.id}`}
          style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: '0.35rem'
          }}
        >
          {product.name}
        </Link>

        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          {product.cloth_type} • {product.color}
        </p>

        {/* Price Row */}
        <div style={{ marginTop: 'auto', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
              ₹{product.price}
            </span>
            {product.original_price && product.original_price > product.price && (
              <span style={{ fontSize: 'var(--font-size-xs)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                ₹{product.original_price}
              </span>
            )}
            {product.discount_percent > 0 ? (
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {product.discount_percent}% OFF
              </span>
            ) : (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                NO OFFER
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <Link
                to={`/products/${product.id}`}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
              >
                VIEW DETAILS
              </Link>

              <button
                type="button"
                className="btn btn-outline"
                disabled={isSoldOut || addingToCart}
                title={isSoldOut ? 'Out of stock' : 'Add to Cart'}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: 'var(--font-size-xs)',
                  opacity: isSoldOut ? 0.4 : 1,
                  backgroundColor: justAdded ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  borderColor: justAdded ? 'var(--accent-green)' : 'var(--border-color)',
                  color: justAdded ? 'var(--accent-green)' : 'var(--text-primary)',
                  transition: 'var(--transition-smooth)'
                }}
                onClick={handleAddToCart}
              >
                {justAdded ? '✓ ADDED' : (addingToCart ? 'ADDING...' : (isSoldOut ? 'SOLD OUT' : 'ADD TO CART'))}
              </button>
            </div>

            {/* VTON Button (Visible strictly for tops and bottoms, NEVER for accessories) */}
            {product.vton_supported === 1 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTryOn}
                style={{
                  padding: '0.5rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-gold)',
                  color: '#0d0f12',
                  border: 'none'
                }}
              >
                ✨ TRY THIS ON
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
