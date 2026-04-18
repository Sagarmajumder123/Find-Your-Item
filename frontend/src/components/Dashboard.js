import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getMyLostItems,
  getMyFoundItems,
  deleteLostItem,
  deleteFoundItem,
  getMyMatches,
  getNotifications,
  BASE_URL
} from "../api";
import { showToast } from "./Toast";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = BASE_URL;

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(null);
  const [activeTab, setActiveTab] = useState("lost");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lostRes, foundRes, matchRes, notifRes] = await Promise.all([
          getMyLostItems(),
          getMyFoundItems(),
          getMyMatches({ minScore: 20 }).catch(() => ({ data: { matches: [] } })),
          getNotifications({ limit: 5 }).catch(() => ({ data: { notifications: [] } })),
        ]);
        setLostItems(lostRes.data || []);
        setFoundItems(foundRes.data || []);
        setMatchCount(matchRes.data?.matches?.length || matchRes.data?.total || 0);
        setRecentNotifications(notifRes.data?.notifications || []);
      } catch (err) {
        console.error("Failed to fetch user items:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteModal) return;

    try {
      if (deleteModal.type === "lost") {
        await deleteLostItem(deleteModal.id);
        setLostItems((prev) => prev.filter((item) => item._id !== deleteModal.id));
      } else {
        await deleteFoundItem(deleteModal.id);
        setFoundItems((prev) => prev.filter((item) => item._id !== deleteModal.id));
      }
      showToast("Item deleted successfully", "success");
    } catch (err) {
      showToast("Failed to delete item", "error");
    }
    setDeleteModal(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "U");

  const getImageUrl = (item) => {
    if (item.images && item.images.length > 0) {
      return `${API_BASE}${item.images[0]}`;
    }
    return null;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "claimed":
        return <span className="item-status-badge claimed">🎉 Claimed</span>;
      case "resolved":
        return <span className="item-status-badge resolved">✅ Resolved</span>;
      default:
        return <span className="item-status-badge active">🔴 Active</span>;
    }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const renderItems = (items, type) => {
    if (items.length === 0) {
      return (
        <div className="empty-state" style={{ padding: "2rem" }}>
          <p>No {type} items reported yet.</p>
          <Link to={`/add-${type}`} className={`btn ${type === 'lost' ? 'btn-primary' : 'btn-success'} btn-sm`}>
            Report {type === "lost" ? "Lost" : "Found"} Item
          </Link>
        </div>
      );
    }

    return items.map((item) => {
      const catInfo = getCategoryInfo(item.category);
      return (
        <div key={item._id} className="dashboard-item">
          {getImageUrl(item) ? (
            <img
              src={getImageUrl(item)}
              alt={item.title}
              className="dashboard-item-img"
            />
          ) : (
            <div
              className="dashboard-item-img"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}
            >
              {catInfo.icon}
            </div>
          )}
          <div className="dashboard-item-info">
            <div className="dashboard-item-title">
              {item.title}
              {getStatusBadge(item.status)}
            </div>
            <div className="dashboard-item-meta">
              <span>{catInfo.icon} {catInfo.label}</span>
              <span>📍 {item.locationName || "Location set"}</span>
              <span>📅 {new Date(item.date).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="dashboard-item-actions">
            <Link
              to={`/item/${type}/${item._id}`}
              className="btn btn-secondary btn-sm"
              title="View"
            >
              👁️
            </Link>
            <button
              onClick={() =>
                setDeleteModal({ id: item._id, type, title: item.title })
              }
              className="btn btn-danger btn-sm"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="page-container">
      {/* User Header */}
      <div className="dashboard-header">
        <div className="dashboard-avatar">
          {getInitial(user?.name)}
        </div>
        <div className="dashboard-info" style={{ flex: 1 }}>
          <h2>Welcome back, {user?.name || "User"}! 👋</h2>
          <p>📧 {user?.email || "No email"}</p>
        </div>
        <button onClick={handleLogout} className="btn btn-danger btn-sm">
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon lost">📦</div>
          <div>
            <div className="stat-value">{lostItems.length}</div>
            <div className="stat-label">Lost Items</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon found">🔎</div>
          <div>
            <div className="stat-value">{foundItems.length}</div>
            <div className="stat-label">Found Items</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(108, 99, 255, 0.1)" }}>🔗</div>
          <div>
            <div className="stat-value">{matchCount}</div>
            <div className="stat-label">Matches</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)" }}>🔔</div>
          <div>
            <div className="stat-value">{recentNotifications.filter(n => !n.read).length}</div>
            <div className="stat-label">Unread</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <Link to="/add-lost" className="btn btn-primary">
          ➕ Report Lost Item
        </Link>
        <Link to="/add-found" className="btn btn-success">
          ➕ Report Found Item
        </Link>
        <Link to="/matches" className="btn btn-outline">
          🔗 View Matches
        </Link>
        <Link to="/chat" className="btn btn-secondary">
          💬 Messages
        </Link>
      </div>

      {/* Recent Notifications */}
      {recentNotifications.length > 0 && (
        <div className="dashboard-section">
          <div className="section-header" style={{ marginBottom: "1rem" }}>
            <h3 className="section-title" style={{ fontSize: "1.25rem" }}>
              🔔 Recent Notifications
            </h3>
            <Link to="/matches" className="btn btn-outline btn-sm">View All</Link>
          </div>
          <div className="dashboard-notifications">
            {recentNotifications.slice(0, 3).map((notif) => (
              <div key={notif._id} className={`dashboard-notif-item ${!notif.read ? 'unread' : ''}`}>
                <div className="dashboard-notif-icon">
                  {notif.type === 'match' ? '🔗' : notif.type === 'claim' ? '🎉' : '🔔'}
                </div>
                <div className="dashboard-notif-content">
                  <span className="dashboard-notif-title">{notif.title}</span>
                  <span className="dashboard-notif-msg">{notif.message}</span>
                  <span className="dashboard-notif-time">{timeAgo(notif.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="dashboard-tabs">
        <button
          className={`dashboard-tab ${activeTab === 'lost' ? 'active' : ''}`}
          onClick={() => setActiveTab('lost')}
        >
          📦 My Lost Items ({lostItems.length})
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'found' ? 'active' : ''}`}
          onClick={() => setActiveTab('found')}
        >
          🔎 My Found Items ({foundItems.length})
        </button>
      </div>

      {/* Items List */}
      <div className="dashboard-section">
        {activeTab === 'lost' ? renderItems(lostItems, "lost") : renderItems(foundItems, "found")}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">⚠️ Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>
                ✕
              </button>
            </div>
            <p className="confirm-text">
              Are you sure you want to delete <strong>"{deleteModal.title}"</strong>?
              This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteModal(null)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;