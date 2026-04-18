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

  // Theme support
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : "U";

  return (
    <header className={`navbar-header ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-container">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <img src="/logo.png" alt="FindYourItem" className="brand-logo" />
          <span className="brand-text">FindYourItem</span>
        </Link>

        {/* Desktop Nav */}
        <nav className={`navbar-links ${menuOpen ? "mobile-open" : ""}`}>
          <Link to="/" className={`nav-item ${isActive("/") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/lost" className={`nav-item ${isActive("/lost") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Lost</Link>
          <Link to="/found" className={`nav-item ${isActive("/found") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Found</Link>
          
          {user ? (
            <>
              <Link to="/matches" className={`nav-item ${isActive("/matches") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Matches</Link>
              <Link to="/chat" className={`nav-item ${isActive("/chat") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                Chat {unread > 0 && <span className="nav-unread">{unread}</span>}
              </Link>
              <Link to="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Dashboard</Link>
              
              <div className="nav-profile">
                <NotificationBell />
                {/* Theme Toggle Button */}
                <button 
                  className="theme-toggle" 
                  onClick={toggleTheme}
                  title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
                <div className="user-avatar" title={user.name}>{getInitial(user.name)}</div>
                <button onClick={handleLogout} className="nav-logout-text" title="Logout">Logout</button>
              </div>
            </>
          ) : (
            <div className="nav-auth-btns">
              <Link to="/login" className="nav-item" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Register</Link>
            </div>
          )}
        </nav>

        {/* Mobile Overlay */}
        {menuOpen && (
          <div className="navbar-overlay" onClick={() => setMenuOpen(false)}></div>
        )}

        {/* Mobile Toggle */}
        <button className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <div className={`hamburger ${menuOpen ? "active" : ""}`}>
            <span></span><span></span><span></span>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Navbar;