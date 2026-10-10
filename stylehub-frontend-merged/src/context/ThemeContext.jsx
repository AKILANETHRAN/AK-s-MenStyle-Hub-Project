import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const THEME_KEY = 'aks_theme';

export const THEMES = [
  {
    id: 'gold-silver',
    name: 'AK Gold + Silver',
    subtitle: 'Classic Black & Warm Metallic Gold',
    badge: 'DEFAULT',
    colors: ['#0B0B0C', '#D4AF37', '#CBD5E1']
  },
  {
    id: 'midnight-silver',
    name: 'Midnight Silver',
    subtitle: 'Deep Obsidian & High-Sheen Platinum',
    badge: 'LUXURY',
    colors: ['#08090C', '#E2E8F0', '#94A3B8']
  },
  {
    id: 'black-champagne',
    name: 'Black + Champagne Gold',
    subtitle: 'Matte Charcoal & Soft Champagne',
    badge: 'PREMIUM',
    colors: ['#050505', '#F1E5AC', '#D1C7B7']
  }
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
    return 'gold-silver';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme) => {
    if (THEMES.some(t => t.id === newTheme)) {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
