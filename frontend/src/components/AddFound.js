import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createFoundItem } from "../api";
import { showToast } from "./Toast";
import CategorySelector from "./CategorySelector";
import ColorSelector from "./ColorSelector";
import LocationPicker from "./LocationPicker";
import { containsFace } from "../utils/imageValidation";

const AddFound = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    brand: "",
  });
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [locationData, setLocationData] = useState({ lat: null, lng: null, locationName: "" });
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);
  const [imageVerifications, setImageVerifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Live Camera states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera when component unmounts
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
      
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera access denied or not available. Please allow camera permissions in your browser or device settings.");
      setIsCameraOpen(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // AI SCANNING BEFORE SAVING
    showToast("🧠 Scanning photo for humans...", "info");
    const hasFace = await containsFace(canvas); // face-api can take canvas directly
    if (hasFace) {
      showToast("❌ Strictly No Human Images allowed! Please capture only the item.", "error");
      return;
    }
    
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("Error capturing photo", "error");
        return;
      }
      
      const file = new File([blob], `live-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      
      const verification = {
        badge: 'verified',
        confidence: 100,
        text: "✅ Verified Original (100%)",
        className: 'img-badge-verified',
        tooltip: "Captured via Live Camera"
      };

      setImages(prev => [...prev, file]);
      setPreview(prev => [...prev, URL.createObjectURL(file)]);
      
      setImageVerifications(prev => [...prev, {
        raw: verification, 
        getBadgeData: () => verification
      }]);

      showToast("Photo captured successfully!", "success");
      stopCamera();
    }, "image/jpeg", 0.85);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLocationSelect = (lat, lng, name) => {
    setLocationData({ lat, lng, locationName: name || "" });
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(preview[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreview(prev => prev.filter((_, i) => i !== index));
    setImageVerifications(prev => prev.filter((_, i) => i !== index));
  };

  const isValid = formData.title && formData.description && category && color && locationData.lat !== null && images.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) { 
      if (images.length === 0) {
        showToast("At least 1 photo of the found item is STRICTLY required.", "error");
      } else {
        showToast("Please fill all required fields", "error"); 
      }
      return; 
    }
    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("category", category);
      data.append("color", color);
      data.append("brand", formData.brand);
      data.append("latitude", locationData.lat);
      data.append("longitude", locationData.lng);
      data.append("locationName", locationData.locationName);
      if (formData.date) data.append("date", formData.date);
      images.forEach(img => data.append("images", img));

      await createFoundItem(data);
      showToast("Found item reported successfully!", "success");
      navigate("/found");
    } catch (err) {
      showToast(err.response?.data?.message || "Error submitting", "error");
    } finally { setLoading(false); }
  };

  const getBadge = (i) => {
    const v = imageVerifications[i];
    return v && v.getBadgeData ? v.getBadgeData() : null;
  };

  return (
    <div className="page-container">
      <div className="form-container" style={{ maxWidth: "720px" }}>
        <h1 className="form-title">🔎 Report Found Item</h1>
        <p className="form-subtitle">Help someone recover their lost item by reporting what you found.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" name="title" placeholder="e.g., Blue Backpack with Keychain" value={formData.title} onChange={handleChange} required maxLength={100} />
          </div>

          <CategorySelector selected={category} onChange={setCategory} required={true} />
          <ColorSelector selected={color} onChange={setColor} required={true} />

          <div className="form-group">
            <label>Brand Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
            <input type="text" name="brand" placeholder="e.g., Samsung, Nike, Gucci..." value={formData.brand} onChange={handleChange} maxLength={100} />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea name="description" placeholder="Describe the found item — color, brand, contents, condition..." value={formData.description} onChange={handleChange} required maxLength={2000} />
          </div>

          <LocationPicker onLocationSelect={handleLocationSelect} required={true} label="Where did you find it?" />

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <label>Date Found</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} />
          </div>

          {/* Strict Image Capture Section */}
          <div className="image-upload-section">
            <label className="image-upload-label">Required Photo — Live Capture Only ({images.length}/10)</label>
            <div className="image-verify-notice">
              <span className="verify-icon">🛡️</span>
              <div>
                <strong>Finders Must Prove Authenticity</strong>
                <p>To prevent fraud, found items can ONLY be posted dynamically using your camera. Gallery uploads are permanently disabled here.</p>
              </div>
            </div>
            
            <div className="image-grid">
              {preview.map((img, i) => {
                const badge = getBadge(i);
                return (
                  <div key={i} className="image-card">
                    <span className="image-count-badge">#{i + 1}</span>
                    <img src={img} alt={`Preview ${i + 1}`} />
                    {badge && <div className={`image-verify-badge ${badge.className}`} title={badge.tooltip}>{badge.text}</div>}
                    <div className="image-card-overlay">
                      <button type="button" className="image-card-btn remove" onClick={() => removeImage(i)}>✕</button>
                    </div>
                  </div>
                );
              })}
              
              {images.length < 10 && (
                <button type="button" className="image-add-card camera-card" onClick={startCamera} style={{ width: '100%', gridColumn: '1 / -1' }}>
                  <span className="plus-icon">📸</span>
                  <span>Tap to allow Camera & Snap Photo</span>
                </button>
              )}
            </div>
          </div>

          <div className="form-footer">
            <button type="submit" className="btn btn-success btn-lg" disabled={loading || !isValid} style={{ flex: 1 }}>
              {loading ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>Submitting...</> : "🔎 Report Found Item"}
            </button>
          </div>
        </form>
      </div>

      {/* Live Camera Modal */}
      {isCameraOpen && (
        <div className="camera-modal-overlay">
          <div className="camera-modal">
            <div className="camera-header">
              <h3>Live Camera Capture</h3>
              <button className="camera-close-btn" onClick={stopCamera}>✕</button>
            </div>
            
            <div className="camera-viewfinder">
              {cameraError ? (
                <div className="camera-error-msg">
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                  {cameraError}
                </div>
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="camera-video"
                />
              )}
            </div>

            <div className="camera-controls">
               <button 
                 className="camera-snap-btn" 
                 onClick={handleCapture}
                 disabled={!!cameraError}
               >
                 <div className="snap-btn-inner"></div>
               </button>
               <p className="camera-hint">Position the item clearly in frame</p>
            </div>
            
            {/* Hidden canvas for taking snapshot */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddFound;