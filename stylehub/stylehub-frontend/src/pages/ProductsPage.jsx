import React, { useState, useEffect } from 'react';
import { fetchProductsApi } from '../services/api';
import ProductCard from '../components/ProductCard';

const CATEGORIES = [
  'All',
  'Shirts',
  'T-Shirts',
  'Hoodies',
  'Jackets',
  'Pants & Trousers',
  'Shoes',
  'Watches',
  'Caps',
  'Belts',
  'Sunglasses'
];

const PRICE_RANGES = [
  { label: 'All Prices (₹400–₹700)', min: null, max: null },
  { label: '₹400–₹500', min: 400, max: 500 },
  { label: '₹500–₹600', min: 501, max: 600 },
  { label: '₹600–₹700', min: 601, max: 700 }
];

const DISCOUNT_OPTIONS = [
  { label: 'All Offers', min: null },
  { label: '20% OFF', min: 20 },
  { label: '30% OFF', min: 30 },
  { label: '40% OFF', min: 40 }
];

const STOCK_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' }
];

const SORT_OPTIONS = [
  { label: 'Featured', value: '' },
  { label: 'Price: Low → High', value: 'price_asc' },
  { label: 'Price: High → Low', value: 'price_desc' },
  { label: 'Discount: High → Low', value: 'discount_desc' },
  { label: 'Name: A → Z', value: 'name_asc' }
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPriceRangeIndex, setSelectedPriceRangeIndex] = useState(0);
  const [selectedDiscountIndex, setSelectedDiscountIndex] = useState(0);
  const [selectedStock, setSelectedStock] = useState('all');
  const [selectedSort, setSelectedSort] = useState('');

  // Handle search input debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load products from backend with all active filters
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};

      if (selectedCategory && selectedCategory !== 'All') {
        params.category = selectedCategory;
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const priceRange = PRICE_RANGES[selectedPriceRangeIndex];
      if (priceRange.min !== null) params.minPrice = priceRange.min;
      if (priceRange.max !== null) params.maxPrice = priceRange.max;

      const discountOption = DISCOUNT_OPTIONS[selectedDiscountIndex];
      if (discountOption.min !== null) params.minDiscount = discountOption.min;

      if (selectedStock && selectedStock !== 'all') {
        params.stockStatus = selectedStock;
      }

      if (selectedSort) {
        params.sort = selectedSort;
      }

      const data = await fetchProductsApi(params);
      setProducts(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve products from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [
    selectedCategory,
    debouncedSearch,
    selectedPriceRangeIndex,
    selectedDiscountIndex,
    selectedStock,
    selectedSort
  ]);

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedPriceRangeIndex(0);
    setSelectedDiscountIndex(0);
    setSelectedStock('all');
    setSelectedSort('');
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    searchQuery.trim() !== '' ||
    selectedPriceRangeIndex !== 0 ||
    selectedDiscountIndex !== 0 ||
    selectedStock !== 'all' ||
    selectedSort !== '';

  return (
    <div>
      {/* Header & Branding */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span className="badge">100 Essentials Catalog</span>
          <span className="badge badge-success">Live SQLite Data</span>
        </div>
        <h1 style={{ letterSpacing: '-0.03em' }}>AK's MEN STYLE Collection</h1>
        <p style={{ maxWidth: '720px', marginTop: '0.35rem' }}>
          Curated modern menswear engineered for everyday refinement. Verified pricing under ₹700, authentic photography, real-time stock, and integrated AI Virtual Try-On.
        </p>
      </div>

      {/* Filter and Search Panel */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, brand, category, color, or description..."
              style={{
                width: '100%',
                padding: '0.75rem 2.5rem 0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-outline"
              style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Categories
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Controls: Price, Discount, Stock, Sort */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Price Range Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
              Price Filter
            </label>
            <select
              value={selectedPriceRangeIndex}
              onChange={(e) => setSelectedPriceRangeIndex(Number(e.target.value))}
              className="filter-select"
              style={{ width: '100%' }}
            >
              {PRICE_RANGES.map((range, idx) => (
                <option key={range.label} value={idx}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Discount Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
              Discount Filter
            </label>
            <select
              value={selectedDiscountIndex}
              onChange={(e) => setSelectedDiscountIndex(Number(e.target.value))}
              className="filter-select"
              style={{ width: '100%' }}
            >
              {DISCOUNT_OPTIONS.map((disc, idx) => (
                <option key={disc.label} value={idx}>
                  {disc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
              Stock Availability
            </label>
            <select
              value={selectedStock}
              onChange={(e) => setSelectedStock(e.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            >
              {STOCK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
              Sort By
            </label>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Results Header & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {products.length} Products
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
            {selectedCategory !== 'All' ? `in ${selectedCategory}` : 'across all categories'}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </span>
        </div>

        {hasActiveFilters && (
          <span className="badge" style={{ fontSize: '11px' }}>
            Filtered Results
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#f87171',
          marginBottom: '2rem'
        }}>
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>⏳</div>
          Loading products from AK's MEN STYLE catalog...
        </div>
      )}

      {/* Responsive Product Grid */}
      {!loading && !error && products.length > 0 && (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No products found</h3>
          <p style={{ maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            No products match your current combination of filters and search term. Try widening your price range or resetting filters.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-primary"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
