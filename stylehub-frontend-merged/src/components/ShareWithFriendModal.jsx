import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFriends } from '../context/FriendsContext';
import { useAuth } from '../context/AuthContext';
import { createWishlistShareApi } from '../services/wishlistShareService';

export default function ShareWithFriendModal({ selectedProducts, shareType = 'PRODUCTS', onClose, onShareSuccess }) {
  const { friends, loading: friendsLoading } = useFriends();
  const { token } = useAuth();
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    if (!selectedFriendId) {
      setError('Please select a friend to share with.');
      return;
    }
    if (!selectedProducts || selectedProducts.length === 0) {
      setError('Please select at least one item.');
      return;
    }

    try {
      setSharing(true);
      setError('');
      const chosenFriend = friends.find(f => (f.userId || f.id) === Number(selectedFriendId) || f.id === Number(selectedFriendId));
      const targetUserId = chosenFriend ? (chosenFriend.userId || chosenFriend.id) : Number(selectedFriendId);

      const productIds = selectedProducts.map(p => Number(p.productId || p.id));
      const res = await createWishlistShareApi(token, {
        receiverId: Number(targetUserId),
        productIds,
        shareType
      });

      onShareSuccess(res, chosenFriend);
    } catch (err) {
      setError(err.message || 'Failed to share items');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#161920',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '1.75rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <span className="badge" style={{ marginBottom: '0.4rem' }}>Private Look Sharing</span>
            <h3 style={{ margin: 0 }}>Share With a Friend</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: 'var(--radius-sm)',
            color: '#f87171',
            fontSize: 'var(--font-size-xs)',
            marginBottom: '1rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Selected Products Preview */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            SELECTED PIECES ({selectedProducts.length})
          </label>
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'auto',
            padding: '0.5rem 0.25rem',
            scrollbarWidth: 'thin'
          }}>
            {selectedProducts.map((p) => (
              <div
                key={p.productId || p.id}
                style={{
                  flexShrink: 0,
                  width: '70px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: '#12151b',
                  marginBottom: '0.25rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <img
                    src={p.image}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {p.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Friend Selector */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.25rem' }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            SELECT ACCEPTED FRIEND
          </label>

          {friendsLoading ? (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Loading friends list...</p>
          ) : friends.length === 0 ? (
            <div style={{
              padding: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                You don't have any accepted friends yet. Private sharing requires an accepted friend connection.
              </p>
              <Link to="/friends" className="btn btn-secondary" onClick={onClose} style={{ fontSize: 'var(--font-size-xs)', padding: '0.45rem 1rem' }}>
                Go to Friends Page
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {friends.map((friend) => {
                const isSelected = selectedFriendId === friend.id;
                return (
                  <label
                    key={friend.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'rgba(212, 163, 89, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="shareFriend"
                      value={friend.id}
                      checked={isSelected}
                      onChange={() => setSelectedFriendId(friend.id)}
                      style={{ accentColor: 'var(--accent-gold)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                        @{friend.username}
                      </div>
                      {friend.fullName && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {friend.fullName}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={sharing}
            style={{ padding: '0.55rem 1.25rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShare}
            disabled={sharing || !selectedFriendId || friends.length === 0}
            style={{
              padding: '0.55rem 1.5rem',
              backgroundColor: 'var(--accent-gold)',
              color: '#0d0f12',
              fontWeight: 700
            }}
          >
            {sharing ? 'Sending...' : 'SEND'}
          </button>
        </div>
      </div>
    </div>
  );
}
