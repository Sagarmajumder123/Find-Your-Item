import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUnreadCount } from "../api";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  // Scroll shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch unread count
  useEffect(() => {
    if (user) {
      const fetchUnread = async () => {
        try {
          const res = await getUnreadCount();
          setUnread(res.data.unreadCount);
        } catch { }
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : "U";
  };

  return (
    <header className={`header ${scrolled ? "scrolled" : ""}`}>
      <nav className="navbar">
        {/* Brand */}
        <div className="navbar-brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <img src="/logo.png" alt="Logo" className="brand-logo-img" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span>Find Your Item</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        {/* Nav links */}
        <ul className={`navbar-nav ${menuOpen ? "open" : ""}`}>
          <li>
            <Link
              to="/"
              className={`nav-link ${isActive("/") ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              🏠 Home
            </Link>
          </li>
          <li>
            <Link
              to="/lost"
              className={`nav-link ${isActive("/lost") ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              📦 Lost
            </Link>
          </li>
          <li>
            <Link
              to="/found"
              className={`nav-link ${isActive("/found") ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              🔎 Found
            </Link>
          </li>

          {user ? (
            <>
              <li>
                <Link
                  to="/matches"
                  className={`nav-link ${isActive("/matches") ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  🔗 Matches
                </Link>
              </li>
              <li>
                <Link
                  to="/chat"
                  className={`nav-link ${isActive("/chat") ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  💬 Chat
                  {unread > 0 && <span className="badge">{unread}</span>}
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  📊 Dashboard
                </Link>
              </li>
              <li>
                <div className="nav-user-badge">
                  <div className="user-avatar">{getInitial(user.name)}</div>
                  {user.name}
                </div>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="nav-link nav-logout-btn"
                >
                  🚪 Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link
                  to="/login"
                  className={`nav-link ${isActive("/login") ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  🔐 Login
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="btn btn-primary btn-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  Get Started
                </Link>
              </li>
            </>
          )}

          {/* Notification Bell (only for logged-in users) */}
          {user && (
            <li className="nav-notification-li">
              <NotificationBell />
            </li>
          )}

          {/* Theme toggle */}
          <li>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Navbar;