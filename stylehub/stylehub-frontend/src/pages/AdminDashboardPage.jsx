import React, { useState, useEffect } from 'react';
import {
  fetchAdminMetricsApi,
  fetchAdminProductsApi,
  updateAdminProductApi,
  fetchAdminUsersApi,
  fetchAdminPurchasesApi,
  fetchAdminVtonStatsApi,
  fetchAdminRecentActivityApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin Data State
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [vtonStats, setVtonStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);

  // Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const loadDashboardData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');

      const [mRes, pRes, uRes, purRes, vRes, actRes] = await Promise.all([
        fetchAdminMetricsApi(token),
        fetchAdminProductsApi(token),
        fetchAdminUsersApi(token),
        fetchAdminPurchasesApi(token),
        fetchAdminVtonStatsApi(token),
        fetchAdminRecentActivityApi(token)
      ]);

      setMetrics(mRes?.metrics || null);
      setProducts(pRes?.products || []);
      setUsers(uRes?.users || []);
      setPurchases(purRes?.purchases || []);
      setVtonStats(vRes?.vtonStats || null);
      setRecentActivity(actRes?.activity || null);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setError(err.message || 'Failed to load administrator records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [token]);

  const handleEditClick = (p) => {
    setEditingProduct(p);
    setEditPrice(p.price);
    setEditDiscount(p.discountPercent);
    setEditStock(p.stock);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    setEditError('');
    setEditSuccess('');

    try {
      const res = await updateAdminProductApi(token, editingProduct.id, {
        price: Number(editPrice),
        discountPercent: Number(editDiscount),
        stock: parseInt(editStock, 10)
      });

      setEditSuccess('Product parameters updated successfully.');
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...res.product } : p));
      setTimeout(() => {
        setEditingProduct(null);
        setEditSuccess('');
      }, 1200);
    } catch (err) {
      setEditError(err.message || 'Failed to update product parameters.');
    } finally {
      setSavingProduct(false);
    }
  };

  const tabs = [
    { key: 'OVERVIEW', label: 'OVERVIEW' },
    { key: 'PRODUCTS', label: 'PRODUCTS', count: products.length },
    { key: 'USERS', label: 'USERS', count: users.length },
    { key: 'PURCHASES', label: 'PURCHASES', count: purchases.length },
    { key: 'VTON', label: 'VTON USAGE' },
    { key: 'ACTIVITY', label: 'RECENT ACTIVITY' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* Admin Header Banner */}
      <section style={{
        backgroundColor: '#141416',
        border: '1.5px solid var(--border-gold)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 3rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid var(--border-gold)',
            borderRadius: 'var(--radius-full)',
            marginBottom: '0.75rem'
          }}>
            <span style={{ fontSize: '0.75rem' }}>⚡</span>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--accent-gold)' }}>
              EXECUTIVE CONSOLE
            </span>
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 0.4rem', color: '#FFFFFF' }}>
            AK'S MEN STYLE <span className="text-gold-gradient">ADMIN DASHBOARD</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            Unified real-time management for catalog assets, user identities, direct purchases, and local AI fitting operations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadDashboardData}
            className="btn btn-secondary"
            style={{ padding: '0.65rem 1.25rem', fontSize: 'var(--font-size-xs)' }}
          >
            ↻ REFRESH DATA
          </button>
          <div style={{
            backgroundColor: '#1E1E22',
            border: '1px solid var(--border-silver)',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--accent-silver)'
          }}>
            Operator: <strong style={{ color: '#FFFFFF' }}>@{user?.username || 'admin'}</strong>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-silver)',
        paddingBottom: '0.5rem',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              id={`admin-tab-${tab.key.toLowerCase()}`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                backgroundColor: isActive ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.04)',
                color: isActive ? '#0B0B0C' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: 'var(--font-size-xs)',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  backgroundColor: isActive ? '#0B0B0C' : 'rgba(255, 255, 255, 0.1)',
                  color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)',
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && !metrics ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{
            display: 'inline-block',
            width: '2.5rem',
            height: '2.5rem',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-gold)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem'
          }} />
          <div>Synchronizing real-time SQLite database metrics...</div>
        </div>
      ) : null}

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW METRICS                                  */}
      {/* ======================================================== */}
      {activeTab === 'OVERVIEW' && metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Key Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem'
          }}>
            {[
              { label: 'TOTAL USERS', value: metrics.totalUsers, icon: '👥', color: 'var(--accent-silver)' },
              { label: 'TOTAL PRODUCTS', value: metrics.totalProducts, icon: '👔', color: 'var(--accent-gold)' },
              { label: 'TOTAL PURCHASES', value: metrics.totalPurchases, icon: '🛍️', color: 'var(--accent-gold)' },
              { label: 'TOTAL REVENUE', value: `₹${metrics.totalRevenue.toLocaleString()}`, icon: '💰', color: '#10B981' },
              { label: 'WISHLIST ITEMS', value: metrics.totalWishlistItems, icon: '❤️', color: '#F43F5E' },
              { label: 'FRIEND CONNECTIONS', value: metrics.totalFriendConnections, icon: '🤝', color: 'var(--accent-silver)' },
              { label: 'VTON RESULTS', value: metrics.totalVtonResults, icon: '✨', color: 'var(--accent-gold)' },
              { label: 'RECENT VIEWS TRACKED', value: metrics.totalRecentlyAccessed, icon: '👁️', color: 'var(--accent-silver)' }
            ].map((m, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#151518',
                  border: '1px solid var(--border-silver)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-subtle)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: '1.25rem' }}>{m.icon}</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Subsystems Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            <div style={{
              backgroundColor: '#151518',
              border: '1px solid var(--border-silver)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', color: '#FFFFFF' }}>
                Catalog Architecture
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Audited Garments (VTON 1–50)</span>
                  <strong style={{ color: 'var(--accent-gold)' }}>50 Garments (100% Studio)</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Accessories (51–100)</span>
                  <strong style={{ color: 'var(--accent-silver)' }}>50 Accs (VTON Excluded)</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Price Range Constraint</span>
                  <strong style={{ color: '#FFFFFF' }}>₹400–₹700 Inclusive</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discounts Applied</span>
                  <strong style={{ color: '#FFFFFF' }}>0%, 20%, 30%, 40%</strong>
                </li>
              </ul>
            </div>

            <div style={{
              backgroundColor: '#151518',
              border: '1px solid var(--border-silver)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', color: '#FFFFFF' }}>
                AI VTON Engine Status
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pipeline Architecture</span>
                  <strong style={{ color: 'var(--accent-gold)' }}>FASHN v1.5 Diffusion</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hardware Acceleration</span>
                  <strong style={{ color: '#10B981' }}>NVIDIA RTX 2050 (CUDA)</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Completed Try-Ons</span>
                  <strong style={{ color: '#FFFFFF' }}>{vtonStats?.successCount || 0} Successful</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Local Service Port</span>
                  <strong style={{ color: '#FFFFFF' }}>127.0.0.1:7860</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PRODUCTS MANAGEMENT                               */}
      {/* ======================================================== */}
      {activeTab === 'PRODUCTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0 }}>
              Master Product Catalog (100 Pieces)
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Click any item to adjust price, offer percentage, or stock levels safely.
            </div>
          </div>

          <div style={{
            backgroundColor: '#151518',
            border: '1px solid var(--border-silver)',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1C1C20', borderBottom: '1px solid var(--border-silver)' }}>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>ID</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>IMAGE</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>NAME</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>CATEGORY</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>PRICE</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>OFFER</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>STOCK</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>VTON</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--accent-gold)' }}>#{p.id}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <img src={p.image} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#FFFFFF', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{p.category}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--accent-gold)', fontWeight: 700 }}>₹{p.price}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {p.discountPercent > 0 ? (
                        <span style={{ color: '#10B981', fontWeight: 700 }}>{p.discountPercent}% OFF</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0%</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: p.stock > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: p.stock > 0 ? '#10B981' : '#EF4444'
                      }}>
                        {p.stock} units
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {p.vtonSupported ? (
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>✓ Studio ({p.vtonCategory})</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>— Acc</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        type="button"
                        onClick={() => handleEditClick(p)}
                        style={{
                          backgroundColor: 'rgba(212, 175, 55, 0.1)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--accent-gold)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        EDIT
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Edit Modal */}
      {editingProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#151518',
            border: '1.5px solid var(--border-gold)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#FFFFFF' }}>
                Edit Product #{editingProduct.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Adjust price, verified discount and stock inventory safely without affecting garment imagery.
            </p>

            {editError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', marginBottom: '1rem' }}>
                ⚠️ {editError}
              </div>
            )}
            {editSuccess && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', marginBottom: '1rem' }}>
                ✓ {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--accent-silver)', marginBottom: '0.4rem' }}>
                  PRICE (₹400–₹700)
                </label>
                <input
                  type="number"
                  min="400"
                  max="700"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0D0D0E', border: '1px solid var(--border-silver)', color: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--accent-silver)', marginBottom: '0.4rem' }}>
                  DISCOUNT PERCENTAGE
                </label>
                <select
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value))}
                  style={{ width: '100%', backgroundColor: '#0D0D0E', border: '1px solid var(--border-silver)', color: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value={0}>0% (NO OFFER)</option>
                  <option value={20}>20%</option>
                  <option value={30}>30%</option>
                  <option value={40}>40%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--accent-silver)', marginBottom: '0.4rem' }}>
                  STOCK INVENTORY (UNITS)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0D0D0E', border: '1px solid var(--border-silver)', color: '#FFFFFF', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  {savingProduct ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 1.25rem' }}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: USERS DIRECTORY                                   */}
      {/* ======================================================== */}
      {activeTab === 'USERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0 }}>
              Registered Customer Accounts ({users.length})
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Passphrase hashes and credentials strictly suppressed from administrator views.
            </div>
          </div>

          <div style={{
            backgroundColor: '#151518',
            border: '1px solid var(--border-silver)',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1C1C20', borderBottom: '1px solid var(--border-silver)' }}>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>ID</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>USERNAME</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>FULL NAME</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>EMAIL</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>ROLE</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>LOCATION</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--accent-silver)' }}>JOINED</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--accent-gold)' }}>#{u.id}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#FFFFFF', fontWeight: 600 }}>@{u.username}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)' }}>{u.fullName}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '9px',
                        fontWeight: 800,
                        backgroundColor: u.role === 'ADMIN' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: u.role === 'ADMIN' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        border: u.role === 'ADMIN' ? '1px solid var(--border-gold)' : 'none'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                      {u.city ? `${u.city}, ${u.state || ''}` : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PURCHASES OVERVIEW                                */}
      {/* ======================================================== */}
      {activeTab === 'PURCHASES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0 }}>
              Customer Purchases & Transactions ({purchases.length})
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Direct single purchases and complete coordinated outfit combos.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {purchases.map((pur) => (
              <div
                key={pur.id}
                style={{
                  backgroundColor: '#151518',
                  border: '1px solid var(--border-silver)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                      ORDER #{pur.id}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '9px',
                      fontWeight: 800,
                      backgroundColor: pur.purchaseType === 'COMBO' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: pur.purchaseType === 'COMBO' ? 'var(--accent-gold)' : 'var(--text-secondary)'
                    }}>
                      {pur.purchaseType === 'COMBO' ? '✨ COMPLETE LOOK COMBO' : 'DIRECT SINGLE PIECE'}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                      Buyer: <strong style={{ color: '#FFFFFF' }}>@{pur.ownerUsername}</strong> ({pur.deliveryName})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {new Date(pur.purchaseDate).toLocaleString()}
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                      ₹{pur.totalAmount}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {pur.items?.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        backgroundColor: '#1A1A1E',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem'
                      }}
                    >
                      <img
                        src={it.productImage}
                        alt={it.productName}
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.productName}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Qty: 1 × ₹{it.unitPrice}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: VTON USAGE ANALYTICS                              */}
      {/* ======================================================== */}
      {activeTab === 'VTON' && vtonStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0 }}>
            Local Neural AI Virtual Try-On Studio Telemetry
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem'
          }}>
            <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                TOTAL TRY-ON RUNS
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {vtonStats.totalResults}
              </div>
            </div>

            <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                TOPS FITTINGS (IDs 1–20, 31–50)
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                {vtonStats.topCount}
              </div>
            </div>

            <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                BOTTOMS FITTINGS (IDs 21–30)
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                {vtonStats.bottomCount}
              </div>
            </div>

            <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                SUCCESSFUL INFERENCES
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10B981' }}>
                {vtonStats.successCount}
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#151518',
            border: '1px solid var(--border-silver)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', color: '#FFFFFF' }}>
              Privacy & Local Processing Compliance
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', lineHeight: 1.7, margin: 0 }}>
              All neural inference execution runs strictly on local NVIDIA RTX hardware (port 7860) with zero transmission to cloud AI services. User portrait photos are isolated and never exposed in public or administrator telemetry.
            </p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: RECENT ACTIVITY                                   */}
      {/* ======================================================== */}
      {activeTab === 'ACTIVITY' && recentActivity && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
          {/* Recent Purchases */}
          <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.25rem', color: '#FFFFFF' }}>
              Recent Transactions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentActivity.recentPurchases?.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>@{p.username}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>bought #{p.id}</span>
                  </div>
                  <strong style={{ color: 'var(--accent-gold)' }}>₹{p.total_amount}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Social Shares */}
          <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.25rem', color: '#FFFFFF' }}>
              Recent Peer Shares
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentActivity.recentShares?.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ color: 'var(--accent-gold)' }}>@{s.sender}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 0.35rem' }}>shared {s.share_type} with</span>
                    <span style={{ color: '#FFFFFF' }}>@{s.receiver}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Registrations */}
          <div style={{ backgroundColor: '#151518', border: '1px solid var(--border-silver)', borderRadius: 'var(--radius-md)', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.25rem', color: '#FFFFFF' }}>
              Recent Registrations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentActivity.recentUsers?.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>@{u.username}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>({u.full_name})</span>
                  </div>
                  <span style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '9px',
                    fontWeight: 700,
                    backgroundColor: u.role === 'ADMIN' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)',
                    color: u.role === 'ADMIN' ? 'var(--accent-gold)' : 'var(--text-muted)'
                  }}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
