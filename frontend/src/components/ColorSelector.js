import React from 'react';

export const COLORS = [
  { id: 'black', label: 'Black', hex: '#1a1a2e' },
  { id: 'white', label: 'White', hex: '#f0f0f5' },
  { id: 'red', label: 'Red', hex: '#e74c3c' },
  { id: 'blue', label: 'Blue', hex: '#3498db' },
  { id: 'green', label: 'Green', hex: '#2ecc71' },
  { id: 'yellow', label: 'Yellow', hex: '#f1c40f' },
  { id: 'brown', label: 'Brown', hex: '#8B5E3C' },
  { id: 'grey', label: 'Grey', hex: '#999aab' },
  { id: 'other', label: 'Other', hex: 'linear-gradient(135deg, #e74c3c, #3498db, #2ecc71, #f1c40f)' },
];

const ColorSelector = ({ selected, onChange, required = false }) => {
  return (
    <div className="color-selector-wrapper">
      <label className="color-selector-label">
        Color {required && <span className="required-star">*</span>}
      </label>
      <div className="color-chips">
        {COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className={`color-chip ${selected === color.id ? 'selected' : ''}`}
            onClick={() => onChange(color.id)}
            title={color.label}
          >
            <span
              className="color-swatch"
              style={{
                background: color.id === 'other' ? color.hex : color.hex,
              }}
            />
            <span className="color-chip-label">{color.label}</span>
            {selected === color.id && <span className="color-check">✓</span>}
          </button>
        ))}
      </div>
      {required && !selected && (
        <p className="category-hint">Please select a color</p>
      )}
    </div>
  );
};

export default ColorSelector;
