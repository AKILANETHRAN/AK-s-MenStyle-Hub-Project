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

  const navLinks = [
    { path: '/', label: t('home') },
    { path: '/products', label: t('shop') },
    { path: '/products?view=categories', label: t('categories') },
    { path: '/virtual-try-on', label: t('vton') },
    { path: '/wishlist', label: t('wishlist'), count: wishlist?.totalItems || 0 },
    { path: '/friends', label: t('friends'), count: incomingRequests?.length || 0 },
    { path: '/purchases', label: t('purchases') },
    { path: '/profile', label: t('profile') },
  ];

  // Admin Account: Only show ADMIN DASHBOARD if authenticated role is ADMIN
  if (user?.role === 'ADMIN') {
    navLinks.push({ path: '/admin', label: t('adminDashboard') });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <header style={{
        backgroundColor: 'rgba(11, 11, 12, 0.94)',
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
          height: '4.25rem',
        }}>
          <Link to="/" style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span style={{ color: '#FFFFFF' }}>AK'S</span>
            <span className="text-gold-gradient" style={{ fontWeight: 800 }}>MEN STYLE</span>
          </Link>

          {isAuthenticated && (
            <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              {navLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.06em',
                    padding: '0.4rem 0.2rem',
                    position: 'relative',
                    transition: 'var(--transition-smooth)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    borderBottom: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent'
                  })}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span style={{
                      backgroundColor: 'var(--accent-gold)',
                      color: '#0B0B0C',
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      lineHeight: 1.2
                    }}>
                      {item.count}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                {/* Notification Bell Dropdown */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
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
                  title="Switch Language / மொழியை மாற்றவும்"
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
                  <span>{language === 'en' ? 'EN | தமிழ்' : 'தமிழ் | EN'}</span>
                </button>

                {/* Authenticated Global Settings Button */}
                <button
                  type="button"
                  id="header-settings-btn"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings / அமைப்புகள்"
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

                <Link
                  to="/profile"
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
                    border: '1px solid var(--border-color)'
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

                <button
                  onClick={handleLogout}
                  className="btn btn-outline"
                  style={{ padding: '0.45rem 0.9rem', fontSize: 'var(--font-size-xs)' }}
                >
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
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
                  🌐 {language === 'en' ? 'EN | தமிழ்' : 'தமிழ் | EN'}
                </button>
                <Link to="/login" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
                  {t('login')}
                </Link>
                <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                  {t('register')}
                </Link>
              </>
            )}
          </div>
        </div>
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
