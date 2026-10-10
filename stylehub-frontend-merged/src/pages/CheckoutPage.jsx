import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { purchaseCartApi } from '../services/api';
import CartRewardTracker from '../components/CartRewardTracker';

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const { cart, clearCart, refreshCart } = useCart();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);

  // Validate user delivery address
  const hasCompleteAddress = Boolean(
    (user?.fullName || user?.full_name) &&
    user?.phone &&
    user?.address &&
    user?.city &&
    user?.state &&
    user?.pincode
  );

  const cartReward = cart?.cartReward;
  const subtotal = cart?.subtotal || 0;
  const finalTotal = cartReward?.finalTotal ?? subtotal;

  const handlePlaceOrder = async () => {
    if (!hasCompleteAddress) {
      setError('Please complete your delivery address in Profile before placing your order.');
      return;
    }

    if (!cart?.items?.length) {
      setError('Your shopping bag is empty.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await purchaseCartApi(token);
      setOrderSuccess(res.purchase);
      if (refreshCart) {
        await refreshCart();
      }
    } catch (err) {
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return (
      <div style={{ maxWidth: '680px', margin: '2rem auto', padding: '1rem' }}>
        <div className="card" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          border: '1.5px solid var(--accent-gold)',
          boxShadow: '0 0 35px rgba(212, 175, 55, 0.2)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✨</div>
          <span className="badge badge-gold" style={{ marginBottom: '1rem' }}>
            ORDER CONFIRMED
          </span>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#FFFFFF' }}>
            Thank You for Your Order
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '2rem' }}>
            Purchase #{orderSuccess.id} has been recorded. Your bespoke garments are being prepared for dispatch.
          </p>

          {/* Delivery & Summary Card */}
          <div style={{
            textAlign: 'left',
            backgroundColor: '#0E0E10',
            padding: '1.5rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            marginBottom: '2rem'
          }}>
            <h4 style={{ color: 'var(--accent-gold)', marginBottom: '0.75rem', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Delivery Destination
            </h4>
            <div style={{ fontSize: 'var(--font-size-sm)', color: '#FFFFFF', lineHeight: 1.6 }}>
              <strong>{orderSuccess.delivery_name}</strong> • {orderSuccess.delivery_phone}<br />
              {orderSuccess.delivery_address}<br />
              {orderSuccess.delivery_city}, {orderSuccess.delivery_state} - {orderSuccess.delivery_pincode}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>
                  Total Paid {orderSuccess.cart_reward_percent > 0 && `(with ${orderSuccess.cart_reward_percent}% Cart Reward)`}
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                  ₹{orderSuccess.total_amount?.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="badge" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                ✓ PAYMENT CONFIRMED
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/purchases" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem' }}>
              View Purchase History
            </Link>
            <Link to="/products" className="btn btn-outline" style={{ padding: '0.85rem 1.75rem' }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '1rem 0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge" style={{ marginBottom: '0.75rem' }}>Final Step</span>
        <h1>Secure Checkout</h1>
        <p>Review your luxury apparel bag and confirm your delivery destination.</p>
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

      {/* Prominent Cart Reward Tracker */}
      <CartRewardTracker subtotal={subtotal} cartReward={cartReward} />

      {!cart?.items?.length ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
          <h2>Your Cart is Empty</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: 'var(--font-size-sm)' }}>
            Add items to your shopping bag to proceed with checkout.
          </p>
          <Link to="/products" className="btn btn-primary">
            Explore Collection
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          alignItems: 'start'
        }}>
          {/* LEFT: Delivery Address + Items Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Delivery Address Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>📍 Delivery Address</h3>
                <Link to="/profile" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-gold)' }}>
                  Edit in Profile →
                </Link>
              </div>

              {hasCompleteAddress ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: '#FFFFFF', lineHeight: 1.6 }}>
                  <strong>{user.fullName || user.full_name}</strong> • {user.phone}<br />
                  {user.address}<br />
                  {user.city}, {user.state} - {user.pincode}
                </div>
              ) : (
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f87171',
                  fontSize: 'var(--font-size-xs)'
                }}>
                  ⚠️ Incomplete delivery profile. Please save your full name, phone, address, city, state, and pincode in Profile before purchasing.
                </div>
              )}
            </div>

            {/* Items in Bag Review */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                Items in Order ({cart.totalItems})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cart.items.map((item) => (
                  <div
                    key={item.cartItemId || `${item.productId}-${item.size || 'default'}`}
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                      paddingBottom: '0.85rem',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: '54px',
                        height: '70px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{item.name}</span>
                        {item.size && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: 'var(--accent-gold)',
                            backgroundColor: 'rgba(217, 119, 6, 0.15)',
                            border: '1px solid rgba(217, 119, 6, 0.35)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '1px 6px'
                          }}>
                            Size: {item.size}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Qty: {item.quantity} × ₹{item.price}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: 'var(--font-size-sm)' }}>
                      ₹{item.lineTotal?.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT: Price Calculation Summary */}
          <div className="card" style={{ padding: '1.75rem', position: 'sticky', top: '6rem' }}>
            <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              Payment Summary
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cart Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Cart-level Buy More Save More Reward */}
            {cartReward?.rewardAmount > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                fontSize: 'var(--font-size-sm)',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Buy More, Save More ({cartReward.percentage}% OFF)
                </span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 800 }}>
                  -₹{cartReward.rewardAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

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
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Final Total</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                ₹{finalTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <button
              type="button"
              id="confirm-checkout-btn"
              onClick={handlePlaceOrder}
              disabled={loading || !hasCompleteAddress}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.95rem',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: (loading || !hasCompleteAddress) ? 'not-allowed' : 'pointer',
                opacity: (loading || !hasCompleteAddress) ? 0.45 : 1
              }}
            >
              {loading ? 'CONFIRMING ORDER...' : 'CONFIRM & PLACE ORDER →'}
            </button>

            <p style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '1rem',
              lineHeight: 1.4
            }}>
              Automated inventory decrement & order confirmation notification.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
