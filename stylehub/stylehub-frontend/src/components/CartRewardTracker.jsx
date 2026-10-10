import React from 'react';
import { calculateCartReward, CART_REWARD_TIERS } from '../utils/cartReward';

export default function CartRewardTracker({ subtotal = 0, cartReward = null }) {
  const reward = cartReward || calculateCartReward(subtotal);
  const currentSubtotal = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100);

  // Determine current target threshold and subtotal display ratio
  let targetThreshold = 1000;
  let statusMessage = '';
  let sublineMessage = '';
  let progressPercent = 0;

  if (currentSubtotal >= 3000) {
    targetThreshold = 3000;
    statusMessage = '🏆 30% OFF — MAX SAVING UNLOCKED';
    sublineMessage = ''; // No "add more" message at max tier
    progressPercent = 100;
  } else if (currentSubtotal >= 2000) {
    targetThreshold = 3000;
    statusMessage = '✓ 20% OFF UNLOCKED';
    const needed = Math.round((3000 - currentSubtotal) * 100) / 100;
    sublineMessage = `Add ₹${needed.toLocaleString('en-IN')} more to unlock 30% OFF`;
    progressPercent = Math.min(100, Math.max(0, ((currentSubtotal - 2000) / 1000) * 100));
  } else if (currentSubtotal >= 1000) {
    targetThreshold = 2000;
    statusMessage = '✓ 10% OFF UNLOCKED';
    const needed = Math.round((2000 - currentSubtotal) * 100) / 100;
    sublineMessage = `Add ₹${needed.toLocaleString('en-IN')} more to unlock 20% OFF`;
    progressPercent = Math.min(100, Math.max(0, ((currentSubtotal - 1000) / 1000) * 100));
  } else {
    targetThreshold = 1000;
    statusMessage = '';
    const needed = Math.round((1000 - currentSubtotal) * 100) / 100;
    sublineMessage = `Add ₹${needed.toLocaleString('en-IN')} more to unlock 10% OFF`;
    progressPercent = Math.min(100, Math.max(0, (currentSubtotal / 1000) * 100));
  }

  return (
    <div
      className="card"
      id="buy-more-save-more-tracker"
      style={{
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem',
        backgroundColor: 'var(--bg-secondary)',
        border: reward.tier > 0 ? '1.5px solid rgba(212, 175, 55, 0.55)' : '1px solid var(--border-silver)',
        borderRadius: 'var(--radius-md)',
        boxShadow: reward.tier > 0 ? '0 6px 24px rgba(212, 175, 55, 0.15)' : '0 4px 16px rgba(var(--shadow-rgb), 0.4)',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Top Header: Always visible "BUY MORE, SAVE MORE" + Real Subtotal Ratio */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '0.9rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent-gold)'
          }}>
            BUY MORE, SAVE MORE
          </span>
          {reward.percentage > 0 && (
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '0.2rem 0.55rem',
              backgroundColor: 'rgba(212, 175, 55, 0.15)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--accent-gold)'
            }}>
              {reward.percentage}% REWARD APPLIED
            </span>
          )}
        </div>

        {/* Current Subtotal vs Target Milestone */}
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
          ₹{currentSubtotal.toLocaleString('en-IN')}{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
            / ₹{targetThreshold.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Visual Progress Bar (Gold gradient fill) */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '10px',
        backgroundColor: 'var(--bg-card-hover)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
        marginBottom: '0.95rem'
      }}>
        <div
          id="cart-reward-progress-fill"
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #997A15 0%, #D4AF37 50%, #F5DE7A 100%)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.5)'
          }}
        />
      </div>

      {/* Status & Unlocked Reward Message */}
      {statusMessage && (
        <div style={{
          fontSize: '13px',
          fontWeight: 800,
          color: 'var(--accent-gold)',
          letterSpacing: '0.02em',
          marginBottom: sublineMessage ? '0.3rem' : '1rem'
        }}>
          {statusMessage}
        </div>
      )}

      {/* Dynamic Subline Action Prompt */}
      {sublineMessage && (
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: reward.tier > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
          marginBottom: '1rem',
          lineHeight: 1.4
        }}>
          {sublineMessage}
        </div>
      )}

      {/* Milestone Markers: ₹1,000 (10%), ₹2,000 (20%), ₹3,000 (30%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.65rem',
        textAlign: 'center'
      }}>
        {/* Tier 1 Marker: ₹1,000 → 10% */}
        <div style={{
          padding: '0.55rem 0.25rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: reward.tier >= 1 ? 'rgba(212, 175, 55, 0.14)' : 'var(--bg-secondary)',
          border: reward.tier >= 1 ? '1px solid rgba(212, 175, 55, 0.7)' : '1px solid var(--border-color)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: reward.tier >= 1 ? 'var(--accent-gold)' : 'var(--text-muted)'
          }}>
            {reward.tier >= 1 ? '✓ 10% OFF' : '10% OFF'}
          </div>
          <div style={{ fontSize: '11px', color: reward.tier >= 1 ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            ₹1,000
          </div>
        </div>

        {/* Tier 2 Marker: ₹2,000 → 20% */}
        <div style={{
          padding: '0.55rem 0.25rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: reward.tier >= 2 ? 'rgba(212, 175, 55, 0.14)' : 'var(--bg-secondary)',
          border: reward.tier >= 2 ? '1px solid rgba(212, 175, 55, 0.7)' : '1px solid var(--border-color)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: reward.tier >= 2 ? 'var(--accent-gold)' : 'var(--text-muted)'
          }}>
            {reward.tier >= 2 ? '✓ 20% OFF' : '20% OFF'}
          </div>
          <div style={{ fontSize: '11px', color: reward.tier >= 2 ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            ₹2,000
          </div>
        </div>

        {/* Tier 3 Marker: ₹3,000 → 30% */}
        <div style={{
          padding: '0.55rem 0.25rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: reward.tier >= 3 ? 'rgba(212, 175, 55, 0.2)' : 'var(--bg-secondary)',
          border: reward.tier >= 3 ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: reward.tier >= 3 ? 'var(--accent-gold)' : 'var(--text-muted)'
          }}>
            {reward.tier >= 3 ? '🏆 30% OFF' : '30% OFF'}
          </div>
          <div style={{ fontSize: '11px', color: reward.tier >= 3 ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            ₹3,000
          </div>
        </div>
      </div>
    </div>
  );
}
