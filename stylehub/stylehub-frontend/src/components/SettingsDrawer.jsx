import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEMES } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchSettingsApi, updateSettingsApi } from '../services/api';

export default function SettingsDrawer({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(true);
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [accountData, setAccountData] = useState(null);

  // Sync settings from backend upon drawer opening
  useEffect(() => {
    if (isOpen && token) {
      fetchSettingsApi(token)
        .then(res => {
          if (res?.settings) {
            if (res.settings.theme) setTheme(res.settings.theme);
            if (res.settings.language) setLanguage(res.settings.language);
            if (res.settings.communication) {
              setEmailNotif(Boolean(res.settings.communication.email));
              setSmsNotif(Boolean(res.settings.communication.sms));
              setWhatsappNotif(Boolean(res.settings.communication.whatsapp));
            }
            if (res.settings.account) {
              setAccountData(res.settings.account);
            }
          }
        })
        .catch(err => {
          console.warn('Failed to fetch settings from backend:', err);
        });
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSavePreferences = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      if (token) {
        await updateSettingsApi(token, {
          theme,
          language,
          communication: {
            email: emailNotif,
            sms: smsNotif,
            whatsapp: whatsappNotif
          }
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Backdrop click area */}
      <div 
        style={{ flex: 1 }} 
        onClick={onClose} 
        aria-label="Close Settings Drawer"
      />

      {/* Drawer Container */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        height: '100%',
        backgroundColor: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-gold)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
        overflowY: 'auto'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '1.75rem 2rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: 'var(--accent-gold)',
              textTransform: 'uppercase',
              marginBottom: '0.25rem'
            }}>
              AK'S MEN STYLE
            </div>
            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.04em'
            }}>
              ⚙ {t('settings')}
            </h2>
          </div>

          <button
            onClick={onClose}
            id="close-settings-btn"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '1.25rem',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-gold)';
              e.currentTarget.style.color = 'var(--accent-gold)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.25rem', flex: 1 }}>
          
          {/* SECTION 1: APPEARANCE / COLOR THEMES */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>✦</span>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {t('appearance')} — {t('theme')}
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Choose a tailored high-fashion visual identity for AK'S MEN STYLE.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {THEMES.map(th => {
                const isSelected = theme === th.id;
                return (
                  <div
                    key={th.id}
                    id={`theme-option-${th.id}`}
                    onClick={() => setTheme(th.id)}
                    style={{
                      padding: '1rem 1.15rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      boxShadow: isSelected ? '0 0 16px var(--accent-gold-glow)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: isSelected ? 'var(--accent-gold)' : 'var(--text-primary)',
                          letterSpacing: '0.02em'
                        }}>
                          {th.name}
                        </span>
                        {th.badge && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.08)',
                            color: isSelected ? '#000000' : 'var(--text-muted)'
                          }}>
                            {th.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {th.subtitle}
                      </div>
                    </div>

                    {/* Color Swatch Preview */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {th.colors.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: c,
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: LANGUAGE */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>✦</span>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {t('language')}
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Select your preferred browsing language.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                id="language-select-en"
                onClick={() => setLanguage('en')}
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: language === 'en' ? 'rgba(212, 175, 55, 0.12)' : 'var(--bg-secondary)',
                  border: language === 'en' ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  color: language === 'en' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'all 0.2s ease',
                  boxShadow: language === 'en' ? '0 0 14px var(--accent-gold-glow)' : 'none'
                }}
              >
                English [ EN ]
              </button>

              <button
                type="button"
                id="language-select-ta"
                onClick={() => setLanguage('ta')}
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: language === 'ta' ? 'rgba(212, 175, 55, 0.12)' : 'var(--bg-secondary)',
                  border: language === 'ta' ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  color: language === 'ta' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'all 0.2s ease',
                  boxShadow: language === 'ta' ? '0 0 14px var(--accent-gold-glow)' : 'none'
                }}
              >
                தமிழ் [ TA ]
              </button>
            </div>
          </div>

          {/* SECTION 3: COMMUNICATION PREFERENCES */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>✦</span>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {t('communicationPreferences')}
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Receive instant order confirmations when your purchase is committed.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Email Option */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>✉️</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('emailNotifications')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Gmail / Verified Inbox
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="checkbox-email-notif"
                  checked={emailNotif}
                  onChange={e => setEmailNotif(e.target.checked)}
                  style={{ accentColor: 'var(--accent-gold)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>

              {/* SMS Option */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📱</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('smsNotifications')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Direct Mobile SMS (+91)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="checkbox-sms-notif"
                  checked={smsNotif}
                  onChange={e => setSmsNotif(e.target.checked)}
                  style={{ accentColor: 'var(--accent-gold)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>

              {/* WhatsApp Option */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>💬</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('whatsappNotifications')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Twilio WhatsApp Business
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="checkbox-whatsapp-notif"
                  checked={whatsappNotif}
                  onChange={e => setWhatsappNotif(e.target.checked)}
                  style={{ accentColor: 'var(--accent-gold)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          {/* SECTION 4: ACCOUNT SUMMARY */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>✦</span>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {t('accountDetails')}
              </h3>
            </div>

            <div style={{
              padding: '1.15rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {accountData?.fullName || user?.fullName || 'Member'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {accountData?.email || user?.email || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {accountData?.phone || user?.phone || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>City:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {accountData?.city ? `${accountData.city}, ${accountData.state || ''}` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Role:</span>
                <span style={{
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  letterSpacing: '0.06em'
                }}>
                  {accountData?.role || user?.role || 'USER'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Drawer Footer Actions */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {saveSuccess && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: 'var(--accent-green)',
              fontSize: '11px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              ✓ {t('settingsSaved')}
            </div>
          )}

          <button
            type="button"
            id="save-settings-btn"
            onClick={handleSavePreferences}
            disabled={saving}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              fontSize: '11px',
              letterSpacing: '0.1em',
              fontWeight: 800
            }}
          >
            {saving ? 'SAVING...' : t('saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
