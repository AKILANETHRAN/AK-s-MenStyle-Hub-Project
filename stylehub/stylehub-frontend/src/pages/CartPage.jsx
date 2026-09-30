import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function CartPage() {
  const { cart, loading, error, updateQuantity, removeItem, clearCart, hasOutOfStockItems } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleQuantityChange = async (productId, currentQty, delta, stock) => {
    const targetQty = currentQty + delta;
    if (targetQty < 1 || targetQty > stock || actionLoading) return;

    setActionLoading(true);
    try {
      await updateQuantity(productId, targetQty);
    } catch (err) {
      alert(err.message || 'Failed to update quantity.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await removeItem(productId);
    } catch (err) {
      alert(err.message || 'Failed to remove item.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await clearCart();
      setConfirmClear(false);
    } catch (err) {
      alert(err.message || 'Failed to clear cart.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToWishlist = async (productId) => {
    try {
      if (!isInWishlist(productId)) {
        await toggleWishlist(productId);
      }
      await removeItem(productId);
    } catch (err) {
      alert(err.message || 'Failed to move item to wishlist.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="badge" style={{ marginBottom: '0.75rem' }}>Shopping Bag</span>
          <h1>AK's MEN STYLE Cart</h1>
          <p>Review and manage your selected luxury men's apparel & accessories.</p>
        </div>
        {cart.items.length > 0 && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setConfirmClear(true)}
            style={{ fontSize: 'var(--font-size-xs)', padding: '0.5rem 1rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            Clear Cart
          </button>
        )}
      </div>

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

      {/* Confirmation Modal / Banner for Clear Cart */}
      {confirmClear && (
        <div className="card" style={{
          padding: '1.25rem',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ color: '#f87171' }}>Clear entire shopping cart?</strong>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              All items in your current bag will be removed.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmClear(false)}
              style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--font-size-xs)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleClear}
              disabled={actionLoading}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none'
              }}
            >
              {actionLoading ? 'Clearing...' : 'Yes, Clear All'}
            </button>
          </div>
        </div>
      )}

      {loading && cart.items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          Loading your cart from database...
        </div>
      ) : cart.items.length === 0 ? (
        /* Empty Cart State */
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '560px', margin: '2rem auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--accent-gold)' }}>🛍️</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Your Cart is Currently Empty</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1.75rem' }}>
            Explore our curated 100-piece men's collection of shirts, tees, trousers, jackets, and accessories.
          </p>
          <Link to="/products" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
            Explore AK's MEN STYLE Collection
          </Link>
        </div>
      ) : (
        /* Cart Layout: Items List + Order Summary */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          
          {/* Items Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {hasOutOfStockItems && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600
              }}>
                ⚠️ Some items in your bag have stock limitations. Please adjust quantities before proceeding.
              </div>
            )}

            {cart.items.map((item) => {
              const itemOutOfStock = item.isOutOfStock || item.stock === 0;
              const hasInsufficientStock = item.insufficientStock;

              return (
                <div
                  key={item.productId}
                  className="card"
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    padding: '1.25rem',
                    border: itemOutOfStock ? '1px solid #ef4444' : (hasInsufficientStock ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)'),
                    position: 'relative'
                  }}
                >
                  {/* Thumbnail: Strictly Normal E-Commerce Display Photo */}
                  <Link
                    to={`/products/${item.productId}`}
                    style={{
                      width: '100px',
                      height: '125px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      backgroundColor: '#12151b',
                      flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {itemOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f87171',
                        fontSize: '10px',
                        fontWeight: 700,
                        textAlign: 'center',
                        padding: '4px'
                      }}>
                        OUT OF STOCK
                      </div>
                    )}
                  </Link>

                  {/* Item Details */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 600 }}>
                          {item.brand}
                        </span>
                        <h4 style={{ margin: '0.15rem 0 0.35rem', fontSize: 'var(--font-size-base)' }}>
                          <Link to={`/products/${item.productId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                            {item.name}
                          </Link>
                        </h4>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          {item.clothType} • {item.color}
                        </span>
                      </div>

                      {/* Line Total */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{item.lineTotal}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ₹{item.price} each
                        </div>
                      </div>
                    </div>

                    {/* Stock Warnings */}
                    {itemOutOfStock ? (
                      <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 700, marginTop: '0.5rem' }}>
                        ⚠️ This product is now Sold Out.
                      </span>
                    ) : hasInsufficientStock ? (
                      <span style={{ color: 'var(--accent-gold)', fontSize: '11px', fontWeight: 700, marginTop: '0.5rem' }}>
                        ⚠️ Only {item.stock} available now. Please reduce quantity.
                      </span>
                    ) : null}

                    {/* Bottom Controls */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 'auto',
                      paddingTop: '0.75rem'
                    }}>
                      {/* Quantity Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.productId, item.quantity, -1, item.stock)}
                          disabled={item.quantity <= 1 || actionLoading}
                          style={{
                            padding: '0.25rem 0.65rem',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          -
                        </button>
                        <span style={{ padding: '0.25rem 0.65rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.productId, item.quantity, 1, item.stock)}
                          disabled={item.quantity >= item.stock || actionLoading}
                          style={{
                            padding: '0.25rem 0.65rem',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: item.quantity >= item.stock ? 'not-allowed' : 'pointer'
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Actions: Move to Wishlist & Remove */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveToWishlist(item.productId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Move to Wishlist
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.productId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary Column */}
          <div className="card" style={{ padding: '1.75rem', position: 'sticky', top: '6rem' }}>
            <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              Order Summary
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Items</span>
              <span style={{ fontWeight: 600 }}>{cart.totalItems}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{cart.subtotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>FREE (Complimentary)</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
              marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Total Amount</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                ₹{cart.subtotal}
              </span>
            </div>

            <Link
              to="/checkout"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.04em',
                pointerEvents: hasOutOfStockItems ? 'none' : 'auto',
                opacity: hasOutOfStockItems ? 0.4 : 1,
                cursor: hasOutOfStockItems ? 'not-allowed' : 'pointer'
              }}
            >
              {hasOutOfStockItems ? 'RESOLVE STOCK WARNINGS' : 'PROCEED TO CHECKOUT →'}
            </Link>

            <p style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '1rem',
              lineHeight: 1.4
            }}>
              Secure 256-bit SSL encrypted checkout. AK's MEN STYLE Guarantee.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
