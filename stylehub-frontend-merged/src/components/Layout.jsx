import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useFriends } from '../context/FriendsContext';
import { useLanguage } from '../context/LanguageContext';
import Chatbot from './Chatbot';
import SettingsDrawer from './SettingsDrawer';

export default function Layout() {
  const { user, isAuthenticated, logout } = useAuth();
  const { cart } = useCart();
  const { wishlist } = useWishlist();
  const { language, toggleLanguage, t } = useLanguage();
  const {
    incomingRequests,
    notifications,
    unreadNotificationsCount,
    markAsRead,
    markAllAsRead
  } = useFriends();
  const navigate = useNavigate();

  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    setNotifDropdownOpen(false);

    if (notif.type === 'FRIEND_REQUEST' || notif.type === 'FRIEND_ACCEPTED') {
      navigate('/friends');
    } else if (notif.type === 'WISHLIST_SHARED' || notif.type === 'WISHLIST_FEEDBACK') {
      if (notif.relatedId) {
        navigate(`/shared-wishlist/${notif.relatedId}`);
      } else {
        navigate('/wishlist');
      }
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartCount = cart?.totalItems || 0;
  const wishlistCount = wishlist?.totalItems || 0;
  const friendRequestsCount = incomingRequests?.length || 0;

  // Primary navigation (left-center)
  const primaryNavLinks = [
    { path: '/', label: t('home') },
    { path: '/products', label: t('shop') },
    { path: '/products?view=categories', label: t('categories') },
    { path: '/virtual-try-on', label: t('vton') },
  ];

  // Utility actions (right)
  const utilityNavLinks = [
    {
      path: '/wishlist',
      label: t('wishlist'),
      icon: '♡',
      count: wishlistCount,
      ariaLabel: 'Wishlist'
    },
    {
      path: '/cart',
      label: t('cart'),
      icon: '🛒',
      count: cartCount,
      ariaLabel: 'My Cart',
      isCart: true
    },
    {
      path: '/friends',
      label: t('friends'),
      icon: '👥',
      count: friendRequestsCount,
      ariaLabel: 'Friends'
    },
    {
      path: '/purchases',
      label: t('purchases'),
      icon: '📦',
      ariaLabel: 'Purchases'
    },
  ];

  if (user?.role === 'ADMIN') {
    utilityNavLinks.push({
      path: '/admin',
      label: t('adminDashboard'),
      icon: '⚡',
      ariaLabel: 'Admin Dashboard'
    });
  }

  // Close mobile menu on navigate
  const handleMobileNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <header style={{
        backgroundColor: 'rgba(11, 11, 12, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-silver)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4.5rem',
          gap: '1rem'
        }}>
          {/* Brand Logo */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0
            }}
          >
            <span style={{ color: '#FFFFFF' }}>AK'S</span>
            <span className="text-gold-gradient" style={{ fontWeight: 800 }}>MEN STYLE</span>
          </Link>

          {/* Desktop Primary Navigation */}
          {isAuthenticated && (
            <nav
              id="desktop-primary-nav"
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'center',
              }}
              className="hide-mobile"
            >
              {primaryNavLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.06em',
                    padding: '0.4rem 0.2rem',
                    position: 'relative',
                    transition: 'var(--transition-smooth)',
                    borderBottom: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent'
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          {/* Desktop Utility Actions */}
          {isAuthenticated ? (
            <div
              id="desktop-utility-nav"
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'center',
              }}
              className="hide-mobile"
            >
              {/* Utility Nav Links: Wishlist, Cart, Friends, Purchases */}
              {utilityNavLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-label={item.ariaLabel}
                  id={item.isCart ? 'nav-cart-btn' : undefined}
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--accent-gold)' : (item.isCart ? '#FFFFFF' : 'var(--text-secondary)'),
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: item.isCart ? 700 : (isActive ? 700 : 500),
                    letterSpacing: '0.05em',
                    padding: item.isCart ? '0.4rem 0.75rem' : '0.4rem 0.25rem',
                    borderRadius: item.isCart ? 'var(--radius-sm)' : '0',
                    backgroundColor: item.isCart ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
                    border: item.isCart ? (isActive ? '1.5px solid var(--accent-gold)' : '1px solid rgba(212, 175, 55, 0.45)') : 'none',
                    borderBottom: !item.isCart ? (isActive ? '2px solid var(--accent-gold)' : '2px solid transparent') : undefined,
                    boxShadow: item.isCart ? (isActive ? '0 0 14px rgba(212, 175, 55, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.4)') : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'var(--transition-smooth)',
                    cursor: 'pointer'
                  })}
                >
                  <span style={{ fontSize: item.isCart ? '1.1rem' : '0.95rem' }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count > 0 && (
                    <span
                      id={item.isCart ? 'nav-cart-badge' : undefined}
                      className={item.isCart ? 'cart-badge' : undefined}
                      style={!item.isCart ? {
                        backgroundColor: 'var(--accent-gold)',
                        color: '#0B0B0C',
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-full)',
                        lineHeight: 1.2
                      } : undefined}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              ))}

              {/* Notification Bell Dropdown */}
              <div style={{ position: 'relative' }} ref={notifRef}>
                <button
                  type="button"
                  id="notifications-toggle-btn"
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  aria-label="Notifications"
                  style={{
                    position: 'relative',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '1rem',
                    lineHeight: 1
                  }}
                  title="Notifications"
                >
                  🔔
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      minWidth: '16px',
                      textAlign: 'center'
                    }}>
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {notifDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '320px',
                    backgroundColor: '#161920',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                    zIndex: 100,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                        Notifications {unreadNotificationsCount > 0 ? `(${unreadNotificationsCount})` : ''}
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-gold)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            style={{
                              padding: '0.85rem 1rem',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              cursor: 'pointer',
                              backgroundColor: n.isRead ? 'transparent' : 'rgba(212, 163, 89, 0.08)',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>
                                {n.type === 'FRIEND_REQUEST' ? '👋' :
                                 n.type === 'FRIEND_ACCEPTED' ? '🤝' :
                                 n.type === 'WISHLIST_SHARED' ? '🎁' :
                                 n.type === 'WISHLIST_FEEDBACK' ? '💬' : '🔔'}
                              </span>
                              <div style={{ flex: 1 }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: 'var(--font-size-xs)',
                                  color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                                  fontWeight: n.isRead ? 400 : 600,
                                  lineHeight: 1.4
                                }}>
                                  {n.message}
                                </p>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {!n.isRead && (
                                <span style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--accent-gold)',
                                  marginTop: '4px'
                                }} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Multilingual Selector */}
              <button
                type="button"
                id="language-toggle-btn"
                onClick={toggleLanguage}
                title="Switch language: English / தமிழ் / हिंदी"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-silver)',
                  color: 'var(--accent-gold)',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span>🌐</span>
                <span>{language === 'en' ? 'EN' : language === 'ta' ? 'தமிழ்' : 'हिंदी'}</span>
              </button>

              {/* Authenticated Global Settings Button */}
              <button
                type="button"
                id="header-settings-btn"
                onClick={() => setSettingsOpen(true)}
                title="Settings / அமைப்புகள்"
                aria-label="Settings"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-silver)',
                  color: 'var(--accent-gold)',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span>⚙</span>
                <span>{t('settings')}</span>
              </button>

              {/* User Profile Pill */}
              <Link
                to="/profile"
                aria-label={`Profile @${user?.username}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-green)'
                }} />
                <span style={{ fontWeight: 600 }}>@{user?.username}</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ padding: '0.45rem 0.9rem', fontSize: 'var(--font-size-xs)' }}
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <div className="hide-mobile" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                id="language-toggle-btn"
                onClick={toggleLanguage}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-silver)',
                  color: 'var(--accent-gold)',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🌐 {language === 'en' ? 'EN' : language === 'ta' ? 'தமிழ்' : 'हिंदी'}
              </button>
              <Link to="/login" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
                {t('login')}
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                {t('register')}
              </Link>
            </div>
          )}

          {/* Mobile Right Controls: Always Visible Quick Cart + Hamburger */}
          <div className="show-mobile" style={{ alignItems: 'center', gap: '0.65rem' }}>
            {isAuthenticated && (
              <NavLink
                to="/cart"
                id="mobile-quick-cart-btn"
                aria-label="My Cart"
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(212, 175, 55, 0.12)',
                  border: isActive ? '1.5px solid var(--accent-gold)' : '1px solid rgba(212, 175, 55, 0.45)',
                  color: isActive ? 'var(--accent-gold)' : '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700
                })}
              >
                <span style={{ fontSize: '1.1rem' }}>🛒</span>
                <span>{t('cart')}</span>
                {cartCount > 0 && (
                  <span className="cart-badge" id="mobile-cart-badge">
                    {cartCount}
                  </span>
                )}
              </NavLink>
            )}

            {/* Hamburger Toggle Button */}
            <button
              type="button"
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-silver)',
                color: 'var(--accent-gold)',
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '1.25rem',
                cursor: 'pointer',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu-drawer"
            className="show-mobile"
            style={{
              flexDirection: 'column',
              backgroundColor: '#121418',
              borderTop: '1px solid var(--border-silver)',
              borderBottom: '1.5px solid var(--accent-gold)',
              padding: '1.25rem 1.5rem',
              gap: '1rem',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8)',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            {isAuthenticated ? (
              <>
                {/* Primary Mobile Nav */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    Navigation
                  </span>
                  {primaryNavLinks.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={handleMobileNavClick}
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: isActive ? 700 : 500,
                        padding: '0.4rem 0',
                        display: 'block'
                      })}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>

                {/* Utility Mobile Nav */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    Account & Shopping
                  </span>
                  {utilityNavLinks.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={handleMobileNavClick}
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--accent-gold)' : (item.isCart ? '#FFFFFF' : 'var(--text-secondary)'),
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: item.isCart ? 700 : (isActive ? 700 : 500),
                        padding: '0.4rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      })}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                      {item.count > 0 && (
                        <span className={item.isCart ? 'cart-badge' : undefined} style={!item.isCart ? {
                          backgroundColor: 'var(--accent-gold)',
                          color: '#0B0B0C',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)'
                        } : undefined}>
                          {item.count}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>

                {/* Settings, Language, Profile & Logout in Mobile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link
                      to="/profile"
                      onClick={handleMobileNavClick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-green)' }} />
                      <span>@{user?.username}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => { setSettingsOpen(true); setMobileMenuOpen(false); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-gold)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      ⚙ {t('settings')}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-silver)',
                        color: 'var(--accent-gold)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🌐 {language === 'en' ? 'EN' : language === 'ta' ? 'தமிழ்' : 'हिंदी'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                      className="btn btn-outline"
                      style={{ flex: 1, padding: '0.5rem', fontSize: 'var(--font-size-xs)' }}
                    >
                      {t('logout')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link to="/login" onClick={handleMobileNavClick} className="btn btn-outline" style={{ width: '100%' }}>
                  {t('login')}
                </Link>
                <Link to="/register" onClick={handleMobileNavClick} className="btn btn-primary" style={{ width: '100%' }}>
                  {t('register')}
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '3rem 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '2rem 0',
        backgroundColor: 'var(--bg-secondary)',
        textAlign: 'center'
      }}>
        <div className="container">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} AK's MEN STYLE. Premium Men's Fashion & AI Platform.
          </p>
        </div>
      </footer>

      {/* Floating Fashion Assistant Chatbot */}
      <Chatbot />

      {/* Authenticated Global Settings Drawer */}
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
