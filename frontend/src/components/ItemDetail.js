import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getLostItem, getFoundItem, checkChatAllowed } from "../api";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./CategorySelector";
import { COLORS } from "./ColorSelector";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import ImageViewer from "./ImageViewer";

const API_BASE = "http://localhost:5001";

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const getColorInfo = (id) => {
  const col = COLORS.find((c) => c.id === id);
  return col || { id: "other", label: "Other", hex: "#999" };
};

const ItemDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [chatAllowed, setChatAllowed] = useState(null);
  const [checkingChat, setCheckingChat] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = type === "lost" ? await getLostItem(id) : await getFoundItem(id);
        setItem(res.data || res);
      } catch (err) {
        console.error("Failed to load item:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [type, id]);

  // Check if chat is allowed when item loads
  useEffect(() => {
    if (item && user && item.user?._id !== user._id) {
      setCheckingChat(true);
      checkChatAllowed(item.user._id)
        .then((res) => setChatAllowed(res.data))
        .catch(() => setChatAllowed({ allowed: false }))
        .finally(() => setCheckingChat(false));
    }
  }, [item, user]);

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  const handleContact = () => {
    if (!user) { navigate("/login"); return; }
    if (chatAllowed && !chatAllowed.allowed) return;
    if (item.user?._id) navigate(`/chat/${item.user._id}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading item details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <h3>Item not found</h3>
        <Link to={`/${type}`} className="btn btn-primary">← Back</Link>
      </div>
    );
  }

  const isOwner = user && item.user && user._id === item.user._id;
  const catInfo = getCategoryInfo(item.category);
  const colorInfo = getColorInfo(item.color);
  const hasCoordinates = item.location?.coordinates?.length === 2;
  const lat = hasCoordinates ? item.location.coordinates[1] : null;
  const lng = hasCoordinates ? item.location.coordinates[0] : null;

  return (
    <div className="page-container detail-page">
      <Link to={`/${type}`} className="detail-back">
        ← Back to {type === "lost" ? "Lost" : "Found"} Items
      </Link>

      <div className="detail-card">
        {/* Images with click to view full screen */}
        {item.images && item.images.length > 0 ? (
          <div className="detail-images">
            <img
              src={`${API_BASE}${item.images[currentImage]}`}
              alt={item.title}
              onClick={() => setViewerOpen(true)}
              style={{ cursor: "zoom-in" }}
            />
            {item.images.length > 1 && (
              <>
                <button className="detail-images-nav prev" onClick={() => setCurrentImage(p => Math.max(0, p - 1))} disabled={currentImage === 0}>‹</button>
                <button className="detail-images-nav next" onClick={() => setCurrentImage(p => Math.min(item.images.length - 1, p + 1))} disabled={currentImage === item.images.length - 1}>›</button>
                <div className="detail-images-dots">
                  {item.images.map((_, idx) => (
                    <button key={idx} className={`dot ${idx === currentImage ? "active" : ""}`} onClick={() => setCurrentImage(idx)} />
                  ))}
                </div>
              </>
            )}
            <div className="detail-images-hint">🔍 Click image to view full screen</div>
          </div>
        ) : (
          <div className="card-image-placeholder" style={{ height: "300px", fontSize: "5rem" }}>{catInfo.icon}</div>
        )}

        <div className="detail-body">
          {/* Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span className={`card-badge ${type === "lost" ? "badge-lost" : "badge-found"}`} style={{ position: "static" }}>
              {type === "lost" ? "Lost" : "Found"}
            </span>
            <span className="category-badge-inline">{catInfo.icon} {catInfo.label}</span>
            <span className="color-badge-inline">
              <span className="color-dot" style={{ background: colorInfo.hex }}></span>
              {colorInfo.label}
            </span>
            {item.status && item.status !== 'active' && (
              <span className={`item-status-badge ${item.status}`}>
                {item.status === 'claimed' ? '🎉 Claimed' : '✅ Resolved'}
              </span>
            )}
          </div>

          <h1 className="detail-title">{item.title}</h1>

          {/* Reward Badge (Lost items only) */}
          {type === "lost" && item.reward > 0 && (
            <div className="reward-badge">
              <span className="reward-badge-icon">💰</span>
              <span className="reward-badge-amount">₹{item.reward.toLocaleString()}</span>
              <span className="reward-badge-label">Reward</span>
            </div>
          )}

          {/* Brand */}
          {item.brand && (
            <div className="detail-brand">
              <span>🏷️</span> Brand: <strong>{item.brand}</strong>
            </div>
          )}

          <div className="detail-meta">
            <div className="detail-meta-item"><span className="icon">📍</span><span>{item.locationName || "Location set on map"}</span></div>
            <div className="detail-meta-item"><span className="icon">📅</span><span>{new Date(item.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span></div>
            <div className="detail-meta-item"><span className="icon">🕐</span><span>Posted {new Date(item.createdAt).toLocaleDateString()}</span></div>
          </div>

          {/* Mini Map */}
          {hasCoordinates && (
            <div className="detail-map" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}>📍 Location on Map</h3>
              <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <MapContainer center={[lat, lng]} zoom={14} style={{ height: "200px", width: "100%" }} scrollWheelZoom={false} dragging={false} zoomControl={false}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[lat, lng]} />
                </MapContainer>
              </div>
            </div>
          )}

          {/* Posted by */}
          <div className="detail-poster">
            <div className="poster-avatar">{getInitial(item.user?.name)}</div>
            <div className="poster-info">
              <div className="poster-name">{item.user?.name || "Anonymous"}</div>
              <div className="poster-email">{item.user?.email || ""}</div>
            </div>
          </div>

          <h3 style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}>Description</h3>
          <p className="detail-description">{item.description}</p>

          {/* Actions */}
          <div className="detail-actions">
            {!isOwner && (
              <>
                {checkingChat ? (
                  <button className="btn btn-primary" disabled>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Checking...
                  </button>
                ) : chatAllowed?.allowed ? (
                  <button onClick={handleContact} className="btn btn-primary">
                    💬 Contact {type === "lost" ? "Owner" : "Finder"}
                  </button>
                ) : (
                  <div className="chat-restricted">
                    <span>🔒</span>
                    <div>
                      <strong>Chat Restricted</strong>
                      <p>Contact is only available when a valid match exists between your items and this listing.</p>
                    </div>
                  </div>
                )}
              </>
            )}
            <Link to={`/matches?category=${item.category}`} className="btn btn-outline">
              🔗 View Matches
            </Link>
            {isOwner && type === "lost" && (
              <Link to={`/edit/lost/${item._id}`} className="btn btn-secondary">
                ✏️ Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Full Screen Image Viewer */}
      {viewerOpen && item.images && (
        <ImageViewer
          images={item.images}
          initialIndex={currentImage}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default ItemDetail;
