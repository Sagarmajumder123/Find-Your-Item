import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLostItems, getFoundItems, BASE_URL } from "../api";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = BASE_URL;

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const Home = () => {
  const [recentLost, setRecentLost] = useState([]);
  const [recentFound, setRecentFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
        setRecentLost(Array.isArray(lostData) ? lostData.slice(0, 4) : []);
        setRecentFound(Array.isArray(foundData) ? foundData.slice(0, 4) : []);
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
    if (item.images && item.images.length > 0) return `${API_BASE}${item.images[0]}`;
    return null;
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="home-root">
      {/* Dynamic Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-content animate-in">
          <div className="hero-badge">✨ Community Driven Platform</div>
          <h1 className="hero-title">
            Reuniting <span className="text-primary">Hearts</span> with their <span className="text-primary">Belongings</span>
          </h1>
          <p className="hero-description">
            The most advanced community-powered portal to report lost items and find what you've missing. 
            Real-time matching, instant chat, and verified listings.
          </p>

          <form onSubmit={handleSearch} className="hero-search-box">
            <input 
              type="text" 
              placeholder="What are you looking for?" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div className="hero-actions">
            <Link to="/add-lost" className="btn btn-primary btn-lg">📦 Report Lost</Link>
            <Link to="/add-found" className="btn btn-secondary btn-lg">🔎 Post Found</Link>
          </div>
        </div>
      </section>

      <div className="page-container" style={{ paddingTop: '40px' }}>
        {/* Features / How it works */}
        <section className="features-grid grid grid-cols-3">
          <div className="feature-card glass-card">
            <div className="feature-icon">🔍</div>
            <h3>Smart Matching</h3>
            <p>Our AI-powered engine automatically finds potential matches based on category, location, and time.</p>
          </div>
          <div className="feature-card glass-card border-primary">
            <div className="feature-icon">🛡️</div>
            <h3>Privacy First</h3>
            <p>Your privacy matters. Only verified matches can initiate contact through our secure chat system.</p>
          </div>
          <div className="feature-card glass-card">
            <div className="feature-icon">🤝</div>
            <h3>Community Support</h3>
            <p>Join thousands of users helping each other reunite with their cherished belongings every day.</p>
          </div>
        </section>

        {/* Recently Lost */}
        <section className="recent-section">
          <div className="section-header">
            <h2 className="section-title">🔴 Lost Recently</h2>
            <Link to="/lost" className="text-primary">View All →</Link>
          </div>
          <div className="items-grid grid grid-cols-4">
            {recentLost.map((item) => {
              const cat = getCategoryInfo(item.category);
              return (
                <Link to={`/item/lost/${item._id}`} key={item._id} className="item-card-mini glass-card">
                  <div className="card-img-wrapper">
                    {getImageUrl(item) ? (
                      <img src={getImageUrl(item)} alt={item.title} />
                    ) : (
                      <div className="card-placeholder">{cat.icon}</div>
                    )}
                  </div>
                  <div className="card-info">
                    <h4>{item.title}</h4>
                    <span>📍 {item.locationName?.split(',')[0]}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recently Found */}
        <section className="recent-section">
          <div className="section-header">
            <h2 className="section-title">🟢 Found Recently</h2>
            <Link to="/found" className="text-primary">View All →</Link>
          </div>
          <div className="items-grid grid grid-cols-4">
            {recentFound.map((item) => {
              const cat = getCategoryInfo(item.category);
              return (
                <Link to={`/item/found/${item._id}`} key={item._id} className="item-card-mini glass-card">
                  <div className="card-img-wrapper">
                    {getImageUrl(item) ? (
                      <img src={getImageUrl(item)} alt={item.title} />
                    ) : (
                      <div className="card-placeholder">{cat.icon}</div>
                    )}
                  </div>
                  <div className="card-info">
                    <h4>{item.title}</h4>
                    <span>📍 {item.locationName?.split(',')[0]}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
