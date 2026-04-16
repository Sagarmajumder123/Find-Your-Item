import React from 'react';

const CATEGORIES = [
  { id: 'mobile', label: 'Mobile', icon: '📱' },
  { id: 'wallet', label: 'Wallet', icon: '👛' },
  { id: 'bag', label: 'Bag', icon: '🎒' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'electronics', label: 'Electronics', icon: '💻' },
  { id: 'keys', label: 'Keys', icon: '🔑' },
  { id: 'jewelry', label: 'Jewelry', icon: '💎' },
  { id: 'clothing', label: 'Clothing', icon: '👕' },
  { id: 'other', label: 'Other', icon: '📦' },
];

const CategorySelector = ({ selected, onChange, required = false, label = 'Item Category' }) => {
  return (
    <div className="category-selector-wrapper">
      <label className="category-label">
        {label} {required && <span className="required-star">*</span>}
      </label>
      <div className="category-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`category-card ${selected === cat.id ? 'selected' : ''}`}
            onClick={() => onChange(cat.id)}
            title={cat.label}
          >
            <span className="category-icon">{cat.icon}</span>
            <span className="category-name">{cat.label}</span>
          </button>
        ))}
      </div>
      {required && !selected && (
        <p className="category-hint">Please select a category</p>
      )}
    </div>
  );
};

export { CATEGORIES };
export default CategorySelector;
