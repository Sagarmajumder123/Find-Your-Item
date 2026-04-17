import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLostItem, updateLostItem, BASE_URL } from "../api";
import { showToast } from "./Toast";
import CategorySelector from "./CategorySelector";
import ColorSelector from "./ColorSelector";
import LocationPicker from "./LocationPicker";

const API_BASE = BASE_URL;

const EditLost = () => {
  const { id } = useParams();
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
  
  const [existingImages, setExistingImages] = useState([]);
  const [images, setImages] = useState([]); // New image files
  const [preview, setPreview] = useState([]); // Previews for new images
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await getLostItem(id);
        const item = res.data;
        
        setFormData({
          title: item.title || "",
          description: item.description || "",
          date: item.date ? item.date.substring(0, 10) : "",
          brand: item.brand || "",
          reward: item.reward || "",
        });
        setCategory(item.category || "");
        setColor(item.color || "");
        if (item.location && item.location.coordinates) {
          setLocationData({
            lat: item.location.coordinates[1],
            lng: item.location.coordinates[0],
            locationName: item.locationName || ""
          });
        }
        if (item.images && item.images.length > 0) {
          setExistingImages(item.images);
        }
      } catch (err) {
        showToast("Error loading item details.", "error");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLocationSelect = (lat, lng, name) => {
    setLocationData({ lat, lng, locationName: name || "" });
  };

  const handleImage = async (e) => {
    const files = Array.from(e.target.files);
    const remaining = 10 - (existingImages.length + images.length);
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

  const removeExistingImage = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(preview[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleCameraCapture = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file || (existingImages.length + images.length) >= 10) return;
      setImages(prev => [...prev, file]);
      setPreview(prev => [...prev, URL.createObjectURL(file)]);
    };
    input.click();
  };

  const isValid = formData.title && formData.description && category && color && locationData.lat !== null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) { showToast("Please fill all required fields", "error"); return; }
    setSaving(true);
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
      
      // Send the images we want to keep
      data.append("existingImages", JSON.stringify(existingImages));
      
      // Send new image files
      images.forEach(img => data.append("images", img));

      await updateLostItem(id, data);
      showToast("Lost item updated successfully!", "success");
      navigate(`/item/lost/${id}`);
    } catch (err) {
      showToast(err.response?.data?.message || "Error updating", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <div className="form-container" style={{ maxWidth: "720px" }}>
        <h1 className="form-title">✏️ Edit Lost Item</h1>
        <p className="form-subtitle">Update the details of your lost item.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" name="title" placeholder="e.g., Black Leather Wallet" value={formData.title} onChange={handleChange} required maxLength={100} />
          </div>

          <CategorySelector selected={category} onChange={setCategory} required={true} />
          <ColorSelector selected={color} onChange={setColor} required={true} />

          <div className="form-group">
            <label>Brand Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
            <input type="text" name="brand" placeholder="e.g., Samsung, Nike, Gucci..." value={formData.brand} onChange={handleChange} maxLength={100} />
          </div>

          <div className="form-group">
            <label>💰 Reward Amount <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
            <div className="reward-input-wrapper">
              <span className="reward-currency">₹</span>
              <input type="number" name="reward" placeholder="0" value={formData.reward} onChange={handleChange} min="0" step="1" className="reward-input" />
            </div>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea name="description" placeholder="Describe the item in detail..." value={formData.description} onChange={handleChange} required maxLength={2000} />
          </div>

          <LocationPicker onLocationSelect={handleLocationSelect} required={true} label="Where did you lose it?" initialLocation={locationData.lat ? [locationData.lat, locationData.lng] : null} initialAddress={locationData.locationName} />

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <label>Date Lost</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} />
          </div>

          <div className="image-upload-section">
            <label className="image-upload-label">Photos (Optional — {existingImages.length + images.length}/10)</label>
            <div className="image-grid">
              {/* Existing Images */}
              {existingImages.map((imgUrl, i) => (
                <div key={`existing-${i}`} className="image-card">
                  <img src={`${API_BASE}${imgUrl}`} alt="Existing" />
                  <div className="image-card-overlay">
                    <button type="button" className="image-card-btn remove" onClick={() => removeExistingImage(i)}>✕</button>
                  </div>
                </div>
              ))}
              
              {/* New Images Preview */}
              {preview.map((img, i) => {
                return (
                  <div key={`new-${i}`} className="image-card">
                    <span className="image-count-badge">New</span>
                    <img src={img} alt="Preview" />
                    <div className="image-card-overlay">
                      <button type="button" className="image-card-btn remove" onClick={() => removeNewImage(i)}>✕</button>
                    </div>
                  </div>
                );
              })}
              
              {(existingImages.length + images.length) < 10 && (
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
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate(-1)} style={{ marginRight: '1rem' }}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving || !isValid} style={{ flex: 1 }}>
              {saving ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>Saving...</> : "💾 Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLost;
