import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLostItem } from "../api";
import { showToast } from "./Toast";
import CategorySelector from "./CategorySelector";
import ColorSelector from "./ColorSelector";
import LocationPicker from "./LocationPicker";

const AddLost = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    brand: "",
    reward: "",
  });
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [locationData, setLocationData] = useState({ lat: null, lng: null, locationName: "" });
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLocationSelect = (lat, lng, name) => {
    setLocationData({ lat, lng, locationName: name || "" });
  };

  const handleImage = async (e) => {
    const files = Array.from(e.target.files);
    const remaining = 10 - images.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;

    const newImages = [], newPreviews = [];

    for (const file of toAdd) {
      newImages.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setImages(prev => [...prev, ...newImages]);
    setPreview(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(preview[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleCameraCapture = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file || images.length >= 10) return;
      setImages(prev => [...prev, file]);
      setPreview(prev => [...prev, URL.createObjectURL(file)]);
    };
    input.click();
  };

  const isValid = formData.title && formData.description && category && color && locationData.lat !== null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) { showToast("Please fill all required fields", "error"); return; }
    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("category", category);
      data.append("color", color);
      data.append("brand", formData.brand);
      data.append("reward", formData.reward || "0");
      data.append("latitude", locationData.lat);
      data.append("longitude", locationData.lng);
      data.append("locationName", locationData.locationName);
      if (formData.date) data.append("date", formData.date);
      images.forEach(img => data.append("images", img));

      await createLostItem(data);
      showToast("Lost item reported successfully!", "success");
      navigate("/lost");
    } catch (err) {
      showToast(err.response?.data?.message || "Error submitting", "error");
    } finally { setLoading(false); }
  };


  return (
    <div className="page-container">
      <div className="form-container" style={{ maxWidth: "720px" }}>
        <h1 className="form-title">📦 Report Lost Item</h1>
        <p className="form-subtitle">Fill in the details about your lost item to help others find it.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" name="title" placeholder="e.g., Black Leather Wallet" value={formData.title} onChange={handleChange} required maxLength={100} />
          </div>

          <CategorySelector selected={category} onChange={setCategory} required={true} />
          <ColorSelector selected={color} onChange={setColor} required={true} />

          {/* Brand */}
          <div className="form-group">
            <label>Brand Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
            <input type="text" name="brand" placeholder="e.g., Samsung, Nike, Gucci..." value={formData.brand} onChange={handleChange} maxLength={100} />
          </div>

          {/* Reward — ONLY for Lost Items */}
          <div className="form-group">
            <label>💰 Reward Amount <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
            <div className="reward-input-wrapper">
              <span className="reward-currency">₹</span>
              <input type="number" name="reward" placeholder="0" value={formData.reward} onChange={handleChange} min="0" step="1" className="reward-input" />
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Set a reward to motivate finders. Only you (the owner) can set this.</p>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea name="description" placeholder="Describe the item in detail..." value={formData.description} onChange={handleChange} required maxLength={2000} />
          </div>

          <LocationPicker onLocationSelect={handleLocationSelect} required={true} label="Where did you lose it?" />

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <label>Date Lost</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} />
          </div>

          {/* Image Upload */}
          <div className="image-upload-section">
            <label className="image-upload-label">Photos (Optional — {images.length}/10)</label>
            <div className="image-grid">
              {preview.map((img, i) => {
                return (
                  <div key={i} className="image-card">
                    <span className="image-count-badge">#{i + 1}</span>
                    <img src={img} alt={`Preview ${i + 1}`} />
                    <div className="image-card-overlay">
                      <button type="button" className="image-card-btn remove" onClick={() => removeImage(i)}>✕</button>
                    </div>
                  </div>
                );
              })}
              {images.length < 10 && (
                <>
                  <label className="image-add-card">
                    <span className="plus-icon">+</span><span>Add Photo</span>
                    <input type="file" accept="image/*" multiple onChange={handleImage} style={{ display: "none" }} />
                  </label>
                  <button type="button" className="image-add-card camera-card" onClick={handleCameraCapture}>
                    <span className="plus-icon">📸</span><span>Take Photo</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-footer">
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !isValid} style={{ flex: 1 }}>
              {loading ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>Submitting...</> : "📦 Report Lost Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLost;