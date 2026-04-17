import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getFoundItems, BASE_URL } from "../api";
import { CATEGORIES } from "./CategorySelector";

const API_BASE = BASE_URL;

const getCategoryInfo = (id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat || { id: "other", label: "Other", icon: "📦" };
};

const FoundItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [locationFilter, setLocationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchItems = async (params = {}) => {
    setLoading(true);
    try {
      const res = await getFoundItems(params);
      const data = res.data || res;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load found items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (locationFilter) params.location = locationFilter;
    if (categoryFilter) params.category = categoryFilter;
    fetchItems(params);
  }, [search, locationFilter, categoryFilter]);

  const getImageUrl = (item) => {
    if (item.images && item.images.length > 0) {
      return `${API_BASE}${item.images[0]}`;
    }
    return null;
  };

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="section-title">🔎 Found Items</h1>
          <p className="section-subtitle">
            {items.length} item{items.length !== 1 ? "s" : ""} found and
            reported
          </p>
        </div>
        <Link to="/add-found" className="btn btn-success">
          + Report Found Item
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="🔍 Search found items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="text"
          placeholder="📍 Filter by location..."
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          style={{ minWidth: "180px" }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-category-select"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading found items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔎</div>
          <h3>No found items listed</h3>
          <p>
            {search || locationFilter || categoryFilter
              ? "Try adjusting your search filters"
              : "No one has reported a found item yet"}
          </p>
          <Link to="/add-found" className="btn btn-success">
            Report Found Item
          </Link>
        </div>
      ) : (
        <div className="items-grid">
          {items.map((item) => {
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
                    <span className="btn btn-success btn-sm">View Details</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FoundItems;
