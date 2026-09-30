import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchPurchasesApi, fetchNotificationHistoryApi } from '../services/api';

export default function PurchasesPage() {
  const { token } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPurchases() {
      if (!token) return;
      try {
        setLoading(true);
        setError('');
        const [res, notifRes] = await Promise.allSettled([
          fetchPurchasesApi(token),
          fetchNotificationHistoryApi(token)
        ]);
        if (res.status === 'fulfilled' && res.value?.status === 'success') {
          setPurchases(res.value.purchases || []);
        }
        if (notifRes.status === 'fulfilled' && notifRes.value?.status === 'success') {
          setDeliveries(notifRes.value.deliveries || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load purchase history.');
      } finally {
        setLoading(false);
      }
    }

    loadPurchases();
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
        Loading purchase history...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge" style={{ marginBottom: '0.75rem' }}>Account History</span>
        <h1>Purchase History</h1>
        <p>A simple overview of your confirmed purchases and saved delivery destination snapshots.</p>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#f87171',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          fontSize: 'var(--font-size-sm)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Purchases Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: 'var(--font-size-sm)' }}>
            You haven't made any purchases yet. Select individual garments or complete outfit combos to purchase instantly!
          </p>
          <Link to="/products" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            Explore AK's MEN STYLE Catalog
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {purchases.map((purchase) => (
            <div key={purchase.id} className="card" style={{ padding: '1.75rem' }}>
              
              {/* Purchase Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      Purchase #{purchase.id}
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: purchase.purchase_type === 'COMBO' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: purchase.purchase_type === 'COMBO' ? 'var(--accent-gold)' : '#60a5fa',
                        border: `1px solid ${purchase.purchase_type === 'COMBO' ? 'var(--accent-gold)' : '#3b82f6'}`
                      }}
                    >
                      {purchase.purchase_type === 'COMBO' ? '✨ COMPLETE OUTFIT COMBO' : 'SINGLE PRODUCT'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Purchased on {new Date(purchase.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Total Amount</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                    ₹{purchase.total_amount}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {purchase.purchase_type === 'COMBO' ? 'Purchased Outfit Pieces' : 'Purchased Product'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {purchase.items?.map((item) => (
                    <div
                      key={item.id || item.product_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          style={{
                            width: '52px',
                            height: '52px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#12151b'
                          }}
                        />
                        <div>
                          <Link
                            to={`/products/${item.product_id}`}
                            style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none', fontSize: 'var(--font-size-sm)' }}
                          >
                            {item.product_name}
                          </Link>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            Qty: {item.quantity} × ₹{item.unit_price}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                        ₹{item.quantity * item.unit_price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Owner & Address Snapshot */}
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                      DELIVERY OWNER
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      {purchase.delivery_name}
                    </span>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {purchase.delivery_phone}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                      DELIVERY ADDRESS SNAPSHOT
                    </span>
                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {purchase.delivery_address}<br />
                      {purchase.delivery_city}, {purchase.delivery_state} - {purchase.delivery_pincode}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✓</span>
                  <span>Delivery destination confirmed to owner. Your selected product/combo will be delivered to the owner at the saved address.</span>
                </div>
              </div>

              {/* Notification Deliveries Summary for this Purchase */}
              {(() => {
                const purDeliveries = deliveries.filter(d => d.purchase_id === purchase.id);
                if (purDeliveries.length === 0) return null;

                return (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(212, 175, 55, 0.04)',
                    border: '1px solid rgba(212, 175, 55, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '0.06em' }}>
                      NOTIFICATIONS:
                    </span>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {purDeliveries.map(d => (
                        <span
                          key={d.id}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: d.status === 'SENT' ? 'rgba(16, 185, 129, 0.15)' :
                                            d.status === 'DISABLED' ? 'rgba(255, 255, 255, 0.05)' :
                                            d.status === 'FAILED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: d.status === 'SENT' ? 'var(--accent-green)' :
                                   d.status === 'DISABLED' ? 'var(--text-muted)' :
                                   d.status === 'FAILED' ? 'var(--accent-red)' : 'var(--text-secondary)',
                            border: `1px solid ${d.status === 'SENT' ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`
                          }}
                        >
                          {d.channel === 'EMAIL' ? '✉️ Email' : d.channel === 'SMS' ? '📱 SMS' : '💬 WhatsApp'}: {
                            d.status === 'SENT' ? 'Sent' :
                            d.status === 'DISABLED' ? 'Disabled' :
                            d.status === 'NOT_CONFIGURED' ? 'Not Configured' : d.status
                          }
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
