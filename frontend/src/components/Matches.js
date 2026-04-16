import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMatches } from "../api";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = "http://localhost:5001";

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const getScoreGradient = (score) => {
  if (score >= 80) return "linear-gradient(135deg, #10B981, #059669)";
  if (score >= 60) return "linear-gradient(135deg, #F59E0B, #D97706)";
  if (score >= 40) return "linear-gradient(135deg, #6C63FF, #5A52D5)";
  return "linear-gradient(135deg, #EF4444, #DC2626)";
};

const getScoreColor = (score) => {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  if (score >= 40) return "#6C63FF";
  return "#EF4444";
};

const Matches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: "", maxDistance: 50, minScore: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 12 };
      if (filters.category) params.category = filters.category;
      if (filters.maxDistance) params.maxDistance = filters.maxDistance;
      if (filters.minScore) params.minScore = filters.minScore;
      const res = await getMatches(params);
      const data = res.data || res;
      setMatches(data.matches || []);
      setPagination((prev) => ({ ...prev, pages: data.pages || 1, total: data.total || 0 }));
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, [filters, pagination.page]); // eslint-disable-line

  const getImageUrl = (item) => {
    if (item.images && item.images.length > 0) return `${API_BASE}${item.images[0]}`;
    return null;
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Smart contact logic — don't let user contact themselves
  const getContactButtons = (match) => {
    const lostOwnerId = match.lostItem.user?._id;
    const foundOwnerId = match.foundItem.user?._id;
    const currentUserId = user?._id;

    const buttons = [];

    // Show "Contact Finder" ONLY if current user is the LOST item owner (not the finder)
    if (currentUserId === lostOwnerId && currentUserId !== foundOwnerId) {
      buttons.push(
        <Link key="finder" to={`/chat/${foundOwnerId}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
          💬 Contact Finder
        </Link>
      );
    }

    // Show "Contact Owner" ONLY if current user is the FOUND item owner (not the lost owner)
    if (currentUserId === foundOwnerId && currentUserId !== lostOwnerId) {
      buttons.push(
        <Link key="owner" to={`/chat/${lostOwnerId}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
          💬 Contact Owner
        </Link>
      );
    }

    // If user is neither (browsing other matches), show both only to valid targets
    if (currentUserId !== lostOwnerId && currentUserId !== foundOwnerId) {
      buttons.push(
        <Link key="finder" to={`/chat/${foundOwnerId}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
          💬 Contact Finder
        </Link>,
        <Link key="owner" to={`/chat/${lostOwnerId}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
          💬 Contact Owner
        </Link>
      );
    }

    if (buttons.length === 0) {
      buttons.push(
        <div key="self" className="match-self-notice">
          <span>ℹ️</span> You own both items in this match
        </div>
      );
    }

    return buttons;
  };

  return (
    <div className="page-container animate-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">🔗 Matches</h1>
          <p className="section-subtitle">{pagination.total} potential match{pagination.total !== 1 ? "es" : ""} found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="matches-filters">
        <div className="filter-group">
          <label>Category</label>
          <select value={filters.category} onChange={(e) => handleFilterChange("category", e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (<option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>))}
          </select>
        </div>
        <div className="filter-group">
          <label>Max Distance: {filters.maxDistance} km</label>
          <input type="range" min="1" max="100" value={filters.maxDistance} onChange={(e) => handleFilterChange("maxDistance", parseInt(e.target.value))} className="range-slider" />
        </div>
        <div className="filter-group">
          <label>Min Score: {filters.minScore}%</label>
          <input type="range" min="0" max="90" step="10" value={filters.minScore} onChange={(e) => handleFilterChange("minScore", parseInt(e.target.value))} className="range-slider" />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div><p>Finding matches...</p></div>
      ) : matches.length === 0 ? (
        <div className="empty-state animate-in">
          <div className="empty-state-icon">🔗</div>
          <h3>No matches found</h3>
          <p>{filters.category || filters.minScore > 0 ? "Try adjusting your filters" : "Report a lost or found item to start matching"}</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/add-lost" className="btn btn-primary">📦 Report Lost Item</Link>
            <Link to="/add-found" className="btn btn-success">🔎 Report Found Item</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="matches-grid">
            {matches.map((match, index) => {
              const lostCat = getCategoryInfo(match.lostItem.category);
              const foundCat = getCategoryInfo(match.foundItem.category);
              return (
                <div key={index} className="match-card animate-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="match-score-badge" style={{ background: getScoreGradient(match.score) }}>
                    <span className="match-score-value">{match.score}%</span>
                    <span className="match-score-label">{match.label}</span>
                  </div>

                  <div className="match-items">
                    <div className="match-item-card lost">
                      <div className="match-item-badge badge-lost">LOST</div>
                      {getImageUrl(match.lostItem) ? (
                        <img src={getImageUrl(match.lostItem)} alt={match.lostItem.title} className="match-item-img" />
                      ) : (
                        <div className="match-item-img-placeholder">{lostCat.icon}</div>
                      )}
                      <div className="match-item-info">
                        <h4>{match.lostItem.title}</h4>
                        <span className="match-item-category">{lostCat.icon} {lostCat.label}</span>
                        <span className="match-item-location">📍 {match.lostItem.locationName || "Location set"}</span>
                        <span className="match-item-date">📅 {new Date(match.lostItem.date).toLocaleDateString()}</span>
                      </div>
                      <Link to={`/item/lost/${match.lostItem._id}`} className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem", width: "100%" }}>View</Link>
                    </div>

                    <div className="match-vs"><div className="match-vs-icon">⚡</div></div>

                    <div className="match-item-card found">
                      <div className="match-item-badge badge-found">FOUND</div>
                      {getImageUrl(match.foundItem) ? (
                        <img src={getImageUrl(match.foundItem)} alt={match.foundItem.title} className="match-item-img" />
                      ) : (
                        <div className="match-item-img-placeholder">{foundCat.icon}</div>
                      )}
                      <div className="match-item-info">
                        <h4>{match.foundItem.title}</h4>
                        <span className="match-item-category">{foundCat.icon} {foundCat.label}</span>
                        <span className="match-item-location">📍 {match.foundItem.locationName || "Location set"}</span>
                        <span className="match-item-date">📅 {new Date(match.foundItem.date).toLocaleDateString()}</span>
                      </div>
                      <Link to={`/item/found/${match.foundItem._id}`} className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem", width: "100%" }}>View</Link>
                    </div>
                  </div>

                  <div className="match-details">
                    <div className="match-detail-item"><span className="match-detail-icon">📍</span><span>{match.distance} km away</span></div>
                    <div className="match-detail-item"><span className="match-detail-icon">⏱</span><span>{match.daysDifference} day{match.daysDifference !== 1 ? "s" : ""} apart</span></div>
                    <div className="match-detail-item">
                      <div className="match-score-bar-wrapper">
                        <div className="match-score-bar" style={{ width: `${match.score}%`, background: getScoreColor(match.score) }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="match-actions">
                    {getContactButtons(match)}
                  </div>
                </div>
              );
            })}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}>← Previous</button>
              <span className="pagination-info">Page {pagination.page} of {pagination.pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Matches;
