import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLostItems, getFoundItems } from "../api";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = "http://localhost:5001";

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const Home = () => {
  const [recentLost, setRecentLost] = useState([]);
  const [recentFound, setRecentFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ lost: 0, found: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const [lostRes, foundRes] = await Promise.all([
          getLostItems(),
          getFoundItems(),
        ]);
        const lostData = lostRes.data || lostRes;
        const foundData = foundRes.data || foundRes;
        setRecentLost(Array.isArray(lostData) ? lostData.slice(0, 6) : []);
        setRecentFound(Array.isArray(foundData) ? foundData.slice(0, 6) : []);
        setStats({
          lost: Array.isArray(lostData) ? lostData.length : 0,
          found: Array.isArray(foundData) ? foundData.length : 0,
        });
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/lost?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getImageUrl = (item) => {
    if (item.images && item.images.length > 0) {
      return `${API_BASE}${item.images[0]}`;
    }
    return null;
  };

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>
            Find What You <span className="gradient-text">Lost</span>,<br />
            Help Others <span className="gradient-text">Recover</span>
          </h1>
          <p>
            A community-powered platform to reunite people with their lost
            belongings. Report, search, and connect instantly.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="search-container" style={{ marginBottom: 0 }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-bar"
              placeholder="Search for lost or found items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="hero-cta" style={{ marginTop: "1.5rem" }}>
            <Link to="/add-lost" className="btn btn-primary btn-lg">
              📦 Report Lost Item
            </Link>
            <Link to="/add-found" className="btn btn-secondary btn-lg">
              🔎 Report Found Item
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="stats-card">
          <div className="stats-number">{stats.lost}</div>
          <div className="stats-label">Items Reported Lost</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{stats.found}</div>
          <div className="stats-label">Items Found</div>
        </div>
        <div className="stats-card">
          <div className="stats-number">{stats.lost + stats.found}</div>
          <div className="stats-label">Total Reports</div>
        </div>
      </section>

      {/* Browse by Category */}
      <section style={{ marginBottom: "3rem" }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">📋 Browse by Category</h2>
            <p className="section-subtitle">Find items by their category</p>
          </div>
        </div>
        <div className="home-category-grid">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to={`/lost?category=${cat.id}`}
              className="home-category-card"
            >
              <span className="home-category-icon">{cat.icon}</span>
              <span className="home-category-name">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recently Lost */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">🔴 Recently Lost Items</h2>
            <p className="section-subtitle">
              Help these people find their belongings
            </p>
          </div>
          <Link to="/lost" className="btn btn-outline btn-sm">
            View All →
          </Link>
        </div>
        {recentLost.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>No lost items reported yet</h3>
            <p>Be the first to report a lost item</p>
            <Link to="/add-lost" className="btn btn-primary">
              Report Lost Item
            </Link>
          </div>
        ) : (
          <div className="items-grid">
            {recentLost.map((item) => {
              const catInfo = getCategoryInfo(item.category);
              return (
                <Link
                  to={`/item/lost/${item._id}`}
                  key={item._id}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="card-badge badge-lost">Lost</span>
                  {getImageUrl(item) ? (
                    <img
                      src={getImageUrl(item)}
                      alt={item.title}
                      className="card-image"
                    />
                  ) : (
                    <div className="card-image-placeholder">{catInfo.icon}</div>
                  )}
                  <div className="card-body">
                    <div className="card-category-badge">
                      {catInfo.icon} {catInfo.label}
                    </div>
                    <h3 className="card-title">{item.title}</h3>
                    <div className="card-meta">
                      <span>📍 {item.locationName || "Location set"}</span>
                      <span>📅 {new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <p className="card-description">{item.description}</p>
                    <div className="card-footer">
                      <div className="card-user">
                        <div className="avatar">
                          {getInitial(item.user?.name)}
                        </div>
                        {item.user?.name || "Anonymous"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently Found */}
      <section style={{ marginTop: "3rem" }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">🟢 Recently Found Items</h2>
            <p className="section-subtitle">
              Check if your lost item has been found
            </p>
          </div>
          <Link to="/found" className="btn btn-outline btn-sm">
            View All →
          </Link>
        </div>
        {recentFound.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔎</div>
            <h3>No found items reported yet</h3>
            <p>Found something? Report it here</p>
            <Link to="/add-found" className="btn btn-primary">
              Report Found Item
            </Link>
          </div>
        ) : (
          <div className="items-grid">
            {recentFound.map((item) => {
              const catInfo = getCategoryInfo(item.category);
              return (
                <Link
                  to={`/item/found/${item._id}`}
                  key={item._id}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="card-badge badge-found">Found</span>
                  {getImageUrl(item) ? (
                    <img
                      src={getImageUrl(item)}
                      alt={item.title}
                      className="card-image"
                    />
                  ) : (
                    <div className="card-image-placeholder">{catInfo.icon}</div>
                  )}
                  <div className="card-body">
                    <div className="card-category-badge">
                      {catInfo.icon} {catInfo.label}
                    </div>
                    <h3 className="card-title">{item.title}</h3>
                    <div className="card-meta">
                      <span>📍 {item.locationName || "Location set"}</span>
                      <span>📅 {new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <p className="card-description">{item.description}</p>
                    <div className="card-footer">
                      <div className="card-user">
                        <div className="avatar">
                          {getInitial(item.user?.name)}
                        </div>
                        {item.user?.name || "Anonymous"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
