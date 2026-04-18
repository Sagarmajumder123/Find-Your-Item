import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMatches, BASE_URL, submitClaim, getReceivedClaims, verifyClaim } from "../api";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = BASE_URL;

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
  
  // Claim Verification States
  const [activeTab, setActiveTab] = useState("matches"); // 'matches' or 'received'
  const [receivedClaims, setReceivedClaims] = useState([]);
  const [claimingItem, setClaimingItem] = useState(null); // Match object currently being claimed
  const [claimAnswer, setClaimAnswer] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [verifyingClaim, setVerifyingClaim] = useState(null); // claimId currently being verified

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

  const fetchReceivedClaims = async () => {
    setLoading(true);
    try {
      const res = await getReceivedClaims();
      setReceivedClaims(res.data || []);
    } catch (err) {
      console.error("Failed to fetch received claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (activeTab === "matches") fetchMatches(); 
    else fetchReceivedClaims();
  }, [filters, pagination.page, activeTab]); // eslint-disable-line

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
    const foundOwnerId = match.foundItem.user?._id || match.foundItem.user;
    const currentUserId = user?._id;

    const buttons = [];

    // Show "Claim & Verify" ONLY if current user is the LOST item owner
    if (currentUserId === lostOwnerId && currentUserId !== foundOwnerId) {
      buttons.push(
        <button 
          key="claim" 
          onClick={() => setClaimingItem(match)}
          className="btn btn-success btn-sm" 
          style={{ flex: 1 }}
        >
          🛡️ Claim & Verify
        </button>
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

    // Note: Users can no longer browse other users' matches due to privacy updates.
    // The list is now strictly filtered to own items.

    if (buttons.length === 0) {
      buttons.push(
        <div key="self" className="match-self-notice">
          <span>ℹ️</span> You own both items in this match
        </div>
      );
    }

    return buttons;
  };

  const handleSubmitClaim = async () => {
    if (!claimAnswer.trim()) return;
    setSubmittingClaim(true);
    try {
      await submitClaim({
        lostItemId: claimingItem.lostItem._id,
        foundItemId: claimingItem.foundItem._id,
        answer: claimAnswer.trim()
      });
      setClaimingItem(null);
      setClaimAnswer("");
      fetchMatches();
    } catch (err) {
      console.error("Failed to submit claim:", err);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const processVerification = async (claimId, action) => {
    setVerifyingClaim(claimId);
    try {
      await verifyClaim({ claimId, action });
      fetchReceivedClaims();
    } catch (err) {
      console.error("Failed to verify claim:", err);
    } finally {
      setVerifyingClaim(null);
    }
  };

  return (
    <div className="page-container animate-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">🔗 Matches & Verifications</h1>
          <p className="section-subtitle">
            {activeTab === 'matches' 
              ? `${pagination.total} potential match${pagination.total !== 1 ? "es" : ""} found` 
              : `${receivedClaims.length} claim request${receivedClaims.length !== 1 ? "s" : ""} received`
            }
          </p>
        </div>
      </div>

      <div className="matches-tabs">
        <button className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>
          Potential Matches
        </button>
        <button className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`} onClick={() => setActiveTab('received')}>
          Received Claims {receivedClaims.length > 0 && <span className="tab-badge">{receivedClaims.length}</span>}
        </button>
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
        <div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>
      ) : activeTab === 'matches' ? (
        matches.length === 0 ? (
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
                        </div>
                        <Link to={`/item/found/${match.foundItem._id}`} className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem", width: "100%" }}>View</Link>
                      </div>
                    </div>

                    <div className="match-details">
                      <div className="match-detail-item"><span className="match-detail-icon">📍</span><span>{match.distance} km away</span></div>
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
        )
      ) : (
        /* Received Claims View */
        <div className="claims-view">
          {receivedClaims.length === 0 ? (
            <div className="empty-state animate-in">
              <div className="empty-state-icon">🛡️</div>
              <h3>No claim requests yet</h3>
              <p>When someone claims an item you found, their answers will appear here.</p>
            </div>
          ) : (
            <div className="claims-list">
              {receivedClaims.map((claim) => (
                <div key={claim._id} className="claim-item glass-card animate-msg">
                  <div className="claim-header">
                    <div className="claim-user">
                      <div className="chat-list-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>{claim.claimer.name.charAt(0)}</div>
                      <div>
                        <strong>{claim.claimer.name}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>wants to claim your found item</p>
                      </div>
                    </div>
                    <div className="claim-date">{new Date(claim.createdAt).toLocaleDateString()}</div>
                  </div>

                  <div className="claim-items-preview">
                    <div className="mini-item">
                      <img src={getImageUrl(claim.foundItem)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      <span>{claim.foundItem.title}</span>
                    </div>
                  </div>

                  <div className="claim-verification-box">
                    <label>QUESTION:</label>
                    <p className="claim-question">"{claim.foundItem.securityQuestion || "No specific question was set. Please verify via chat if needed."}"</p>
                    <label>ANSWER SUBMITTED:</label>
                    <p className="claim-answer">{claim.answer}</p>
                  </div>

                  <div className="claim-actions">
                    <button 
                      className="btn btn-success btn-sm" 
                      onClick={() => processVerification(claim._id, 'approved')}
                      disabled={verifyingClaim === claim._id}
                    >
                      {verifyingClaim === claim._id ? "..." : "✅ Approve & Resolve"}
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => processVerification(claim._id, 'rejected')}
                      disabled={verifyingClaim === claim._id}
                    >
                      {verifyingClaim === claim._id ? "..." : "❌ Reject Answer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claim Answering Modal */}
      {claimingItem && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-container glass-card animate-zoom" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>🛡️ Submit Claim</h3>
              <button className="close-btn" onClick={() => setClaimingItem(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: "1.5rem" }}>
              <div className="security-notice">
                <p>The finder has set a security question to verify your ownership.</p>
              </div>
              
              <div className="claim-question-display">
                <label>Verification Question:</label>
                <p>"{claimingItem.foundItem.securityQuestion || "No question set. Please introduce yourself and describe the item."}"</p>
              </div>

              <div className="form-group">
                <label>Your Answer</label>
                <textarea 
                  className="form-input" 
                  rows="4" 
                  placeholder="Provide details that only you would know..." 
                  value={claimAnswer}
                  onChange={(e) => setClaimAnswer(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button 
                  className="btn btn-success btn-lg" 
                  style={{ flex: 1 }} 
                  onClick={handleSubmitClaim}
                  disabled={submittingClaim || !claimAnswer.trim()}
                >
                  {submittingClaim ? "Submitting..." : "Submit Claim"}
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => setClaimingItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Matches;
