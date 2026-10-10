import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFriends } from '../context/FriendsContext';
import { useAuth } from '../context/AuthContext';
import { fetchWishlistSharesApi } from '../services/wishlistShareService';

export default function FriendsPage() {
  const { user, token } = useAuth();
  const {
    friends = [],
    incomingRequests = [],
    outgoingRequests = [],
    loading,
    error,
    refreshFriends,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend
  } = useFriends();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: 'success' });

  // Shared Looks state
  const [sharedLooks, setSharedLooks] = useState({ sharedWithMe: [], sharedByMe: [] });
  const [loadingShares, setLoadingShares] = useState(false);
  const [activeSharesTab, setActiveSharesTab] = useState('received'); // 'received' | 'sent'

  const searchInputRef = useRef(null);

  // Safe array references
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeIncoming = Array.isArray(incomingRequests) ? incomingRequests : [];
  const safeOutgoing = Array.isArray(outgoingRequests) ? outgoingRequests : [];
  const safeSearchResults = Array.isArray(searchResults) ? searchResults : [];
  const safeSharedWithMe = Array.isArray(sharedLooks?.sharedWithMe) ? sharedLooks.sharedWithMe : [];
  const safeSharedByMe = Array.isArray(sharedLooks?.sharedByMe) ? sharedLooks.sharedByMe : [];

  const showMessage = (text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: 'success' }), 4500);
  };

  const loadSharedLooks = async () => {
    if (!token) return;
    try {
      setLoadingShares(true);
      const res = await fetchWishlistSharesApi(token);
      setSharedLooks(res.data || { sharedWithMe: [], sharedByMe: [] });
    } catch (e) {
      console.error('Failed to load shared looks', e);
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    loadSharedLooks();
  }, [token]);

  // Execute User Search
  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanQuery = searchQuery.trim().replace(/^@/, '');
    if (!cleanQuery) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      setHasSearched(true);
      const results = await searchUsers(cleanQuery);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError(err.message || 'Could not complete user search. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Live search when typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError('');
      return;
    }

    const timer = setTimeout(() => {
      const clean = searchQuery.trim().replace(/^@/, '');
      if (clean.length >= 2) {
        handleSearch();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Send Friend Request
  const handleSendRequest = async (targetUser) => {
    setActionLoadingId(`send-${targetUser.id}`);
    try {
      await sendRequest(targetUser.id);
      showMessage(`Friend request sent to @${targetUser.username}!`);
      setSearchResults(prev =>
        (Array.isArray(prev) ? prev : []).map(u =>
          u.id === targetUser.id ? { ...u, relationship: 'PENDING_SENT' } : u
        )
      );
    } catch (err) {
      showMessage(err.message || 'Could not send friend request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept Friend Request
  const handleAccept = async (req) => {
    setActionLoadingId(`accept-${req.friendshipId}`);
    try {
      await acceptRequest(req.friendshipId);
      showMessage(`You are now friends with @${req.username}!`);
      setSearchResults(prev =>
        (Array.isArray(prev) ? prev : []).map(u =>
          u.id === req.userId ? { ...u, relationship: 'ACCEPTED' } : u
        )
      );
    } catch (err) {
      showMessage(err.message || 'Failed to accept friend request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Friend Request
  const handleReject = async (req) => {
    setActionLoadingId(`reject-${req.friendshipId}`);
    try {
      await rejectRequest(req.friendshipId);
      showMessage(`Declined friend request from @${req.username}`);
    } catch (err) {
      showMessage(err.message || 'Failed to decline friend request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove Friend
  const handleRemove = async (friend) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove @${friend.username} from your friends? Future private outfit looks and shared wishlists will be inaccessible.`
    );
    if (!confirmed) return;

    const targetId = friend.friendshipId || friend.id || friend.userId;
    setActionLoadingId(`remove-${targetId}`);
    try {
      await removeFriend(targetId);
      showMessage(`Removed @${friend.username} from your friends.`);
      setSearchResults(prev =>
        (Array.isArray(prev) ? prev : []).map(u =>
          (u.id === friend.userId || u.id === friend.id) ? { ...u, relationship: 'NONE' } : u
        )
      );
    } catch (err) {
      showMessage(err.message || 'Failed to remove friend', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const focusSearchInput = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Luxury Theme Palette Tokens (Black + Charcoal + Gold + Silver)
  const theme = {
    creamBg: '#151517',
    creamCard: '#1D1D20',
    creamCardSubtle: '#242429',
    gold: '#D4AF37',
    goldLight: 'rgba(212, 175, 55, 0.15)',
    goldBorder: 'rgba(212, 175, 55, 0.45)',
    silverBorder: 'rgba(203, 213, 225, 0.16)',
    silverSubtle: 'rgba(203, 213, 225, 0.08)',
    textDark: '#FFFFFF',
    textMuted: '#94A3B8',
    textSecondary: '#CBD5E1',
    serifFont: "'Playfair Display', Georgia, 'Times New Roman', serif",
    sansFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  return (
    <div style={{
      backgroundColor: theme.creamBg,
      borderRadius: '16px',
      padding: '2.5rem 2rem',
      color: theme.textDark,
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
      border: `1px solid ${theme.silverBorder}`,
      maxWidth: '1100px',
      margin: '0 auto',
      fontFamily: theme.sansFont
    }}>
      {/* 1. HERO SECTION */}
      <div style={{
        marginBottom: '2.75rem',
        borderBottom: `1px solid ${theme.silverBorder}`,
        paddingBottom: '2rem'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.25rem 0.85rem',
          backgroundColor: theme.goldLight,
          border: `1px solid ${theme.goldBorder}`,
          borderRadius: '9999px',
          color: '#8b6f48',
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '0.85rem'
        }}>
          FRIENDS & CIRCLE
        </div>
        <h1 style={{
          fontFamily: theme.serifFont,
          fontSize: '2.5rem',
          fontWeight: 600,
          color: theme.textDark,
          margin: '0 0 0.65rem',
          letterSpacing: '-0.02em',
          lineHeight: 1.2
        }}>
          Style is better shared.
        </h1>
        <p style={{
          color: theme.textSecondary,
          fontSize: '1.05rem',
          maxWidth: '680px',
          lineHeight: 1.6,
          margin: 0
        }}>
          Find friends, share your favorite pieces, and get their opinion before you buy.
        </p>
      </div>

      {/* FEEDBACK ALERT */}
      {feedbackMsg.text && (
        <div style={{
          padding: '0.9rem 1.25rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          backgroundColor: feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: `1px solid ${feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
          color: feedbackMsg.type === 'error' ? '#f87171' : 'var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <span>{feedbackMsg.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* API ERROR / RETRY STATE */}
      {error && (
        <div style={{
          padding: '1.5rem',
          borderRadius: '10px',
          marginBottom: '2.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#f87171',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{
                fontFamily: theme.serifFont,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#881337',
                marginBottom: '0.25rem'
              }}>
                FRIENDS
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#9f1239' }}>
                Could not load your friends right now. {error}
              </p>
            </div>
            <button
              type="button"
              onClick={refreshFriends}
              disabled={loading}
              style={{
                padding: '0.65rem 1.5rem',
                backgroundColor: theme.gold,
                color: '#0d0f12',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'RETRYING...' : 'RETRY'}
            </button>
          </div>
        </div>
      )}

      {/* 2. FIND FRIENDS (SEARCH SECTION) */}
      <section style={{
        backgroundColor: theme.creamCard,
        borderRadius: '12px',
        padding: '2rem',
        border: `1px solid ${theme.silverBorder}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        marginBottom: '2.5rem'
      }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{
            fontFamily: theme.serifFont,
            fontSize: '1.4rem',
            fontWeight: 600,
            margin: '0 0 0.35rem',
            color: theme.textDark,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span style={{ color: theme.gold, fontSize: '1.2rem' }}>✦</span> FIND FRIENDS
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textMuted }}>
            Search by username to connect with gentlemen and exchange styling opinions.
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', maxWidth: '640px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.gold,
              fontWeight: 700,
              fontSize: '1.1rem',
              pointerEvents: 'none'
            }}>
              @
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @username (e.g. rahul, akil)..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.4rem',
                borderRadius: '8px',
                border: `1px solid ${theme.silverBorder}`,
                backgroundColor: theme.creamCardSubtle,
                color: theme.textDark,
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: theme.sansFont,
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.gold;
                e.target.style.boxShadow = `0 0 0 3px ${theme.goldLight}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.silverBorder;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            style={{
              padding: '0.8rem 1.6rem',
              backgroundColor: theme.gold,
              color: '#0d0f12',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: searching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              opacity: searching || !searchQuery.trim() ? 0.65 : 1,
              transition: 'background-color 0.2s, transform 0.1s',
              fontFamily: theme.sansFont,
              whiteSpace: 'nowrap'
            }}
          >
            {searching ? 'SEARCHING...' : 'SEARCH'}
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: '1rem', color: '#dc2626', fontSize: '0.85rem' }}>
            ⚠️ {searchError}
          </div>
        )}

        {/* SEARCH RESULTS */}
        {hasSearched && (
          <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: `1px solid ${theme.silverBorder}` }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.textMuted,
              marginBottom: '1rem'
            }}>
              Search Results ({safeSearchResults.length})
            </div>

            {safeSearchResults.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                backgroundColor: theme.creamCardSubtle,
                borderRadius: '8px',
                border: `1px dashed ${theme.silverBorder}`
              }}>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: theme.textDark }}>
                  No users found.
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: theme.textMuted }}>
                  We couldn't find anyone matching "@{searchQuery.trim()}". Check the spelling and try again.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
                {safeSearchResults.map((targetUser) => {
                  const rel = targetUser.relationship;
                  const isPendingSent = rel === 'PENDING_SENT' || rel === 'REQUEST_SENT';
                  const isPendingReceived = rel === 'PENDING_RECEIVED' || rel === 'REQUEST_RECEIVED';
                  const isFriends = rel === 'ACCEPTED';
                  const isSelf = rel === 'SELF';
                  const canAdd = !isSelf && !isFriends && !isPendingSent && !isPendingReceived;

                  return (
                    <div
                      key={targetUser.id}
                      style={{
                        backgroundColor: '#ffffff',
                        border: `1px solid ${theme.silverBorder}`,
                        borderRadius: '10px',
                        padding: '1.15rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: theme.goldLight,
                          border: `1px solid ${theme.goldBorder}`,
                          color: '#8b6f48',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem'
                        }}>
                          {(targetUser.fullName || targetUser.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: theme.textDark, fontSize: '0.95rem' }}>
                            @{targetUser.username}
                          </div>
                          {targetUser.fullName && (
                            <div style={{ fontSize: '0.825rem', color: theme.textMuted, marginTop: '2px' }}>
                              {targetUser.fullName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {isSelf ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: theme.textMuted,
                            padding: '0.35rem 0.75rem',
                            borderRadius: '9999px',
                            backgroundColor: theme.silverSubtle,
                            whiteSpace: 'nowrap'
                          }}>
                            YOU
                          </span>
                        ) : isFriends ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: '#15803d',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap'
                          }}>
                            ✓ FRIENDS
                          </span>
                        ) : isPendingSent ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: '#854d0e',
                            backgroundColor: '#fef9c3',
                            border: '1px solid #fef08a',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '9999px',
                            whiteSpace: 'nowrap'
                          }}>
                            REQUEST SENT
                          </span>
                        ) : isPendingReceived ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: '#1e40af',
                            backgroundColor: '#dbeafe',
                            border: '1px solid #bfdbfe',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '9999px',
                            whiteSpace: 'nowrap'
                          }}>
                            PENDING RECEIVED
                          </span>
                        ) : canAdd ? (
                          <button
                            type="button"
                            data-testid="add-friend-btn"
                            onClick={() => handleSendRequest(targetUser)}
                            disabled={actionLoadingId === `send-${targetUser.id}`}
                            style={{
                              padding: '0.45rem 1.1rem',
                              backgroundColor: theme.gold,
                              color: '#0d0f12',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              cursor: actionLoadingId === `send-${targetUser.id}` ? 'not-allowed' : 'pointer',
                              fontFamily: theme.sansFont,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {actionLoadingId === `send-${targetUser.id}` ? 'SENDING...' : 'ADD FRIEND'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. FRIEND REQUESTS (INCOMING) */}
      <section style={{
        backgroundColor: theme.creamCard,
        borderRadius: '12px',
        padding: '2rem',
        border: `1px solid ${theme.silverBorder}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        marginBottom: '2.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{
              fontFamily: theme.serifFont,
              fontSize: '1.4rem',
              fontWeight: 600,
              margin: '0 0 0.25rem',
              color: theme.textDark,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <span style={{ color: theme.gold, fontSize: '1.2rem' }}>✦</span> FRIEND REQUESTS
              {safeIncoming.length > 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: theme.gold,
                  color: '#0d0f12',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  lineHeight: 1
                }}>
                  {safeIncoming.length}
                </span>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textMuted }}>
              Respond to gentlemen who want to connect and exchange opinions.
            </p>
          </div>
        </div>

        {safeIncoming.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            backgroundColor: theme.creamCardSubtle,
            borderRadius: '8px',
            border: `1px dashed ${theme.silverBorder}`
          }}>
            <p style={{ margin: 0, color: theme.textMuted, fontSize: '0.9rem' }}>
              No pending friend requests.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {safeIncoming.map((req) => (
              <div
                key={req.friendshipId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.2rem 1.4rem',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${theme.goldBorder}`,
                  borderRadius: '10px',
                  boxShadow: '0 2px 10px rgba(197, 168, 128, 0.08)',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: theme.goldLight,
                    border: `1px solid ${theme.goldBorder}`,
                    color: '#8b6f48',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}>
                    {(req.fullName || req.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: theme.textDark }}>
                      @{req.username}
                    </div>
                    {req.fullName && (
                      <div style={{ fontSize: '0.85rem', color: theme.textMuted, marginTop: '2px' }}>
                        {req.fullName}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '4px' }}>
                      Sent on {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'recently'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    data-testid="accept-btn"
                    onClick={() => handleAccept(req)}
                    disabled={actionLoadingId === `accept-${req.friendshipId}`}
                    style={{
                      padding: '0.6rem 1.4rem',
                      backgroundColor: theme.gold,
                      color: '#0d0f12',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: actionLoadingId === `accept-${req.friendshipId}` ? 'not-allowed' : 'pointer',
                      fontFamily: theme.sansFont,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {actionLoadingId === `accept-${req.friendshipId}` ? 'ACCEPTING...' : 'ACCEPT'}
                  </button>
                  <button
                    type="button"
                    data-testid="reject-btn"
                    onClick={() => handleReject(req)}
                    disabled={actionLoadingId === `reject-${req.friendshipId}`}
                    style={{
                      padding: '0.6rem 1.4rem',
                      backgroundColor: 'transparent',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: actionLoadingId === `reject-${req.friendshipId}` ? 'not-allowed' : 'pointer',
                      fontFamily: theme.sansFont,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {actionLoadingId === `reject-${req.friendshipId}` ? 'DECLINING...' : 'REJECT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. MY FRIENDS */}
      <section style={{
        backgroundColor: theme.creamCard,
        borderRadius: '12px',
        padding: '2rem',
        border: `1px solid ${theme.silverBorder}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        marginBottom: '2.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{
              fontFamily: theme.serifFont,
              fontSize: '1.4rem',
              fontWeight: 600,
              margin: '0 0 0.25rem',
              color: theme.textDark,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <span style={{ color: theme.gold, fontSize: '1.2rem' }}>✦</span> MY FRIENDS ({safeFriends.length})
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textMuted }}>
              Only accepted friends can exchange private wishlist looks and outfit styling advice.
            </p>
          </div>
        </div>

        {safeFriends.length === 0 ? (
          <div style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: theme.creamCardSubtle,
            borderRadius: '10px',
            border: `1px dashed ${theme.silverBorder}`
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: theme.gold }}>🤝</div>
            <h3 style={{ fontFamily: theme.serifFont, fontSize: '1.25rem', margin: '0 0 0.5rem', color: theme.textDark }}>
              No friends yet.
            </h3>
            <p style={{ color: theme.textMuted, fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              Search for someone and start sharing your style.
            </p>
            <button
              type="button"
              onClick={focusSearchInput}
              style={{
                padding: '0.65rem 1.5rem',
                backgroundColor: theme.gold,
                color: '#0d0f12',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: theme.sansFont,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                whiteSpace: 'nowrap'
              }}
            >
              FIND FRIENDS
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
            {safeFriends.map((friend) => {
              const friendKey = friend.friendshipId || friend.id || friend.userId;
              return (
                <div
                  key={friendKey}
                  style={{
                    backgroundColor: '#ffffff',
                    border: `1px solid ${theme.silverBorder}`,
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: theme.goldLight,
                      border: `1px solid ${theme.goldBorder}`,
                      color: '#8b6f48',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.1rem'
                    }}>
                      {(friend.fullName || friend.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: theme.textDark, fontSize: '0.95rem' }}>
                        @{friend.username}
                      </div>
                      {friend.fullName && (
                        <div style={{ fontSize: '0.825rem', color: theme.textMuted, marginTop: '2px' }}>
                          {friend.fullName}
                        </div>
                      )}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.725rem',
                        color: '#15803d',
                        marginTop: '4px',
                        fontWeight: 600
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                        Accepted Friend
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      data-testid="remove-friend-btn"
                      onClick={() => handleRemove(friend)}
                      disabled={actionLoadingId === `remove-${friendKey}`}
                      style={{
                        padding: '0.45rem 0.85rem',
                        backgroundColor: 'transparent',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.725rem',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: actionLoadingId === `remove-${friendKey}` ? 'not-allowed' : 'pointer',
                        fontFamily: theme.sansFont,
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#fef2f2';
                        e.target.style.borderColor = '#f87171';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.borderColor = '#fecaca';
                      }}
                    >
                      {actionLoadingId === `remove-${friendKey}` ? 'REMOVING...' : 'REMOVE FRIEND'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. SENT REQUESTS (OUTGOING) */}
      {safeOutgoing.length > 0 && (
        <section style={{
          backgroundColor: theme.creamCard,
          borderRadius: '12px',
          padding: '1.75rem 2rem',
          border: `1px solid ${theme.silverBorder}`,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          marginBottom: '2.5rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{
              fontFamily: theme.serifFont,
              fontSize: '1.25rem',
              fontWeight: 600,
              margin: '0 0 0.25rem',
              color: theme.textDark,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ color: theme.gold, fontSize: '1.1rem' }}>✦</span> SENT REQUESTS ({safeOutgoing.length})
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: theme.textMuted }}>
              Requests you have sent that are currently awaiting acceptance.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {safeOutgoing.map((out) => (
              <div
                key={out.friendshipId}
                style={{
                  padding: '0.9rem 1.15rem',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${theme.silverBorder}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: theme.textDark }}>
                    @{out.username}
                  </div>
                  {out.fullName && (
                    <div style={{ fontSize: '0.8rem', color: theme.textMuted }}>
                      {out.fullName}
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#854d0e',
                  backgroundColor: '#fef9c3',
                  border: '1px solid #fef08a',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap'
                }}>
                  REQUEST SENT
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. PRIVATE LOOKS & OUTFIT OPINIONS */}
      <section style={{
        backgroundColor: theme.creamCard,
        borderRadius: '12px',
        padding: '2rem',
        border: `1px solid ${theme.silverBorder}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{
              fontFamily: theme.serifFont,
              fontSize: '1.4rem',
              fontWeight: 600,
              margin: '0 0 0.25rem',
              color: theme.textDark,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <span style={{ color: theme.gold, fontSize: '1.2rem' }}>✦</span> PRIVATE LOOKS & OUTFIT ADVICE
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textMuted }}>
              Curated wishlist collections and outfit combinations shared privately between accepted friends.
            </p>
          </div>

          {/* Luxury Tab Switcher */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: theme.silverSubtle,
            padding: '4px',
            borderRadius: '8px',
            border: `1px solid ${theme.silverBorder}`
          }}>
            <button
              type="button"
              onClick={() => setActiveSharesTab('received')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                fontFamily: theme.sansFont,
                backgroundColor: activeSharesTab === 'received' ? '#ffffff' : 'transparent',
                color: activeSharesTab === 'received' ? theme.textDark : theme.textMuted,
                boxShadow: activeSharesTab === 'received' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              RECEIVED ({safeSharedWithMe.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSharesTab('sent')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                fontFamily: theme.sansFont,
                backgroundColor: activeSharesTab === 'sent' ? '#ffffff' : 'transparent',
                color: activeSharesTab === 'sent' ? theme.textDark : theme.textMuted,
                boxShadow: activeSharesTab === 'sent' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              SENT BY ME ({safeSharedByMe.length})
            </button>
          </div>
        </div>

        {loadingShares ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.9rem' }}>
            Loading shared looks...
          </div>
        ) : activeSharesTab === 'received' ? (
          <div>
            {safeSharedWithMe.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                backgroundColor: theme.creamCardSubtle,
                borderRadius: '8px',
                border: `1px dashed ${theme.silverBorder}`
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📬</div>
                <h4 style={{ fontFamily: theme.serifFont, fontSize: '1.15rem', margin: '0 0 0.35rem', color: theme.textDark }}>
                  No looks received yet.
                </h4>
                <p style={{ fontSize: '0.875rem', color: theme.textMuted, maxWidth: '440px', margin: '0 auto' }}>
                  When your accepted friends share a curated wishlist look or complete outfit combo, it will appear here for you to give your reaction and styling opinion.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                {safeSharedWithMe.map((share) => (
                  <div
                    key={share.shareId}
                    style={{
                      padding: '1.4rem',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${theme.silverBorder}`,
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#8b6f48',
                          backgroundColor: theme.goldLight,
                          border: `1px solid ${theme.goldBorder}`,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          whiteSpace: 'nowrap'
                        }}>
                          PRIVATE LOOK
                        </span>
                        <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>
                          {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 0.35rem', color: theme.textDark, fontFamily: theme.serifFont, fontSize: '1.15rem' }}>
                        From @{share.senderUsername}
                      </h4>
                      <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: theme.textSecondary }}>
                        {share.itemCount} curated piece{share.itemCount === 1 ? '' : 's'} in outfit
                      </p>

                      {share.feedbackCount > 0 ? (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#15803d',
                          marginBottom: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: 600
                        }}>
                          <span>✓</span> Feedback posted ({share.feedbackCount})
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#b45309',
                          marginBottom: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: 600
                        }}>
                          <span>⏳</span> Awaiting your opinion
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/shared-wishlist/${share.shareId}`}
                      style={{
                        padding: '0.65rem 1rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        textDecoration: 'none',
                        backgroundColor: theme.gold,
                        color: '#0d0f12',
                        borderRadius: '6px',
                        display: 'block',
                        fontFamily: theme.sansFont,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      VIEW LOOK & GIVE OPINION →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {safeSharedByMe.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                backgroundColor: theme.creamCardSubtle,
                borderRadius: '8px',
                border: `1px dashed ${theme.silverBorder}`
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: theme.gold }}>✨</div>
                <h4 style={{ fontFamily: theme.serifFont, fontSize: '1.15rem', margin: '0 0 0.35rem', color: theme.textDark }}>
                  You haven't shared any looks yet.
                </h4>
                <p style={{ fontSize: '0.875rem', color: theme.textMuted, maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                  Share your favorite styles from your Wishlist or click "Share This Look With Friend" on any Top or Bottom product page!
                </p>
                <Link
                  to="/wishlist"
                  style={{
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    backgroundColor: theme.gold,
                    color: '#0d0f12',
                    borderRadius: '6px',
                    display: 'inline-block',
                    fontFamily: theme.sansFont,
                    whiteSpace: 'nowrap'
                  }}
                >
                  GO TO WISHLIST
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                {safeSharedByMe.map((share) => (
                  <div
                    key={share.shareId}
                    style={{
                      padding: '1.4rem',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${theme.silverBorder}`,
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#475569',
                          backgroundColor: theme.silverSubtle,
                          border: `1px solid ${theme.silverBorder}`,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          whiteSpace: 'nowrap'
                        }}>
                          SENT LOOK
                        </span>
                        <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>
                          {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 0.35rem', color: theme.textDark, fontFamily: theme.serifFont, fontSize: '1.15rem' }}>
                        Shared with @{share.receiverUsername}
                      </h4>
                      <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: theme.textSecondary }}>
                        {share.itemCount} curated piece{share.itemCount === 1 ? '' : 's'} in outfit
                      </p>

                      {share.feedbackCount > 0 ? (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#854d0e',
                          marginBottom: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: 600
                        }}>
                          <span>💬</span> {share.feedbackCount} opinion{share.feedbackCount === 1 ? '' : 's'} received
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: theme.textMuted, marginBottom: '1.25rem' }}>
                          Waiting for friend's review
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/shared-wishlist/${share.shareId}`}
                      style={{
                        padding: '0.65rem 1rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        textDecoration: 'none',
                        backgroundColor: theme.silverSubtle,
                        color: theme.textDark,
                        border: `1px solid ${theme.silverBorder}`,
                        borderRadius: '6px',
                        display: 'block',
                        fontFamily: theme.sansFont,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      VIEW LOOK & FEEDBACK →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
