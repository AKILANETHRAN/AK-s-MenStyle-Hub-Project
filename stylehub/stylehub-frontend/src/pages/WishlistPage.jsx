import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import ShareWithFriendModal from '../components/ShareWithFriendModal';

export default function WishlistPage() {
  const { wishlist, loading, error, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [addingId, setAddingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [lastSharedInfo, setLastSharedInfo] = useState(null);

  const toggleSelect = (productId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === wishlist.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(wishlist.items.map(item => item.productId)));
    }
  };

  const handleAddToCart = async (product) => {
    if (product.isSoldOut || addingId) return;
    setAddingId(product.productId);
    setSuccessMsg('');
    try {
      await addToCart(product.productId, 1);
      setSuccessMsg(`Added "${product.name}" to your shopping bag!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart.');
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (productId) => {
    try {
      await removeFromWishlist(productId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    } catch (err) {
      alert(err.message || 'Failed to remove item from wishlist.');
    }
  };

  const selectedProductsList = wishlist.items.filter(item => selectedIds.has(item.productId));

  const handleShareSuccess = (shareResult, friend) => {
    setIsShareModalOpen(false);
    setSelectedIds(new Set());
    setLastSharedInfo({
      shareId: shareResult.data?.shareId || shareResult.shareId,
      friendUsername: friend?.username || 'friend'
    });
    setSuccessMsg(`Look shared privately with @${friend?.username || 'friend'}!`);
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge" style={{ marginBottom: '0.75rem' }}>Saved Collections</span>
          <h1>My Wishlist</h1>
          <p>Your curated items and favorite styles saved for later.</p>
        </div>

        {wishlist.items.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <span className="badge badge-gold" style={{ fontSize: '11px', fontWeight: 800 }}>
                {selectedIds.size} ITEMS SELECTED
              </span>
            )}

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSelectAll}
              style={{ fontSize: 'var(--font-size-xs)', padding: '0.5rem 1rem' }}
            >
              {selectedIds.size === wishlist.items.length ? 'Deselect All' : 'Select All'}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedIds.size === 0}
              onClick={() => setIsShareModalOpen(true)}
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: '0.55rem 1.4rem',
                fontWeight: 700
              }}
            >
              SHARE WITH FRIEND
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={clearWishlist}
              style={{ fontSize: 'var(--font-size-xs)', padding: '0.5rem 1rem' }}
            >
              Clear Wishlist
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div style={{
          padding: '0.85rem 1.25rem',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--accent-green)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent-green)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>✓ {successMsg}</div>
          {lastSharedInfo?.shareId && (
            <button
              onClick={() => navigate(`/shared-wishlist/${lastSharedInfo.shareId}`)}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.85rem', fontSize: 'var(--font-size-xs)' }}
            >
              View Shared Look →
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          borderRadius: 'var(--radius-sm)',
          color: '#f87171',
          marginBottom: '1.5rem',
          fontSize: 'var(--font-size-sm)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {loading && wishlist.items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          Loading your wishlist from database...
        </div>
      ) : wishlist.items.length === 0 ? (
        /* Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '560px', margin: '2rem auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--accent-gold)' }}>♡</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Your wishlist is empty.</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1.75rem' }}>
            Browse through our premium men's clothing and accessories to save your favorite fits.
          </p>
          <Link to="/products" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
            Explore Products
          </Link>
        </div>
      ) : (
        /* Wishlist Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.5rem'
        }}>
          {wishlist.items.map((item) => {
            const isSelected = selectedIds.has(item.productId);
            return (
              <div
                key={item.productId}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.25rem',
                  position: 'relative',
                  border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(212, 163, 89, 0.04)' : undefined,
                  transition: 'border 0.2s, background-color 0.2s'
                }}
              >
                {/* Select Checkbox Overlay */}
                <div
                  onClick={() => toggleSelect(item.productId)}
                  style={{
                    position: 'absolute',
                    top: '18px',
                    left: '18px',
                    zIndex: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(18, 21, 27, 0.85)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by div
                    style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                    {isSelected ? 'Selected' : 'Select'}
                  </span>
                </div>

                {/* Product Display Photo */}
                <Link
                  to={`/products/${item.productId}`}
                  style={{
                    display: 'block',
                    position: 'relative',
                    width: '100%',
                    paddingTop: '130%',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    backgroundColor: '#12151b',
                    marginBottom: '1rem'
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Stock Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: item.isSoldOut ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 0, 0, 0.75)',
                    color: '#ffffff'
                  }}>
                    {item.isSoldOut ? 'SOLD OUT' : `${item.stock} left`}
                  </span>
                </Link>

                {/* Information */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {item.brand}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {item.category}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 0.35rem', fontSize: 'var(--font-size-base)' }}>
                  <Link to={`/products/${item.productId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {item.name}
                  </Link>
                </h4>

                {/* Price Row */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem', marginTop: 'auto' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{item.price}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                    ₹{item.originalPrice}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)' }}>
                    {item.discountPercent}% OFF
                  </span>
                </div>

                {/* Actions: View Details, Add to Cart, Remove */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <Link
                      to={`/products/${item.productId}`}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
                    >
                      VIEW DETAILS
                    </Link>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={item.isSoldOut || addingId === item.productId}
                      onClick={() => handleAddToCart(item)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        backgroundColor: 'var(--accent-gold)',
                        color: '#0d0f12',
                        border: 'none',
                        fontWeight: 700,
                        opacity: item.isSoldOut ? 0.4 : 1
                      }}
                    >
                      {addingId === item.productId ? 'ADDING...' : (item.isSoldOut ? 'SOLD OUT' : 'ADD TO CART')}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(item.productId)}
                    style={{
                      padding: '0.4rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    ✕ Remove from Wishlist
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Share With Friend Modal */}
      {isShareModalOpen && (
        <ShareWithFriendModal
          selectedProducts={selectedProductsList}
          shareType="PRODUCTS"
          onClose={() => setIsShareModalOpen(false)}
          onShareSuccess={handleShareSuccess}
        />
      )}
    </div>
  );
}
