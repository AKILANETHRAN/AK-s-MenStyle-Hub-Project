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
    cart: 'CART',
    myCart: 'MY CART',
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
    cart: 'கார்ட்',
    myCart: 'என் கார்ட்',
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
  },
  hi: {
    // Navigation
    home: 'होम',
    shop: 'दुकान',
    categories: 'श्रेणियाँ',
    vton: 'वर्चुअल ट्राय-ऑन',
    wishlist: 'विशलिस्ट',
    cart: 'कार्ट',
    myCart: 'मेरा कार्ट',
    friends: 'दोस्त',
    purchases: 'खरीदारी',
    profile: 'प्रोफ़ाइल',
    adminDashboard: 'एडमिन डैशबोर्ड',
    login: 'लॉग इन',
    register: 'रजिस्टर',
    logout: 'लॉग आउट',

    // Hero & Home
    heroTagline: 'आपका स्टाइल। आपकी फिट। आपकी पसंद।',
    heroSubtitle: 'पुरुषों के फैशन को खोजें, चुने हुए कपड़ों को वर्चुअल रूप से पहनकर देखें और अपना स्टाइल दोस्तों के साथ साझा करें।',
    exploreCollection: 'कलेक्शन देखें',
    tryVirtualFitting: 'वर्चुअल फिटिंग आज़माएँ',
    platformHighlights: 'प्लेटफ़ॉर्म की खासियतें',
    highlightsSubtitle: 'उन्नत पुरुष फैशन अनुभव',
    highlightsDesc: 'स्थानीय AI फिटिंग, नियम-आधारित आउटफिट सुझाव और स्टाइलिंग के साथ सटीक अनुभव।',
    curatedCollection: 'चुना हुआ कलेक्शन',
    curatedSubtitle: 'विशेष पुरुष परिधान',
    viewAllProducts: 'सभी उत्पाद देखें',
    recentlyAccessed: 'हाल ही में देखे गए',
    recentlyAccessedSubtitle: 'आपकी हाल की स्टाइल यात्रा',
    recentlyAccessedEmpty: 'आपके हाल ही में देखे गए उत्पाद यहाँ दिखाई देंगे।',

    // Features
    feature1Title: 'AI वर्चुअल ट्राय-ऑन',
    feature1Desc: 'अपनी फोटो अपलोड करें और स्थानीय AI वर्चुअल फिटिंग से चुने हुए कपड़ों को खुद पर देखें।',
    feature2Title: 'लुक पूरा करें',
    feature2Desc: 'चुनी हुई शर्ट और पैंट के लिए नियम-आधारित आउटफिट संयोजन खोजें।',
    feature3Title: 'दोस्तों के साथ स्टाइल करें',
    feature3Desc: '@username से दोस्तों से जुड़ें, विशलिस्ट और लुक निजी रूप से साझा करें और प्रतिक्रिया पाएँ।',
    feature4Title: 'व्यक्तिगत विशलिस्ट',
    feature4Desc: 'अपने पसंदीदा पुरुष परिधान सहेजें और चुने हुए कपड़े अपने भरोसेमंद लोगों के साथ साझा करें।',
    feature5Title: 'सीधी खरीदारी',
    feature5Desc: 'एकल परिधान या पूरा 4-पीस कोऑर्डिनेटेड लुक एक क्लिक में खरीदें।',

    // Product Card & Detail
    viewPiece: 'परिधान देखें',
    addToCart: 'कार्ट में जोड़ें',
    buyNow: 'अभी खरीदें',
    buyCompleteLook: 'पूरा लुक खरीदें',
    shareWithFriend: 'दोस्त के साथ साझा करें',
    inStock: 'स्टॉक में',
    soldOut: 'स्टॉक खत्म',
    off: 'छूट',
    complementaryPieces: 'मेल खाते परिधान',

    // Friends & Social
    findFriends: 'दोस्त खोजें',
    myFriends: 'मेरे दोस्त',
    friendRequests: 'दोस्ती के अनुरोध',
    sentRequests: 'भेजे गए अनुरोध',
    addFriend: 'दोस्त जोड़ें',
    accept: 'स्वीकार करें',
    reject: 'अस्वीकार करें',

    // Chatbot
    chatTitle: 'AK स्टाइल असिस्टेंट',
    chatSubtitle: 'फैशन AI गाइड',
    chatPlaceholder: 'उत्पादों, स्टाइलिंग, VTON या खरीदारी के बारे में पूछें...',
    chatSend: 'भेजें',

    // Settings & Notifications (Phase 11)
    settings: 'सेटिंग्स',
    appearance: 'दिखावट',
    theme: 'रंग थीम',
    goldSilverTheme: 'AK गोल्ड + सिल्वर',
    midnightSilverTheme: 'मिडनाइट सिल्वर',
    blackChampagneTheme: 'ब्लैक + शैम्पेन गोल्ड',
    communicationPreferences: 'संचार प्राथमिकताएँ',
    emailNotifications: 'ईमेल सूचनाएँ',
    smsNotifications: 'SMS सूचनाएँ',
    whatsappNotifications: 'व्हाट्सऐप सूचनाएँ',
    accountDetails: 'खाते का विवरण',
    saveSettings: 'प्राथमिकताएँ सहेजें',
    settingsSaved: 'प्राथमिकताएँ सफलतापूर्वक सहेजी गईं',
    notifications: 'सूचनाएँ',
    close: 'बंद करें',

    // Common
    loading: 'लोड हो रहा है...',
    price: 'कीमत',
    total: 'कुल',
    language: 'भाषा'
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
    const languages = ['en', 'ta', 'hi'];
    setLanguage(prev => languages[(languages.indexOf(prev) + 1) % languages.length]);
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
