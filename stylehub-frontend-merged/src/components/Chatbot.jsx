import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendChatbotMessageApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hi! Need help finding a look? Ask about products, styling, VTON or shopping...',
      suggestions: [
        'Show me shirts',
        'Suggest pants for white shirt',
        'What can I try with VTON?',
        'How do I share a look?',
        'What products are in stock?'
      ]
    }
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageToSend) => {
    const text = (messageToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const data = await sendChatbotMessageApi(text);
      const assistantMsg = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: data.reply,
        action: data.action,
        products: data.products,
        suggestions: data.suggestions
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: 'Sorry, I encountered a temporary connection issue. Please try again.',
          suggestions: ['Show me shirts', 'What can I try with VTON?']
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (action?.path) {
      navigate(action.path);
      setIsOpen(false);
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div style={{
        position: 'fixed',
        bottom: '1.75rem',
        right: '1.75rem',
        zIndex: 1000
      }}>
        {!isOpen ? (
          <button
            type="button"
            id="chatbot-launcher-btn"
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              backgroundColor: '#151517',
              color: 'var(--accent-gold)',
              border: '1.5px solid var(--accent-gold)',
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(212, 175, 55, 0.3)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-gold)';
              e.currentTarget.style.color = '#0B0B0C';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#151517';
              e.currentTarget.style.color = 'var(--accent-gold)';
            }}
          >
            <span style={{ fontSize: '1.15rem' }}>✨</span>
            <span>{t('chatTitle')}</span>
          </button>
        ) : null}
      </div>

      {/* Chat Window Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '1.75rem',
          right: '1.75rem',
          width: '380px',
          maxWidth: 'calc(100vw - 2.5rem)',
          height: '520px',
          maxHeight: 'calc(100vh - 4rem)',
          backgroundColor: '#121214',
          border: '1.5px solid var(--border-gold)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#1A1A1D',
            borderBottom: '1px solid var(--border-silver)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-gold)',
                boxShadow: '0 0 8px var(--accent-gold)'
              }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.08em', color: '#FFFFFF' }}>
                  {t('chatTitle')}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--accent-silver)' }}>
                  {t('chatSubtitle')}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="chatbot-close-btn"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                lineHeight: 1
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%'
                  }}
                >
                  <div style={{
                    backgroundColor: isUser ? 'var(--accent-gold)' : '#1F1F24',
                    color: isUser ? '#0B0B0C' : '#FFFFFF',
                    padding: '0.75rem 1rem',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: 'var(--font-size-xs)',
                    lineHeight: 1.5,
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    maxWidth: '85%'
                  }}>
                    {m.text}
                  </div>

                  {/* Optional Action Button */}
                  {m.action && (
                    <button
                      type="button"
                      onClick={() => handleActionClick(m.action)}
                      style={{
                        marginTop: '0.5rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--accent-gold)',
                        color: 'var(--accent-gold)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>→</span>
                      <span>{m.action.label}</span>
                    </button>
                  )}

                  {/* Optional Mini Products Grid */}
                  {m.products && m.products.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      marginTop: '0.75rem',
                      width: '100%'
                    }}>
                      {m.products.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleProductClick(p.id)}
                          style={{
                            backgroundColor: '#18181C',
                            border: '1px solid var(--border-silver)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-silver)'; }}
                        >
                          <img
                            src={p.image}
                            alt={p.name}
                            style={{
                              width: '100%',
                              height: '70px',
                              objectFit: 'cover',
                              borderRadius: '2px',
                              marginBottom: '0.35rem'
                            }}
                          />
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                            ₹{p.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions Pills */}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      marginTop: '0.6rem'
                    }}>
                      {m.suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSend(sug)}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.25rem 0.65rem',
                            fontSize: '10px',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-gold)';
                            e.currentTarget.style.color = 'var(--accent-gold)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-gold)', fontSize: 'var(--font-size-xs)' }}>
                <span>✨</span>
                <span>AK Style Assistant is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '0.75rem',
              backgroundColor: '#161619',
              borderTop: '1px solid var(--border-silver)',
              display: 'flex',
              gap: '0.5rem'
            }}
          >
            <input
              type="text"
              id="chatbot-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('chatPlaceholder')}
              style={{
                flex: 1,
                backgroundColor: '#0F0F11',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: '#FFFFFF',
                padding: '0.55rem 0.75rem',
                fontSize: 'var(--font-size-xs)',
                outline: 'none'
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            />
            <button
              type="submit"
              id="chatbot-send-btn"
              disabled={loading || !inputMessage.trim()}
              style={{
                backgroundColor: 'var(--accent-gold)',
                color: '#0B0B0C',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.55rem 0.9rem',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !inputMessage.trim() ? 0.5 : 1
              }}
            >
              {t('chatSend')}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
