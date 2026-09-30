import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchProductByIdApi,
  fetchRecommendationsApi,
  purchaseProductApi,
  purchaseComboApi,
  recordRecentlyAccessedApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import ShareWithFriendModal from '../components/ShareWithFriendModal';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState('display'); // 'display' | 'garment'
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState('');
  const [cartError, setCartError] = useState('');
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Social & Look Sharing State
  const [shareModalProducts, setShareModalProducts] = useState(null);
  const [shareModalType, setShareModalType] = useState('LOOK');
  const [shareSuccessMsg, setShareSuccessMsg] = useState('');
  const [lastSharedLookId, setLastSharedLookId] = useState(null);

  // Phase 8: Recommendations & Purchase State
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [comboRejected, setComboRejected] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [addressIncompleteModal, setAddressIncompleteModal] = useState(false);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState(null);

  useEffect(() => {
    async function loadProductAndRecommendations() {
      try {
        setLoading(true);
        setError('');
        const data = await fetchProductByIdApi(id);
        setProduct(data);
        setActiveImage('display');
        setQuantity(1);
        setComboRejected(false);
        setPurchaseError('');

        // Track Recently Accessed for authenticated user
        if (token && data?.id) {
          recordRecentlyAccessedApi(token, data.id).catch(trackErr => {
            console.warn('Recently accessed tracking notice:', trackErr.message);
          });
        }

        // Load Rule-Based Recommendations (Tops & Bottoms only)
        try {
          setRecsLoading(true);
          const recData = await fetchRecommendationsApi(id);
          if (recData.status === 'success' && recData.available) {
            setRecommendations(recData.recommendations || []);
          } else {
            setRecommendations([]);
          }
        } catch (recErr) {
          console.warn('Could not load recommendations:', recErr.message);
          setRecommendations([]);
        } finally {
          setRecsLoading(false);
        }

      } catch (err) {
        setError(err.message || 'Product could not be loaded from database.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadProductAndRecommendations();
    }
  }, [id]);

  const handleTryOn = () => {
    if (!product || !product.garment_image) return;
    navigate(`/virtual-try-on?productId=${product.id}&garmentImage=${encodeURIComponent(product.garment_image)}`);
  };

  const handleAddToCart = async () => {
    if (!product || isSoldOut || addingToCart) return;
    setAddingToCart(true);
    setCartSuccess('');
    setCartError('');
    try {
      await addToCart(product.id, quantity);
      setCartSuccess(`Added ${quantity} × "${product.name}" to your cart!`);
      setTimeout(() => setCartSuccess(''), 3000);
    } catch (err) {
      setCartError(err.message || 'Failed to add item to cart.');
      setTimeout(() => setCartError(''), 4000);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      await toggleWishlist(product.id);
    } catch (err) {
      alert(err.message || 'Failed to update wishlist.');
    } finally {
      setWishlistLoading(false);
    }
  };

  // Helper: Validate Delivery Address from user profile
  const isAddressComplete = () => {
    if (!user) return false;
    const name = user.fullName || user.full_name;
    return !!(
      name && String(name).trim() &&
      user.phone && String(user.phone).trim() &&
      user.address && String(user.address).trim() &&
      user.city && String(user.city).trim() &&
      user.state && String(user.state).trim() &&
      user.pincode && String(user.pincode).trim()
    );
  };

  // Single Product Purchase Handler
  const handlePurchaseSingle = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!isAddressComplete()) {
      setAddressIncompleteModal(true);
      return;
    }

    if (!product || isSoldOut || purchasing) return;

    setPurchasing(true);
    setPurchaseError('');

    try {
      const res = await purchaseProductApi(token, product.id, 1);
      if (res.status === 'success') {
        setPurchaseSuccessData({ ...res.purchase, notifications: res.notifications });
        // Deduct local product stock by strictly 1
        setProduct(prev => ({
          ...prev,
          stock: Math.max(0, prev.stock - 1),
          status: prev.stock - 1 <= 0 ? 'SOLD_OUT' : 'IN_STOCK'
        }));
      }
    } catch (err) {
      if (err.code === 'ADDRESS_INCOMPLETE') {
        setAddressIncompleteModal(true);
      } else {
        setPurchaseError(err.message || 'Failed to complete purchase.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  // Complete Outfit Combo Purchase Handler
  const handlePurchaseCombo = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!isAddressComplete()) {
      setAddressIncompleteModal(true);
      return;
    }

    if (!product || isSoldOut || purchasing) return;

    const allComboProductIds = [product.id, ...recommendations.map(r => r.product.id)];

    setPurchasing(true);
    setPurchaseError('');

    try {
      const res = await purchaseComboApi(token, allComboProductIds);
      if (res.status === 'success') {
        setPurchaseSuccessData({ ...res.purchase, notifications: res.notifications });
        // Deduct local product stock
        setProduct(prev => ({
          ...prev,
          stock: Math.max(0, prev.stock - 1),
          status: prev.stock - 1 <= 0 ? 'SOLD_OUT' : 'IN_STOCK'
        }));
      }
    } catch (err) {
      if (err.code === 'ADDRESS_INCOMPLETE') {
        setAddressIncompleteModal(true);
      } else {
        setPurchaseError(err.message || 'One or more products in this outfit are currently out of stock.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
        Loading product details from AK's MEN STYLE...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#f87171' }}>⚠️</div>
        <h3 style={{ marginBottom: '0.75rem', color: '#f87171' }}>Product Not Found</h3>
        <p style={{ marginBottom: '1.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          {error || `No catalog item found with ID: ${id}`}
        </p>
        <Link to="/products" className="btn btn-primary">
          Return to AK's MEN STYLE Collection
        </Link>
      </div>
    );
  }

  const isSoldOut = product.stock === 0 || product.status === 'SOLD_OUT';
  const stockText = isSoldOut ? 'OUT OF STOCK' : (product.stock === 1 ? '1 left' : `${product.stock} left`);
  const inWishlist = isInWishlist(product.id);

  // Combo calculations
  const comboAvailable = recommendations.length > 0 && !comboRejected;
  const comboItems = [
    { ...product, slotName: 'Anchor' },
    ...recommendations.map(r => ({ ...r.product, slotName: r.slot, reason: r.reason }))
  ];
  const comboSubtotal = comboItems.reduce((acc, it) => acc + it.price, 0);
  const comboOriginalTotal = comboItems.reduce((acc, it) => acc + it.original_price, 0);
  const comboSavings = Math.max(0, comboOriginalTotal - comboSubtotal);

  const handleShareComboWithFriend = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const comboProducts = [
      { id: product.id, productId: product.id, name: product.name, image: product.image, price: product.price },
      ...recommendations.map(r => ({
        id: r.product.id,
        productId: r.product.id,
        name: r.product.name,
        image: r.product.image,
        price: r.product.price
      }))
    ];
    setShareModalType('LOOK');
    setShareModalProducts(comboProducts);
  };

  const handleShareSingleWithFriend = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShareModalType('PRODUCTS');
    setShareModalProducts([
      { id: product.id, productId: product.id, name: product.name, image: product.image, price: product.price }
    ]);
  };

  const handleShareSuccess = (res, friend) => {
    const shareId = res.data?.shareId || res.shareId;
    setShareModalProducts(null);
    setLastSharedLookId(shareId);
    setShareSuccessMsg(`Look shared privately with @${friend?.username || 'friend'}!`);
  };

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
        <Link to="/products" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          AK's MEN STYLE
        </Link>
        <span>/</span>
        <Link to={`/products?category=${encodeURIComponent(product.category)}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          {product.category}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.name}</span>
      </div>

      {/* Share Success Alert */}
      {shareSuccessMsg && (
        <div style={{
          padding: '0.85rem 1.25rem',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--accent-green)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent-green)',
          fontSize: 'var(--font-size-sm)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>✓ {shareSuccessMsg}</span>
          {lastSharedLookId && (
            <Link
              to={`/shared-wishlist/${lastSharedLookId}`}
              className="btn btn-primary"
              style={{ fontSize: '11px', padding: '0.35rem 0.75rem', backgroundColor: 'var(--accent-green)', color: '#000', fontWeight: 700 }}
            >
              View Shared Look →
            </Link>
          )}
        </div>
      )}

      {/* Main Product Layout */}
      <div className="card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
          
          {/* Left Column: Product Photography & Image Gallery */}
          <div>
            {/* Main Image Display */}
            <div style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: '#14171d',
              border: '1px solid var(--border-color)',
              position: 'relative',
              boxShadow: 'var(--shadow-card)',
              paddingTop: '120%'
            }}>
              <img
                src={activeImage === 'garment' && product.garment_image ? product.garment_image : product.image}
                alt={product.name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#12151b'
                }}
              />

              {/* Stock Status Badge */}
              <span style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSoldOut ? 'rgba(239, 68, 68, 0.95)' : (product.stock <= 3 ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0, 0, 0, 0.75)'),
                color: '#ffffff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}>
                {stockText}
              </span>

              {/* Image Type Tag */}
              <span style={{
                position: 'absolute',
                bottom: '14px',
                left: '14px',
                fontSize: '10px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(24, 28, 36, 0.85)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                {activeImage === 'display' ? '📸 Product Display Photo' : '✨ Clean Isolated Garment (VTON)'}
              </span>
            </div>

            {/* Thumbnail Gallery */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setActiveImage('display')}
                style={{
                  width: '64px',
                  height: '80px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  border: activeImage === 'display' ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  backgroundColor: '#14171d',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: activeImage === 'display' ? 1 : 0.6,
                  transition: 'var(--transition-smooth)'
                }}
                title="View Product Display Photo"
              >
                <img
                  src={product.image}
                  alt={`${product.name} display`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>

              {product.garment_image && (
                <button
                  type="button"
                  onClick={() => setActiveImage('garment')}
                  style={{
                    width: '64px',
                    height: '80px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: activeImage === 'garment' ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                    backgroundColor: '#14171d',
                    padding: 0,
                    cursor: 'pointer',
                    opacity: activeImage === 'garment' ? 1 : 0.6,
                    transition: 'var(--transition-smooth)'
                  }}
                  title="View Isolated Garment Asset"
                >
                  <img
                    src={product.garment_image}
                    alt={`${product.name} garment`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Product Metadata, Specifications & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Brand & Category */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
                {product.brand}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Item #{product.id} • {product.category}
              </span>
            </div>

            {/* Product Title */}
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', lineHeight: 1.25 }}>
              {product.name}
            </h1>

            {/* Sub-label */}
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {product.cloth_type} in {product.color}
            </p>

            {/* Pricing Card */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{product.price}
              </span>
              {product.original_price > product.price && (
                <span style={{ fontSize: 'var(--font-size-base)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                  ₹{product.original_price}
                </span>
              )}
              {product.discount_percent > 0 ? (
                <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700 }}>
                  {product.discount_percent}% OFF
                </span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', padding: '3px 8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)' }}>
                  NO OFFER
                </span>
              )}
            </div>

            {/* Product Specifications Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: 'var(--font-size-xs)'
            }}>
              <div style={{ padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Style / Cut</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.cloth_type}</span>
              </div>
              <div style={{ padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Color Tone</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.color}</span>
              </div>
              <div style={{ padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Availability</span>
                <span style={{ color: isSoldOut ? '#f87171' : 'var(--accent-green)', fontWeight: 600 }}>
                  {isSoldOut ? 'Sold Out' : `${product.stock} units available`}
                </span>
              </div>
              <div style={{ padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>AI Try-On</span>
                <span style={{ color: product.vton_supported === 1 ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {product.vton_supported === 1 ? 'Supported (FASHN)' : 'Not Supported'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Overview
              </h4>
              <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {product.description || `Premium quality ${product.cloth_type.toLowerCase()} by ${product.brand}. Crafted with precision for the modern man.`}
              </p>
            </div>

            {/* Quantity Selector */}
            {!isSoldOut && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  QUANTITY:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    -
                  </button>
                  <span style={{ padding: '0.4rem 1rem', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: quantity >= product.stock ? 'not-allowed' : 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    +
                  </button>
                </div>
                {quantity >= product.stock && (
                  <span style={{ fontSize: '11px', color: 'var(--accent-gold)' }}>
                    Max available ({product.stock})
                  </span>
                )}
              </div>
            )}

            {/* Feedback & Error Notifications */}
            {cartSuccess && (
              <div style={{ padding: '0.65rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '1rem' }}>
                ✓ {cartSuccess}
              </div>
            )}
            {cartError && (
              <div style={{ padding: '0.65rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '1rem' }}>
                ⚠️ {cartError}
              </div>
            )}
            {purchaseError && (
              <div style={{ padding: '0.65rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '1rem' }}>
                ⚠️ {purchaseError}
              </div>
            )}

            {/* Action Buttons Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
              
              {/* PRIMARY ACTION: PURCHASE NOW */}
              <button
                type="button"
                id="buy-product-btn"
                disabled={isSoldOut || purchasing}
                onClick={handlePurchaseSingle}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  backgroundColor: isSoldOut ? 'transparent' : 'var(--accent-gold)',
                  color: isSoldOut ? 'var(--text-muted)' : '#0d0f12',
                  border: isSoldOut ? '1px solid var(--border-color)' : 'none',
                  cursor: isSoldOut ? 'not-allowed' : 'pointer',
                  boxShadow: isSoldOut ? 'none' : '0 4px 14px rgba(217, 119, 6, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>⚡</span>
                <span>{purchasing ? 'PROCESSING PURCHASE...' : (isSoldOut ? 'OUT OF STOCK' : 'PURCHASE NOW')}</span>
              </button>

              {/* VTON Try On Button (if supported) */}
              {product.vton_supported === 1 && (
                <button
                  type="button"
                  onClick={handleTryOn}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontWeight: 700,
                    borderColor: 'rgba(217, 119, 6, 0.4)',
                    color: 'var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>✨</span>
                  <span>TRY THIS ON</span>
                </button>
              )}

              {/* Secondary Actions: Add to Cart & Wishlist */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSoldOut || addingToCart}
                  onClick={handleAddToCart}
                  style={{
                    flex: 2,
                    padding: '0.75rem 1rem',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    opacity: isSoldOut ? 0.4 : 1,
                    cursor: isSoldOut ? 'not-allowed' : 'pointer',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {addingToCart ? 'ADDING...' : 'ADD TO CART'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={wishlistLoading}
                  onClick={handleToggleWishlist}
                  title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                  style={{
                    flex: 1,
                    padding: '0.75rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderColor: inWishlist ? 'var(--accent-gold)' : 'var(--border-color)',
                    color: inWishlist ? 'var(--accent-gold)' : 'var(--text-primary)'
                  }}
                >
                  {inWishlist ? '♥ SAVED' : '♡ WISHLIST'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleShareSingleWithFriend}
                  title="Share this piece privately with a friend"
                  style={{
                    flex: 1,
                    padding: '0.75rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>👥</span> SHARE
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* PHASE 8: COMPLETE THE LOOK / RECOMMENDED OUTFIT SECTION */}
      {/* ======================================================== */}
      {recommendations.length > 0 && (
        <div className="card" style={{ padding: '2rem', marginBottom: '2.5rem', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '1.25rem' }}>✨</span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
                  COMPLETE THE LOOK
                </h2>
                <span className="badge" style={{ backgroundColor: 'rgba(217, 119, 6, 0.2)', color: 'var(--accent-gold)', border: '1px solid rgba(217, 119, 6, 0.4)' }}>
                  CURATED OUTFIT
                </span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                Rule-based fashion styling tailored specifically to pair with {product.name}.
              </p>
            </div>

            {/* Toggle / Rejection Control */}
            <div>
              {comboRejected ? (
                <button
                  type="button"
                  onClick={() => setComboRejected(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '0.4rem 0.8rem' }}
                >
                  + Show Curated Look
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setComboRejected(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '0.4rem 0.8rem', color: 'var(--text-muted)' }}
                  title="Hide combo recommendation and buy anchor item only"
                >
                  ✕ NOT INTERESTED (BUY THIS PRODUCT ONLY)
                </button>
              )}
            </div>
          </div>

          {!comboRejected && (
            <div>
              {/* Outfit Pieces Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
              }}>
                {/* 1. Anchor Product */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-gold)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    backgroundColor: 'var(--accent-gold)',
                    color: '#000',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    ANCHOR PIECE
                  </span>
                  <div style={{ width: '100%', paddingTop: '100%', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', backgroundColor: '#14171d' }}>
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 0.25rem', lineHeight: 1.3 }}>{product.name}</h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{product.category} • {product.color}</div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem' }}>₹{product.price}</span>
                    <span style={{ fontSize: '11px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>₹{product.original_price}</span>
                  </div>
                </div>

                {/* 2. Recommended Compatible Products */}
                {recommendations.map((rec) => (
                  <div
                    key={rec.product.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-secondary)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      + {rec.slot.toUpperCase()}
                    </span>

                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: rec.product.stock <= 2 ? '#f59e0b' : 'var(--accent-green)'
                    }}>
                      {rec.product.stock} in stock
                    </span>

                    <div style={{ width: '100%', paddingTop: '100%', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', backgroundColor: '#14171d' }}>
                      <img
                        src={rec.product.image}
                        alt={rec.product.name}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <Link
                      to={`/products/${rec.product.id}`}
                      style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 0.25rem', lineHeight: 1.3, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {rec.product.name}
                    </Link>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      {rec.product.category} • {rec.product.color}
                    </div>

                    {/* Rule-Based Fashion Reason */}
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--accent-gold)',
                      lineHeight: 1.35,
                      marginBottom: '0.75rem',
                      fontStyle: 'italic',
                      backgroundColor: 'rgba(217, 119, 6, 0.05)',
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      "{rec.reason}"
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem' }}>₹{rec.product.price}</span>
                      <span style={{ fontSize: '11px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>₹{rec.product.original_price}</span>
                      {rec.product.discount_percent > 0 && (
                        <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 4px' }}>
                          {rec.product.discount_percent}% OFF
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Combo Summary & Purchase Actions */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem'
              }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Complete Outfit Package ({comboItems.length} curated pieces)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                      ₹{comboSubtotal}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      ₹{comboOriginalTotal}
                    </span>
                    {comboSavings > 0 && (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                        Save ₹{comboSavings} on Complete Look
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setComboRejected(true)}
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}
                  >
                    BUY THIS PRODUCT ONLY
                  </button>

                  <button
                    type="button"
                    onClick={handleShareComboWithFriend}
                    className="btn btn-outline"
                    title="Share this complete 4-piece outfit combo privately with a friend"
                    style={{
                      padding: '0.85rem 1.4rem',
                      fontWeight: 700,
                      fontSize: 'var(--font-size-sm)',
                      borderColor: 'var(--accent-gold)',
                      color: 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>👥</span>
                    <span>SHARE THIS LOOK WITH FRIEND</span>
                  </button>

                  <button
                    type="button"
                    id="buy-combo-btn"
                    disabled={isSoldOut || purchasing}
                    onClick={handlePurchaseCombo}
                    className="btn btn-primary"
                    style={{
                      padding: '0.85rem 1.75rem',
                      fontWeight: 800,
                      fontSize: 'var(--font-size-base)',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#0d0f12',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>✨</span>
                    <span>{purchasing ? 'PROCESSING OUTFIT...' : 'PURCHASE COMPLETE OUTFIT'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADDRESS INCOMPLETE VALIDATION MODAL              */}
      {/* ======================================================== */}
      {addressIncompleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid #f59e0b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
            <h3 style={{ marginBottom: '0.5rem', color: '#f59e0b' }}>Delivery Address Incomplete</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              Please complete your delivery address in Profile before purchasing.
              We require your Full Name, Phone, Address, City, State, and Pincode to confirm delivery to owner.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAddressIncompleteModal(false)}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: 'var(--accent-gold)', color: '#000', fontWeight: 700 }}
              >
                UPDATE PROFILE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: PURCHASE SUCCESS CONFIRMATION MODAL             */}
      {/* ======================================================== */}
      {purchaseSuccessData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', border: '2px solid var(--accent-gold)', boxShadow: '0 8px 30px rgba(217, 119, 6, 0.3)' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '3.5rem', color: 'var(--accent-green)', marginBottom: '0.5rem' }}>
                ✓
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem', letterSpacing: '0.04em' }}>
                PURCHASE SUCCESSFUL
              </h2>
              <p style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: '0 0 0.5rem' }}>
                Your purchase has been confirmed.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', margin: 0 }}>
                Your selected {purchaseSuccessData.purchase_type === 'COMBO' ? 'outfit combo' : 'product'} will be delivered to the owner at the saved address.
              </p>
            </div>

            {/* Delivery Destination Snapshot */}
            <div style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.75rem',
              fontSize: 'var(--font-size-xs)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                    DELIVERY OWNER
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                    {purchaseSuccessData.delivery_name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {purchaseSuccessData.delivery_phone}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                    DELIVERY ADDRESS
                  </span>
                  <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {purchaseSuccessData.delivery_address}<br />
                    {purchaseSuccessData.delivery_city}, {purchaseSuccessData.delivery_state} - {purchaseSuccessData.delivery_pincode}
                  </div>
                </div>
              </div>
            </div>

            {/* Purchased Items List */}
            <div style={{ marginBottom: '1.75rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                {purchaseSuccessData.purchase_type === 'COMBO' ? 'PURCHASED OUTFIT' : 'PURCHASED PRODUCT'}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {purchaseSuccessData.items?.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img
                        src={it.product_image}
                        alt={it.product_name}
                        style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          {it.product_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Qty: {it.quantity} × ₹{it.unit_price}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                      ₹{it.line_total || (it.quantity * it.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderTop: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL PAID</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                ₹{purchaseSuccessData.total_amount}
              </span>
            </div>

            {/* Communication Notifications Status (Part U) */}
            {purchaseSuccessData.notifications && (
              <div style={{
                padding: '1.15rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.75rem'
              }}>
                <span style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  display: 'block',
                  marginBottom: '0.75rem'
                }}>
                  COMMUNICATION NOTIFICATIONS
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  {/* Email */}
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '3px' }}>✉️ Email</div>
                    <div style={{
                      fontWeight: 700,
                      color: purchaseSuccessData.notifications.email?.status === 'SENT' ? 'var(--accent-green)' :
                             purchaseSuccessData.notifications.email?.status === 'DISABLED' ? 'var(--text-muted)' :
                             purchaseSuccessData.notifications.email?.status === 'FAILED' ? 'var(--accent-red)' : 'var(--text-secondary)'
                    }}>
                      {purchaseSuccessData.notifications.email?.status === 'SENT' ? '✓ Sent' :
                       purchaseSuccessData.notifications.email?.status === 'DISABLED' ? 'Disabled' :
                       purchaseSuccessData.notifications.email?.status === 'NOT_CONFIGURED' ? 'Not Configured' :
                       purchaseSuccessData.notifications.email?.status || 'Not Configured'}
                    </div>
                  </div>

                  {/* SMS */}
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '3px' }}>📱 SMS</div>
                    <div style={{
                      fontWeight: 700,
                      color: purchaseSuccessData.notifications.sms?.status === 'SENT' ? 'var(--accent-green)' :
                             purchaseSuccessData.notifications.sms?.status === 'DISABLED' ? 'var(--text-muted)' :
                             purchaseSuccessData.notifications.sms?.status === 'FAILED' ? 'var(--accent-red)' : 'var(--text-secondary)'
                    }}>
                      {purchaseSuccessData.notifications.sms?.status === 'SENT' ? '✓ Sent' :
                       purchaseSuccessData.notifications.sms?.status === 'DISABLED' ? 'Disabled' :
                       purchaseSuccessData.notifications.sms?.status === 'NOT_CONFIGURED' ? 'Not Configured' :
                       purchaseSuccessData.notifications.sms?.status || 'Not Configured'}
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '3px' }}>💬 WhatsApp</div>
                    <div style={{
                      fontWeight: 700,
                      color: purchaseSuccessData.notifications.whatsapp?.status === 'SENT' ? 'var(--accent-green)' :
                             purchaseSuccessData.notifications.whatsapp?.status === 'DISABLED' ? 'var(--text-muted)' :
                             purchaseSuccessData.notifications.whatsapp?.status === 'FAILED' ? 'var(--accent-red)' : 'var(--text-secondary)'
                    }}>
                      {purchaseSuccessData.notifications.whatsapp?.status === 'SENT' ? '✓ Sent' :
                       purchaseSuccessData.notifications.whatsapp?.status === 'DISABLED' ? 'Disabled' :
                       purchaseSuccessData.notifications.whatsapp?.status === 'NOT_CONFIGURED' ? 'Not Configured' :
                       purchaseSuccessData.notifications.whatsapp?.status || 'Not Configured'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPurchaseSuccessData(null)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.75rem' }}
              >
                CONTINUE SHOPPING
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseSuccessData(null);
                  navigate('/purchases');
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--accent-gold)', color: '#000', fontWeight: 700 }}
              >
                VIEW PURCHASES
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Share with Friend Modal */}
      {shareModalProducts && (
        <ShareWithFriendModal
          selectedProducts={shareModalProducts}
          shareType={shareModalType}
          onClose={() => setShareModalProducts(null)}
          onShareSuccess={handleShareSuccess}
        />
      )}

    </div>
  );
}
