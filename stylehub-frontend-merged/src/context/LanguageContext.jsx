import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

const LANG_KEY = 'stylehub_lang';

export const translations = {
  en: {
    // Navigation
    home: 'HOME',
    shop: 'SHOP',
    categories: 'CATEGORIES',
    vton: 'VTON',
    wishlist: 'WISHLIST',
    friends: 'FRIENDS',
    purchases: 'PURCHASES',
    profile: 'PROFILE',
    adminDashboard: 'ADMIN DASHBOARD',
    login: 'LOGIN',
    register: 'REGISTER',
    logout: 'LOGOUT',

    // Hero & Home
    heroTagline: 'YOUR STYLE. YOUR FIT. YOUR CHOICE.',
    heroSubtitle: "Discover men's fashion, try selected clothing virtually, build complete looks and share your style with friends.",
    exploreCollection: 'EXPLORE COLLECTION',
    tryVirtualFitting: 'TRY VIRTUAL FITTING',
    platformHighlights: 'PLATFORM HIGHLIGHTS',
    highlightsSubtitle: 'Advanced Men\'s Fashion Experience',
    highlightsDesc: 'Engineered precision from local AI fitting to rule-based outfit curation and peer styling.',
    curatedCollection: 'CURATED COLLECTION',
    curatedSubtitle: 'Featured Menswear Essentials',
    viewAllProducts: 'VIEW ALL PRODUCTS',
    recentlyAccessed: 'RECENTLY ACCESSED',
    recentlyAccessedSubtitle: 'Your Recent Style Journey',
    recentlyAccessedEmpty: 'Your recently accessed products will appear here.',

    // Features
    feature1Title: 'AI VIRTUAL TRY-ON',
    feature1Desc: 'Upload your photo and see selected clothing on you using our local AI virtual fitting system.',
    feature2Title: 'COMPLETE THE LOOK',
    feature2Desc: 'Discover unique rule-based outfit combinations for selected tops and bottoms.',
    feature3Title: 'STYLE WITH FRIENDS',
    feature3Desc: 'Connect with friends via @username, share wishlists and looks privately, exchange style reactions.',
    feature4Title: 'PERSONAL WISHLIST',
    feature4Desc: 'Save favorite menswear pieces and share selected garments with your trusted circle.',
    feature5Title: 'DIRECT PURCHASE',
    feature5Desc: 'Buy single curated pieces or complete 4-piece coordinated looks with one-click direct checkout.',

    // Product Card & Detail
    viewPiece: 'VIEW PIECE',
    addToCart: 'ADD TO CART',
    buyNow: 'BUY NOW',
    buyCompleteLook: 'BUY COMPLETE LOOK',
    shareWithFriend: 'SHARE WITH FRIEND',
    inStock: 'IN STOCK',
    soldOut: 'SOLD OUT',
    off: 'OFF',
    complementaryPieces: 'COMPLEMENTARY PIECES',

    // Friends & Social
    findFriends: 'FIND FRIENDS',
    myFriends: 'MY FRIENDS',
    friendRequests: 'FRIEND REQUESTS',
    sentRequests: 'SENT REQUESTS',
    addFriend: 'ADD FRIEND',
    accept: 'ACCEPT',
    reject: 'REJECT',

    // Chatbot
    chatTitle: 'AK STYLE ASSISTANT',
    chatSubtitle: 'Deterministic Fashion AI Guide',
    chatPlaceholder: 'Ask about products, styling, VTON or shopping...',
    chatSend: 'SEND',

    // Settings & Notifications (Phase 11)
    settings: 'SETTINGS',
    appearance: 'APPEARANCE',
    theme: 'COLOR THEME',
    goldSilverTheme: 'AK Gold + Silver',
    midnightSilverTheme: 'Midnight Silver',
    blackChampagneTheme: 'Black + Champagne Gold',
    communicationPreferences: 'COMMUNICATION PREFERENCES',
    emailNotifications: 'Email Notifications',
    smsNotifications: 'SMS Notifications',
    whatsappNotifications: 'WhatsApp Notifications',
    accountDetails: 'ACCOUNT DETAILS',
    saveSettings: 'SAVE PREFERENCES',
    settingsSaved: 'Preferences Saved Successfully',
    notifications: 'NOTIFICATIONS',
    close: 'CLOSE',

    // Common
    loading: 'Loading...',
    price: 'Price',
    total: 'Total',
    language: 'Language'
  },
  ta: {
    // Navigation
    home: 'முகப்பு',
    shop: 'கடை',
    categories: 'வகைகள்',
    vton: 'மெய்நிகர் உடை',
    wishlist: 'விருப்பப்பட்டியல்',
    friends: 'நண்பர்கள்',
    purchases: 'கொள்முதல்',
    profile: 'சுயவிவரம்',
    adminDashboard: 'நிர்வாகப் பலகை',
    login: 'உள்நுழைவு',
    register: 'பதிவு',
    logout: 'வெளியேறு',

    // Hero & Home
    heroTagline: 'உங்கள் பாணி. உங்கள் பொருத்தம். உங்கள் தேர்வு.',
    heroSubtitle: 'ஆண்களுக்கான நவீன ஆடைகளைக் கண்டறியுங்கள், மெய்நிகராக முயற்சித்துப் பாருங்கள் மற்றும் நண்பர்களுடன் பகிருங்கள்.',
    exploreCollection: 'சேகரிப்பை ஆராயுங்கள்',
    tryVirtualFitting: 'மெய்நிகர் ஆடையை முயற்சிக்கவும்',
    platformHighlights: 'தளத்தின் சிறப்பம்சங்கள்',
    highlightsSubtitle: 'மேம்பட்ட ஆடவர் ஃபேஷன் அனுபவம்',
    highlightsDesc: 'உள்ளூர் AI பொருத்தம் மற்றும் தனித்துவமான ஆடை சேர்க்கை பரிந்துரைகள்.',
    curatedCollection: 'தேர்ந்தெடுக்கப்பட்ட தொகுப்பு',
    curatedSubtitle: 'பிரத்யேக ஆண்கள் ஆடைத் தேர்வுகள்',
    viewAllProducts: 'அனைத்து ஆடைகளையும் பார்க்க',
    recentlyAccessed: 'சமீபத்தில் பார்த்தவை',
    recentlyAccessedSubtitle: 'உங்கள் சமீபத்திய பாணித் தேர்வுகள்',
    recentlyAccessedEmpty: 'நீங்கள் சமீபத்தில் பார்த்த பொருட்கள் இங்கு தோன்றும்.',

    // Features
    feature1Title: 'AI மெய்நிகர் ஆடைப் பொருத்தம்',
    feature1Desc: 'உங்கள் புகைப்படத்தைப் பதிவேற்றி ஆடைகள் உங்களுக்கு எவ்வாறு பொருந்துகின்றன என்பதைப் பாருங்கள்.',
    feature2Title: 'முழுமையான தோற்றம்',
    feature2Desc: 'சட்டை மற்றும் கால்சட்டைக்கான முழுமையான பொருத்தமான ஆடைச் சேர்க்கைகள்.',
    feature3Title: 'நண்பர்களுடன் பாணி',
    feature3Desc: 'நண்பர்களுடன் இணைந்து ஆடைகளைப் பகிர்ந்து உடனடி கருத்துக்களைப் பெறுங்கள்.',
    feature4Title: 'தனிப்பட்ட விருப்பப்பட்டியல்',
    feature4Desc: 'உங்களுக்குப் பிடித்த ஆடைகளைச் சேமித்து நண்பர்களுடன் பகிருங்கள்.',
    feature5Title: 'நேரடி கொள்முதல்',
    feature5Desc: 'தனி ஆடை அல்லது 4 துண்டுகள் கொண்ட முழுத் தோற்றத்தை ஒரே கிளிக்கில் வாங்குங்கள்.',

    // Product Card & Detail
    viewPiece: 'ஆடையைப் பார்',
    addToCart: 'வண்டியில் சேர்',
    buyNow: 'இப்போதே வாங்கு',
    buyCompleteLook: 'முழு தோற்றத்தையும் வாங்கு',
    shareWithFriend: 'நண்பருடன் பகிர்',
    inStock: 'கையிருப்பில் உள்ளது',
    soldOut: 'விற்றுத் தீர்ந்தது',
    off: 'தள்ளுபடி',
    complementaryPieces: 'பொருந்தக்கூடிய ஆடைகள்',

    // Friends & Social
    findFriends: 'நண்பர்களைத் தேடு',
    myFriends: 'எனது நண்பர்கள்',
    friendRequests: 'நட்பு கோரிக்கைகள்',
    sentRequests: 'அனுப்பிய கோரிக்கைகள்',
    addFriend: 'நண்பராக சேர்',
    accept: 'ஏற்றுக்கொள்',
    reject: 'நிராகரி',

    // Chatbot
    chatTitle: 'AK பாணி உதவியாளர்',
    chatSubtitle: 'ஃபேஷன் AI வழிகாட்டி',
    chatPlaceholder: 'ஆடைகள், பாணி அல்லது ஷாப்பிங் பற்றி கேளுங்கள்...',
    chatSend: 'அனுப்பு',

    // Settings & Notifications (Phase 11)
    settings: 'அமைப்புகள்',
    appearance: 'தோற்றம்',
    theme: 'வண்ண தீம்',
    goldSilverTheme: 'AK தங்கம் + வெள்ளி',
    midnightSilverTheme: 'மிட்நைட் வெள்ளி',
    blackChampagneTheme: 'கருப்பு + ஷாம்பெயின் தங்கம்',
    communicationPreferences: 'தகவல் தொடர்பு விருப்பங்கள்',
    emailNotifications: 'மின்னஞ்சல் அறிவிப்புகள்',
    smsNotifications: 'குறுஞ்செய்தி (SMS) அறிவிப்புகள்',
    whatsappNotifications: 'வாட்ஸ்அப் அறிவிப்புகள்',
    accountDetails: 'கணக்கு விவரங்கள்',
    saveSettings: 'விருப்பங்களைச் சேமி',
    settingsSaved: 'விருப்பங்கள் வெற்றிகரமாகச் சேமிக்கப்பட்டன',
    notifications: 'அறிவிப்புகள்',
    close: 'மூடு',

    // Common
    loading: 'ஏற்றுகிறது...',
    price: 'விலை',
    total: 'மொத்தம்',
    language: 'மொழி'
  }
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem(LANG_KEY) || 'en';
  });

  useEffect(() => {
    localStorage.setItem(LANG_KEY, language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'ta' : 'en'));
  };

  const t = (key) => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
