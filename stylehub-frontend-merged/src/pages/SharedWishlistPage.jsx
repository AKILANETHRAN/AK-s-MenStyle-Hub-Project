import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWishlistShareByIdApi, addShareFeedbackApi } from '../services/wishlistShareService';

export default function SharedWishlistPage() {
  const { shareId } = useParams();
  const { user, token } = useAuth();

  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feedback form state
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingReaction, setSubmittingReaction] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const loadShareData = async () => {
    if (!token || !shareId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWishlistShareByIdApi(token, shareId);
      setShareData(data);
    } catch (err) {
      console.error('Failed to load shared look:', err);
      setError(err.message || 'Unable to view shared wishlist. You may not have permission.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShareData();
  }, [shareId, token]);

  // Restore existing reaction and comment when shareData or user updates
  useEffect(() => {
    if (shareData?.feedback && user?.id) {
      const myFeedback = shareData.feedback.find(fb => fb.userId === user.id);
      if (myFeedback) {
        if (myFeedback.reaction) {
          setSelectedReaction(myFeedback.reaction);
        }
        if (myFeedback.comment) {
          setCommentText(myFeedback.comment);
        }
      }
    }
  }, [shareData, user?.id]);

  const handleQuickReaction = async (reaction) => {
    if (!token || !shareId || submittingReaction || submittingFeedback) return;
    try {
      setSubmittingReaction(true);
      setFeedbackError('');
      setFeedbackSuccess('');

      const res = await addShareFeedbackApi(token, shareId, {
        reaction,
        comment: null
      });

      // Update selected reaction only on server confirmation
      setSelectedReaction(reaction);
      const emoji = reaction === 'LOVE' ? '❤️' : reaction === 'FIRE' ? '🔥' : '👍';
      setFeedbackSuccess(`Your ${emoji} ${reaction} reaction has been saved!`);

      if (res?.data?.feedback) {
        setShareData(prev => prev ? ({ ...prev, feedback: res.data.feedback }) : prev);
      } else {
        await loadShareData();
      }
      setTimeout(() => setFeedbackSuccess(''), 4000);
    } catch (err) {
      console.error('Reaction submission error:', err);
      setFeedbackError('Could not save your reaction. Please try again.');
    } finally {
      setSubmittingReaction(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (submittingFeedback || submittingReaction) return;

    const trimmed = commentText.trim();
    if (!trimmed) {
      setFeedbackError('Feedback cannot be empty.');
      return;
    }
    if (trimmed.length > 500) {
      setFeedbackError('Feedback must be 500 characters or less.');
      return;
    }

    try {
      setSubmittingFeedback(true);
      setFeedbackError('');
      setFeedbackSuccess('');

      const res = await addShareFeedbackApi(token, shareId, {
        reaction: selectedReaction,
        comment: trimmed
      });

      setFeedbackSuccess('Your feedback has been sent to the sender!');
      if (res?.data?.feedback) {
        setShareData(prev => prev ? ({ ...prev, feedback: res.data.feedback }) : prev);
      } else {
        await loadShareData();
      }
      setTimeout(() => setFeedbackSuccess(''), 4000);
    } catch (err) {
      console.error('Feedback submission error:', err);
      setFeedbackError('Could not send your feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
        <h3>Loading Private Shared Look...</h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Verifying private friendship access</p>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="card" style={{ maxWidth: '560px', margin: '4rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#ef4444' }}>🔒</div>
        <h2>Private Shared Wishlist</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem', fontSize: 'var(--font-size-sm)' }}>
          {error || 'This look is private and can only be viewed by accepted friends.'}
        </p>
        <Link to="/friends" className="btn btn-primary">
          Back to Friends
        </Link>
      </div>
    );
  }

  const isSender = Boolean(shareData.isSender ?? (shareData.senderId === user?.id || shareData.sender?.id === user?.id));
  const isReceiver = Boolean(shareData.isReceiver ?? (shareData.receiverId === user?.id || shareData.receiver?.id === user?.id));
  const sharedItems = shareData.items || shareData.products || [];

  const reactionEmojis = {
    LIKE: '👍',
    LOVE: '❤️',
    FIRE: '🔥'
  };

  const isLook = shareData.shareType === 'LOOK';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        marginBottom: '2.5rem',
        padding: '2rem',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(212, 163, 89, 0.12) 0%, rgba(18, 21, 27, 0.7) 100%)',
        border: '1px solid rgba(212, 163, 89, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  SHARED BY
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                  @{shareData.sender?.username}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  SHARE TYPE
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                  {isLook ? 'COMPLETE LOOK' : 'PRODUCTS'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  SHARED ON
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {shareData.createdAt ? new Date(shareData.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'}
                </span>
              </div>
            </div>

            <h1 style={{ margin: '0.5rem 0', fontSize: '2.1rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 800 }}>
              {isLook ? 'COMPLETE THE LOOK' : 'SHARED PRODUCTS'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {isSender ? (
                <>Shared with your friend <strong style={{ color: 'var(--accent-gold)' }}>@{shareData.receiver?.username}</strong></>
              ) : (
                <>{isLook ? 'Complete outfit combination curated by' : 'Handpicked fashion pieces shared by'} <strong style={{ color: 'var(--accent-gold)' }}>@{shareData.sender?.username}</strong></>
              )}
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--accent-green)',
            color: 'var(--accent-green)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600
          }}>
            <span>🔒</span> Private Friend Access Only
          </div>
        </div>
      </div>

      {/* SHARED PRODUCTS / COMPLETE LOOK PRESENTATION */}
      <section style={{ marginBottom: '3.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 'var(--font-size-sm)', color: 'var(--accent-gold)' }}>
          {isLook ? 'COMPLETE THE LOOK' : 'SHARED PRODUCTS'} ({sharedItems.length} Pieces)
        </h3>

        {/* Combo visual connector representation: [Product] + [Product] */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          alignItems: 'stretch'
        }}>
          {sharedItems.map((product, idx) => (
            <React.Fragment key={product.productId}>
              <div className="card" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem',
                position: 'relative'
              }}>
                {/* Number Badge */}
                <div style={{
                  position: 'absolute',
                  top: '18px',
                  left: '18px',
                  zIndex: 2,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(13, 15, 18, 0.85)',
                  color: 'var(--accent-gold)',
                  border: '1px solid var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {idx + 1}
                </div>

                {/* Real Product Image (NEVER garment_image) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '125%',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: '#12151b',
                  marginBottom: '1rem'
                }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Stock Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: product.stock > 0 ? 'rgba(0, 0, 0, 0.75)' : 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff'
                  }}>
                    {product.stock > 0 ? `${product.stock} left` : 'Sold Out'}
                  </span>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {product.brand}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {product.category}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                  <Link to={`/products/${product.productId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {product.name}
                  </Link>
                </h4>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: 'auto', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{product.price}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span style={{ fontSize: 'var(--font-size-xs)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      ₹{product.originalPrice}
                    </span>
                  )}
                  {product.discountPercent > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)' }}>
                      {product.discountPercent}% OFF
                    </span>
                  )}
                </div>

                <Link
                  to={`/products/${product.productId}`}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '0.45rem', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
                >
                  VIEW PIECE
                </Link>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* SECTION 16, 17, 18: FRIEND OPINION & FEEDBACK */}
      <section className="card" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <span className="badge" style={{ marginBottom: '0.5rem' }}>Style Opinion</span>
          <h3 style={{ margin: 0 }}>Friend Opinions & Feedback</h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Exchange candid reactions and combo advice between friends.
          </p>
        </div>

        {/* Existing Feedbacks Display */}
        {shareData.feedback && shareData.feedback.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
            {shareData.feedback.map((fb) => (
              <div
                key={fb.id}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>@{fb.username}</span>
                    <span style={{
                      fontSize: '1.1rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(212, 163, 89, 0.15)',
                      border: '1px solid rgba(212, 163, 89, 0.3)'
                    }}>
                      {reactionEmojis[fb.reaction] || '💬'} {fb.reaction}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                </div>
                {fb.comment && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    "{fb.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: '2rem' }}>
            No opinions posted yet for this look.
          </p>
        )}

        {/* Receiver Opinion Form */}
        {isReceiver ? (
          <form onSubmit={handleFeedbackSubmit} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.75rem' }}>
            <h4 style={{ marginBottom: '1.25rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
              Give Your Friend Style Opinion
            </h4>

            {feedbackSuccess && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--accent-green)',
                color: 'var(--accent-green)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>✓</span>
                <span>{feedbackSuccess}</span>
              </div>
            )}

            {feedbackError && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{feedbackError}</span>
              </div>
            )}

            {/* Quick Reactions */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '0.75rem'
              }}>
                YOUR REACTION
              </label>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'LIKE', label: 'LIKE', icon: '👍' },
                  { value: 'LOVE', label: 'LOVE', icon: '❤️' },
                  { value: 'FIRE', label: 'FIRE', icon: '🔥' }
                ].map((r) => {
                  const isSelected = selectedReaction === r.value;
                  return (
                    <button
                      key={r.value}
                      id={`reaction-btn-${r.value.toLowerCase()}`}
                      type="button"
                      disabled={submittingReaction || submittingFeedback}
                      onClick={() => handleQuickReaction(r.value)}
                      style={{
                        padding: '0.75rem 1.4rem',
                        borderRadius: 'var(--radius-sm, 6px)',
                        backgroundColor: isSelected ? 'rgba(212, 163, 89, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '2px solid var(--accent-gold, #d4a359)' : '1px solid rgba(192, 192, 192, 0.35)',
                        color: isSelected ? 'var(--accent-gold, #d4a359)' : 'var(--text-secondary, #c0c0c0)',
                        boxShadow: isSelected ? '0 0 14px rgba(212, 163, 89, 0.28)' : 'none',
                        cursor: submittingReaction || submittingFeedback ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 'var(--font-size-sm, 0.9rem)',
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                        opacity: (submittingReaction || submittingFeedback) && !isSelected ? 0.6 : 1
                      }}
                    >
                      <span style={{ fontSize: '1.15rem' }}>{r.icon}</span>
                      <span>{r.label}</span>
                      {isSelected && <span style={{ color: 'var(--accent-gold, #d4a359)', fontWeight: 800 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              {submittingReaction && (
                <p style={{ fontSize: '11px', color: 'var(--accent-gold)', marginTop: '0.5rem' }}>
                  Submitting reaction...
                </p>
              )}
            </div>

            {/* Comment Textarea */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}>
                  YOUR FEEDBACK
                </label>
                <span style={{
                  fontSize: '11px',
                  color: commentText.length > 450 ? '#ef4444' : 'var(--text-muted)',
                  fontWeight: commentText.length > 450 ? 700 : 400
                }}>
                  {commentText.length}/500
                </span>
              </div>
              <textarea
                id="share-feedback-textarea"
                className="form-input"
                rows="3"
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  if (feedbackError) setFeedbackError('');
                }}
                placeholder="Write your opinion about this look... (e.g. Bro this combo looks really sharp.)"
                maxLength={500}
                disabled={submittingFeedback}
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: '#12151b',
                  border: '1px solid rgba(192, 192, 192, 0.35)',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: 'var(--font-size-sm, 0.9rem)',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              id="submit-feedback-btn"
              type="submit"
              className="btn btn-primary"
              disabled={submittingFeedback || submittingReaction || !commentText.trim()}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: 'var(--accent-gold, #d4a359)',
                color: '#0d0f12',
                fontWeight: 700,
                letterSpacing: '0.05em',
                borderRadius: 'var(--radius-sm, 6px)',
                cursor: submittingFeedback || !commentText.trim() ? 'not-allowed' : 'pointer',
                opacity: submittingFeedback || !commentText.trim() ? 0.5 : 1,
                border: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {submittingFeedback ? 'Sending...' : 'SEND FEEDBACK'}
            </button>
          </form>
        ) : isSender ? (
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-size-sm)'
          }}>
            💬 This is your shared look. Waiting for @{shareData.receiver?.username} to share their reaction and comments!
          </div>
        ) : null}
      </section>
    </div>
  );
}
