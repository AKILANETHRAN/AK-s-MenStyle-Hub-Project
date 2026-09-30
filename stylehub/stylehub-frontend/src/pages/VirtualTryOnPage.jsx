import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { fetchProductByIdApi } from '../services/api';
import { executeTryOnApi, fetchVtonStatus } from '../services/vtonService';
import { useAuth } from '../context/AuthContext';

export default function VirtualTryOnPage() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId');
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();

  // State
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productError, setProductError] = useState('');

  const [userPhoto, setUserPhoto] = useState(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [generationError, setGenerationError] = useState('');
  const [serviceStatus, setServiceStatus] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch product and service health on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // Check local Flask VTON status
      try {
        const status = await fetchVtonStatus();
        if (isMounted) setServiceStatus(status);
      } catch (e) {
        if (isMounted) setServiceStatus({ available: false });
      }

      if (!productId) {
        if (isMounted) {
          setLoadingProduct(false);
          setProductError('No product selected for Virtual Try-On.');
        }
        return;
      }

      try {
        setLoadingProduct(true);
        const data = await fetchProductByIdApi(productId);
        if (!isMounted) return;

        if (data.vton_supported !== 1) {
          setProductError('Virtual try-on is not available for this product.');
        } else if (!data.garment_image) {
          setProductError('The selected garment is currently unavailable for virtual try-on.');
        } else {
          setProduct(data);
          setProductError('');
        }
      } catch (err) {
        if (isMounted) setProductError('Selected product could not be found.');
      } finally {
        if (isMounted) setLoadingProduct(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Clean up object URLs on unmount or change
  useEffect(() => {
    return () => {
      if (userPhotoPreview) {
        URL.revokeObjectURL(userPhotoPreview);
      }
    };
  }, [userPhotoPreview]);

  // Handle Photo File Selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setGenerationError('');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setPhotoError('Please upload a valid JPG, PNG, or WebP image.');
      return;
    }

    if (file.size === 0) {
      setPhotoError('Please upload a valid, non-empty image.');
      return;
    }

    if (userPhotoPreview) {
      URL.revokeObjectURL(userPhotoPreview);
    }

    setUserPhoto(file);
    setUserPhotoPreview(URL.createObjectURL(file));
  };

  const triggerFileInput = () => {
    if (isGenerating) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Generate Virtual Try-On
  const handleGenerate = async () => {
    if (isGenerating) return;

    if (!isAuthenticated) {
      setGenerationError('Please sign in to generate your virtual try-on.');
      return;
    }

    if (!userPhoto) {
      setGenerationError('Please upload your photo first.');
      return;
    }

    if (!product || product.vton_supported !== 1) {
      setGenerationError('Virtual try-on is not available for this product.');
      return;
    }

    if (!product.garment_image) {
      setGenerationError('The selected garment is currently unavailable for virtual try-on.');
      return;
    }

    setIsGenerating(true);
    setGenerationError('');

    try {
      const data = await executeTryOnApi(token, product.id, userPhoto);
      setGeneratedResult(data);
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('Another virtual try-on')) {
        setGenerationError('Another virtual try-on is currently being generated. Please wait.');
      } else if (errMsg.includes('unavailable') || errMsg.includes('Failed to fetch')) {
        setGenerationError('Virtual try-on service is currently unavailable.');
      } else if (errMsg.includes('timeout') || errMsg.includes('too long')) {
        setGenerationError('The AI try-on took too long to complete. Please try again.');
      } else {
        setGenerationError(errMsg || 'Virtual try-on could not be generated. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Generated Result
  const handleDownloadResult = async () => {
    if (!generatedResult?.result_url) return;

    try {
      const response = await fetch(generatedResult.result_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `aks-men-style-virtual-tryon-product-${product?.id || 'result'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback direct download
      const link = document.createElement('a');
      link.href = generatedResult.result_url;
      link.download = `aks-men-style-virtual-tryon-product-${product?.id || 'result'}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Try Another Photo (preserves selected product)
  const handleTryAnotherPhoto = () => {
    setGeneratedResult(null);
    setUserPhoto(null);
    if (userPhotoPreview) {
      URL.revokeObjectURL(userPhotoPreview);
    }
    setUserPhotoPreview(null);
    setGenerationError('');
    setPhotoError('');
  };

  // Try Another Product
  const handleTryAnotherProduct = () => {
    navigate('/products');
  };

  const isGenerateDisabled =
    isGenerating ||
    !userPhoto ||
    !product ||
    product.vton_supported !== 1 ||
    !product.garment_image;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem 0 4rem' }}>
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span className="badge" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}>
            ✨ FASHN VTON v1.5 • CUDA ACCELERATED
          </span>
          {serviceStatus?.device && (
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              ● {serviceStatus.device} Online
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          AI VIRTUAL FITTING ROOM
        </h1>
        <p style={{ maxWidth: '620px', margin: '0 auto', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Upload your photo to realistically see yourself wearing this exact clothing product.
        </p>

        {/* Step Flow Indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginTop: '1.25rem',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)'
        }}>
          <span style={{ color: userPhoto ? 'var(--accent-green)' : 'var(--text-primary)', fontWeight: 600 }}>
            📷 STEP 1: YOUR PHOTO
          </span>
          <span>→</span>
          <span style={{ color: product ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
            👕 STEP 2: SELECTED GARMENT
          </span>
          <span>→</span>
          <span style={{ color: isGenerating ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: 600 }}>
            ✨ GENERATE VIRTUAL TRY-ON
          </span>
          <span>→</span>
          <span style={{ color: generatedResult ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: 600 }}>
            🎯 STEP 3: AI GENERATED RESULT
          </span>
        </div>
      </div>

      {/* Global Alerts / Errors */}
      {productError && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem', borderColor: '#ef4444' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Notice</h3>
          <p style={{ marginBottom: '1.5rem' }}>{productError}</p>
          <Link to="/products" className="btn btn-primary">
            Browse VTON-Ready Products (1–50)
          </Link>
        </div>
      )}

      {generationError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem 1.25rem',
          color: '#fca5a5',
          marginBottom: '1.75rem',
          fontSize: 'var(--font-size-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <strong>Error: </strong> {generationError}
          </div>
          <button
            onClick={() => setGenerationError('')}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Fitting Room Grid (Step 1 & Step 2) */}
      {product && !productError && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.75rem',
            marginBottom: '2rem'
          }}>
            {/* ================================================== */}
            {/* STEP 1 — YOUR PHOTO                                */}
            {/* ================================================== */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    STEP 1
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>YOUR PHOTO</h3>
                </div>
                {userPhoto && (
                  <span className="badge badge-success">✓ Ready</span>
                )}
              </div>

              {/* Upload Input Area */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                id="vton-user-photo-upload"
              />

              {!userPhotoPreview ? (
                <div
                  onClick={triggerFileInput}
                  style={{
                    flex: 1,
                    minHeight: '340px',
                    border: '2px dashed rgba(255, 255, 255, 0.18)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)')}
                >
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(197, 168, 128, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    marginBottom: '1rem'
                  }}>
                    📷
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginBottom: '0.75rem', pointerEvents: 'none' }}
                  >
                    📷 UPLOAD YOUR PHOTO
                  </button>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
                    Use a clear full-body or well-framed photo for better virtual try-on results.
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    Supports JPG, JPEG, PNG, WEBP (Max 15MB)
                  </span>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    width: '100%',
                    height: '340px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    backgroundColor: '#0a0c10',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem'
                  }}>
                    <img
                      src={userPhotoPreview}
                      alt="User Source Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={isGenerating}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                  >
                    CHANGE PHOTO
                  </button>
                </div>
              )}

              {photoError && (
                <p style={{ color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: '0.5rem' }}>
                  {photoError}
                </p>
              )}
            </div>

            {/* ================================================== */}
            {/* STEP 2 — SELECTED GARMENT                          */}
            {/* ================================================== */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    STEP 2
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>SELECTED GARMENT</h3>
                </div>
                <span className="badge" style={{ backgroundColor: 'rgba(197, 168, 128, 0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 600 }}>
                  👕 GARMENT ONLY
                </span>
              </div>

              {/* Exact Garment Image Preview */}
              <div style={{
                width: '100%',
                height: '340px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem',
                marginBottom: '1rem'
              }}>
                <img
                  src={product.garment_image}
                  alt={`Garment: ${product.name}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Product Information Details */}
              <div style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {product.brand}
                  </div>
                  <h4 style={{ fontSize: '1.05rem', margin: '0.2rem 0 0.4rem', color: 'var(--text-primary)' }}>
                    {product.name}
                  </h4>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Category: <strong>{product.category}</strong></span>
                    {product.cloth_type && <span>Type: <strong>{product.cloth_type}</strong></span>}
                    {product.color && <span>Color: <strong>{product.color}</strong></span>}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                    ₹{product.price}
                  </div>
                  <span className="badge badge-success">
                    {product.stock > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================== */}
          {/* GENERATE VIRTUAL TRY-ON ACTION AREA               */}
          {/* ================================================== */}
          {!generatedResult && (
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              {!isAuthenticated ? (
                <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', textAlign: 'center' }}>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Please sign in with your account to experience realistic AI Virtual Try-On.
                  </p>
                  <Link to="/auth" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                    Sign In to Try On
                  </Link>
                </div>
              ) : isGenerating ? (
                <div className="card" style={{
                  maxWidth: '680px',
                  margin: '0 auto',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  border: '1px solid var(--accent-gold)',
                  boxShadow: '0 0 35px rgba(197, 168, 128, 0.15)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 3s linear infinite' }}>
                    ✨
                  </div>
                  <h3 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem', fontSize: '1.35rem' }}>
                    ✨ GENERATING YOUR AI TRY-ON
                  </h3>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.35rem' }}>
                    Your virtual fitting image is being generated...
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    Please wait while AI processes your photo with CUDA acceleration.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="btn"
                    style={{
                      background: isGenerateDisabled
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)',
                      color: isGenerateDisabled ? 'var(--text-muted)' : '#0d0f12',
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      padding: '1rem 2.75rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: isGenerateDisabled ? 'not-allowed' : 'pointer',
                      border: 'none',
                      boxShadow: isGenerateDisabled ? 'none' : '0 4px 20px rgba(212, 175, 55, 0.35)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ✨ GENERATE VIRTUAL TRY-ON
                  </button>
                  {!userPhoto && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Upload your photo above in Step 1 to enable generation.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 3 — GENERATED RESULT                           */}
          {/* ================================================== */}
          {generatedResult && (
            <div className="card" style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              border: '2px solid var(--accent-gold)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(197, 168, 128, 0.2)',
              marginTop: '1.5rem',
              marginBottom: '2.5rem',
              backgroundColor: '#12151b'
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge" style={{ backgroundColor: 'rgba(197, 168, 128, 0.2)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
                  🎯 AI GENERATED RESULT
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                STEP 3
              </div>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>
                AI GENERATED RESULT
              </h2>

              {/* Output Image Preview */}
              <div style={{
                maxWidth: '520px',
                margin: '0 auto 2rem',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: '#0a0c10',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
              }}>
                <img
                  src={generatedResult.result_url}
                  alt={`VTON Result for Product #${product.id}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '650px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="btn btn-primary"
                  style={{
                    fontWeight: 700,
                    padding: '0.85rem 1.75rem',
                    backgroundColor: '#ffffff',
                    color: '#0d0f12'
                  }}
                >
                  ⬇ DOWNLOAD RESULT
                </button>

                <button
                  type="button"
                  onClick={handleTryAnotherPhoto}
                  className="btn btn-secondary"
                  style={{ padding: '0.85rem 1.75rem' }}
                >
                  TRY ANOTHER PHOTO
                </button>

                <button
                  type="button"
                  onClick={handleTryAnotherProduct}
                  className="btn btn-outline"
                  style={{ padding: '0.85rem 1.75rem' }}
                >
                  TRY ANOTHER PRODUCT
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
