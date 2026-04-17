import React, { useState, useEffect, useCallback } from 'react';
import { BASE_URL } from '../api';

const ImageViewer = ({ images, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [touchStart, setTouchStart] = useState(null);

  const API_BASE = BASE_URL;

  const getFullUrl = (src) => {
    if (!src) return '';
    if (src.startsWith('http')) return src;
    return `${API_BASE}${src}`;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [currentIndex]); // eslint-disable-line

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setScale(1);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setScale(1);
  }, [images.length]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.5, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const handleResetZoom = () => setScale(1);

  // Swipe support for mobile
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
    setTouchStart(null);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="image-viewer-overlay" onClick={handleBackdropClick}>
      {/* Close button */}
      <button className="image-viewer-close" onClick={onClose} title="Close (Esc)">
        ✕
      </button>

      {/* Counter */}
      <div className="image-viewer-counter">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Zoom controls */}
      <div className="image-viewer-zoom-controls">
        <button onClick={handleZoomOut} title="Zoom Out (-)">−</button>
        <button onClick={handleResetZoom} title="Reset">
          {Math.round(scale * 100)}%
        </button>
        <button onClick={handleZoomIn} title="Zoom In (+)">+</button>
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button className="image-viewer-nav prev" onClick={goToPrev} title="Previous (←)">
            ‹
          </button>
          <button className="image-viewer-nav next" onClick={goToNext} title="Next (→)">
            ›
          </button>
        </>
      )}

      {/* Image */}
      <div
        className="image-viewer-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={getFullUrl(images[currentIndex])}
          alt={`Image ${currentIndex + 1}`}
          className="image-viewer-img"
          style={{
            transform: `scale(${scale})`,
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
          onClick={() => {
            if (scale === 1) handleZoomIn();
            else handleResetZoom();
          }}
          draggable={false}
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="image-viewer-thumbnails">
          {images.map((img, i) => (
            <button
              key={i}
              className={`image-viewer-thumb ${i === currentIndex ? 'active' : ''}`}
              onClick={() => { setCurrentIndex(i); setScale(1); }}
            >
              <img src={getFullUrl(img)} alt={`Thumb ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
