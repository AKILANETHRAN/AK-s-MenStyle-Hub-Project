import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProductsApi, fetchRecentlyAccessedApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function HomePage() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [curatedProducts, setCuratedProducts] = useState([]);
  const [recentlyAccessed, setRecentlyAccessed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCurated() {
      try {
        setLoading(true);
        const res = await fetchProductsApi({ limit: 8 });
        const list = Array.isArray(res?.products) ? res.products : (Array.isArray(res) ? res : []);
        setCuratedProducts(list.slice(0, 4));
      } catch (err) {
        console.error('Failed to load curated products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCurated();
  }, []);

  useEffect(() => {
    async function loadRecentlyAccessed() {
      if (!token) return;
      try {
        const data = await fetchRecentlyAccessedApi(token);
        setRecentlyAccessed(data?.products || []);
      } catch (err) {
        console.warn('Could not load recently accessed:', err.message);
      }
    }
    loadRecentlyAccessed();
  }, [token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
      
      {/* ======================================================== */}
      {/* 1. HERO SECTION                                          */}
      {/* ======================================================== */}
      <section style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 70% 30%, rgba(212, 175, 55, 0.16) 0%, rgba(29, 29, 32, 0.95) 55%, #0B0B0C 100%)',
        border: '1px solid var(--border-silver)',
        padding: '5rem 3.5rem',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* Subtle decorative grid lines */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'linear-gradient(rgba(203, 213, 225, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(203, 213, 225, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '720px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <span style={{ height: '1px', width: '28px', backgroundColor: 'var(--accent-gold)' }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent-gold)'
            }}>
              AK'S MEN STYLE
            </span>
          </div>

          <h1 style={{
            fontSize: '3.4rem',
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 1.25rem',
            color: '#FFFFFF'
          }}>
            YOUR STYLE.<br />
            <span className="text-gold-gradient">YOUR FIT.</span><br />
            YOUR CHOICE.
          </h1>

          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
            maxWidth: '580px'
          }}>
            Discover men's fashion, try selected clothing virtually, build complete looks and share your style with friends.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              to="/products"
              className="btn btn-primary"
              style={{ padding: '0.9rem 2rem', fontSize: 'var(--font-size-base)' }}
            >
              EXPLORE COLLECTION
            </Link>

            <Link
              to="/virtual-try-on"
              className="btn btn-secondary"
              style={{
                padding: '0.9rem 1.8rem',
                fontSize: 'var(--font-size-base)',
                border: '1px solid var(--accent-gold)',
                color: 'var(--accent-gold)'
              }}
            >
              <span>✨</span>
              <span>TRY VIRTUAL FITTING</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. FEATURE HINTS (5 CORE CAPABILITIES)                    */}
      {/* ======================================================== */}
      <section>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3rem' }}>
          <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>
            PLATFORM HIGHLIGHTS
          </span>
          <h2 style={{ fontSize: '2.4rem', margin: '0 0 0.5rem', color: '#FFFFFF' }}>
            Advanced Men's Fashion Experience
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Engineered precision from local AI fitting to rule-based outfit curation and peer styling.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* FEATURE 1: AI VIRTUAL TRY-ON */}
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-silver)',
            padding: '2rem'
          }}>
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid var(--border-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                marginBottom: '1.25rem',
                color: 'var(--accent-gold)'
              }}>
                ✨
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                FEATURE 01
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem', color: '#FFFFFF' }}>
                AI VIRTUAL TRY-ON
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Upload your photo and see selected clothing on you using our local AI virtual fitting system.
              </p>
            </div>
            <Link
              to="/virtual-try-on"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                textDecoration: 'none'
              }}
            >
              TRY VIRTUAL FITTING →
            </Link>
          </div>

          {/* FEATURE 2: COMPLETE THE LOOK */}
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-silver)',
            padding: '2rem'
          }}>
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(203, 213, 225, 0.1)',
                border: '1px solid var(--border-silver)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                marginBottom: '1.25rem',
                color: 'var(--accent-silver)'
              }}>
                👔
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-silver)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                FEATURE 02
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem', color: '#FFFFFF' }}>
                COMPLETE THE LOOK
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Discover unique rule-based outfit combinations for selected tops and bottoms.
              </p>
            </div>
            <Link
              to="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                textDecoration: 'none'
              }}
            >
              EXPLORE OUTFITS →
            </Link>
          </div>

          {/* FEATURE 3: STYLE WITH FRIENDS */}
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-silver)',
            padding: '2rem'
          }}>
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid var(--border-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                marginBottom: '1.25rem',
                color: 'var(--accent-gold)'
              }}>
                👥
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                FEATURE 03
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem', color: '#FFFFFF' }}>
                STYLE WITH FRIENDS
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Share products or complete looks with friends and get their reaction and feedback.
              </p>
            </div>
            <Link
              to="/friends"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                textDecoration: 'none'
              }}
            >
              CONNECT WITH FRIENDS →
            </Link>
          </div>

          {/* FEATURE 4: PERSONAL WISHLIST */}
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-silver)',
            padding: '2rem'
          }}>
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(203, 213, 225, 0.1)',
                border: '1px solid var(--border-silver)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                marginBottom: '1.25rem',
                color: 'var(--accent-silver)'
              }}>
                ♡
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-silver)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                FEATURE 04
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem', color: '#FFFFFF' }}>
                PERSONAL WISHLIST
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Save the pieces you love and build your personal collection.
              </p>
            </div>
            <Link
              to="/wishlist"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                textDecoration: 'none'
              }}
            >
              VIEW MY WISHLIST →
            </Link>
          </div>

          {/* FEATURE 5: DIRECT PURCHASE */}
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-silver)',
            padding: '2rem'
          }}>
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid var(--border-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                marginBottom: '1.25rem',
                color: 'var(--accent-gold)'
              }}>
                🛍️
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                FEATURE 05
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem', color: '#FFFFFF' }}>
                DIRECT PURCHASE
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Buy a single piece or a complete look using your saved delivery address.
              </p>
            </div>
            <Link
              to="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                textDecoration: 'none'
              }}
            >
              START SHOPPING →
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. CURATED COLLECTION SHOWCASE                            */}
      {/* ======================================================== */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <span className="badge badge-gold" style={{ marginBottom: '0.5rem' }}>
              CURATED COLLECTION
            </span>
            <h2 style={{ fontSize: '2.2rem', margin: 0, color: '#FFFFFF' }}>
              Selected Pieces
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', margin: '0.25rem 0 0' }}>
              100 precisely priced garments and accessories (₹400–₹700).
            </p>
          </div>

          <Link to="/products" className="btn btn-outline" style={{ fontSize: 'var(--font-size-xs)', padding: '0.6rem 1.25rem' }}>
            VIEW ALL 100 PIECES →
          </Link>
        </div>

        <div className="product-grid">
          {curatedProducts.map((p) => {
            const hasDiscount = p.discount_percent > 0;
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.25rem',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Normal product display photo (NEVER garment_image) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '120%',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: '#121215',
                  marginBottom: '1rem'
                }}>
                  <img
                    src={p.image}
                    alt={p.name}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Offer Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: hasDiscount ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.1)',
                    color: hasDiscount ? '#0B0B0C' : 'var(--text-secondary)'
                  }}>
                    {hasDiscount ? `${p.discount_percent}% OFF` : 'NO OFFER'}
                  </span>

                  {/* Stock Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    color: 'var(--text-secondary)'
                  }}>
                    {p.stock} left
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                  {p.brand}
                </div>

                <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3 }}>
                  <Link to={`/products/${p.id}`} style={{ color: '#FFFFFF', textDecoration: 'none' }}>
                    {p.name}
                  </Link>
                </h4>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: 'auto', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                    ₹{p.price}
                  </span>
                  {p.original_price && p.original_price > p.price && (
                    <span style={{ fontSize: 'var(--font-size-xs)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      ₹{p.original_price}
                    </span>
                  )}
                </div>

                <Link
                  to={`/products/${p.id}`}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
                >
                  VIEW PIECE
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* RECENTLY ACCESSED SECTION (PHASE 10)                     */}
      {/* ======================================================== */}
      <section id="recently-accessed-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-gold" style={{ marginBottom: '0.5rem' }}>
              {t('recentlyAccessed')}
            </span>
            <h2 style={{ fontSize: '2rem', margin: 0, color: '#FFFFFF' }}>
              {t('recentlyAccessedSubtitle')}
            </h2>
          </div>
        </div>

        {recentlyAccessed.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.5rem'
          }}>
            {recentlyAccessed.slice(0, 8).map((p) => {
              const discount = p.discountPercent || p.discount_percent || 0;
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--border-silver)',
                    padding: '1rem',
                    position: 'relative'
                  }}
                >
                  {discount > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '1.5rem',
                      right: '1.5rem',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#0B0B0C',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      zIndex: 2
                    }}>
                      {discount}% OFF
                    </div>
                  )}

                  <Link to={`/products/${p.id}`} style={{ display: 'block', overflow: 'hidden', borderRadius: 'var(--radius-sm)', marginBottom: '0.85rem' }}>
                    <img
                      src={p.image}
                      alt={p.name}
                      style={{
                        width: '100%',
                        height: '240px',
                        objectFit: 'cover',
                        backgroundColor: '#18181A',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  </Link>

                  <div style={{ fontSize: '10px', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                    {p.brand}
                  </div>

                  <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3 }}>
                    <Link to={`/products/${p.id}`} style={{ color: '#FFFFFF', textDecoration: 'none' }}>
                      {p.name}
                    </Link>
                  </h4>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: 'auto', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                      ₹{p.price}
                    </span>
                    {(p.originalPrice || p.original_price) && (p.originalPrice || p.original_price) > p.price && (
                      <span style={{ fontSize: 'var(--font-size-xs)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                        ₹{p.originalPrice || p.original_price}
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/products/${p.id}`}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
                  >
                    {t('viewPiece')}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '2.5rem',
            textAlign: 'center',
            backgroundColor: '#141416',
            border: '1px dashed var(--border-silver)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)'
          }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>👁️</span>
            {t('recentlyAccessedEmpty')}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 4. VIRTUAL FITTING HIGHLIGHT                              */}
      {/* ======================================================== */}
      <section style={{
        padding: '3.5rem',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(29, 29, 32, 0.95) 0%, rgba(21, 21, 23, 0.8) 100%)',
        border: '1px solid var(--border-gold)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '3rem',
        alignItems: 'center',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <span className="badge badge-gold" style={{ marginBottom: '1rem' }}>
            NEURAL TRY-ON STUDIO
          </span>
          <h2 style={{ fontSize: '2.5rem', color: '#FFFFFF', margin: '0 0 1rem' }}>
            Virtual Fitting on Your Own Photo
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem', fontSize: 'var(--font-size-sm)' }}>
            Experience our local FASHN neural diffusion pipeline running on dedicated NVIDIA RTX hardware. Upload your front-facing portrait and instantly visualize how curated tops and bottoms fit on you with authentic drape, fold texture and seam geometry.
          </p>
          <Link to="/virtual-try-on" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem' }}>
            LAUNCH VIRTUAL STUDIO →
          </Link>
        </div>

        <div style={{
          backgroundColor: '#111215',
          border: '1px solid var(--border-silver)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📸</span>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 'var(--font-size-sm)' }}>User Portrait</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>High-resolution front-facing human input</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontSize: '1.25rem' }}>↓</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✨</span>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 'var(--font-size-sm)' }}>Isolated Garment Asset</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pure studio garment without hanger or body</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontSize: '1.25rem' }}>↓</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: 'var(--font-size-sm)' }}>FASHN v1.5 Diffusion Engine</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CUDA hardware inference with realistic warp & shadow</div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. STYLE WITH FRIENDS HIGHLIGHT                          */}
      {/* ======================================================== */}
      <section style={{
        padding: '3rem',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: '#151517',
        border: '1px solid var(--border-silver)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span className="badge badge-gold" style={{ marginBottom: '1rem' }}>
            PRIVATE SOCIAL CIRCLE
          </span>
          <h2 style={{ fontSize: '2.2rem', color: '#FFFFFF', margin: '0 0 1rem' }}>
            Style Opinions & Look Sharing
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem', fontSize: 'var(--font-size-sm)' }}>
            Connect with friends via <strong style={{ color: 'var(--accent-gold)' }}>@username</strong>. Share wishlist pieces or complete 4-piece outfit combinations privately. Exchange instant reactions (LIKE, LOVE, FIRE) and candid style feedback.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/friends" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
              FIND & ADD FRIENDS
            </Link>
            <Link to="/wishlist" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
              SHARE FROM WISHLIST
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
