import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as registerAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import { showToast } from "./Toast";

const Register = () => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const validate = () => {
    if (formData.name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      const res = await registerAPI({
        name: formData.name, email: formData.email, password: formData.password
      });
      const data = res?.data || res;
      if (!data || !data.token) throw new Error("Invalid response");
      login({ _id: data.user._id, name: data.user.name, email: data.user.email }, data.token);
      showToast(`Welcome, ${data.user.name}!`, "success");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    const pw = formData.password;
    if (!pw) return { level: 0, text: '', color: '' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { level: score, text: 'Weak', color: '#EF4444' };
    if (score <= 3) return { level: score, text: 'Medium', color: '#F59E0B' };
    return { level: score, text: 'Strong', color: '#10B981' };
  };

  const strength = passwordStrength();

  return (
    <div className="page-container">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div className="auth-icon">🚀</div>
          <h1 className="form-title">Create Account</h1>
          <p className="form-subtitle" style={{ marginBottom: 0 }}>
            Join our community and help find lost items
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required className="input-with-icon" />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <span className="input-icon">📧</span>
              <input type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} required className="input-with-icon" />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="input-with-icon"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {/* Password strength */}
            {formData.password && (
              <div className="password-strength">
                <div className="password-strength-bar">
                  <div className="password-strength-fill" style={{ width: `${(strength.level / 5) * 100}%`, background: strength.color }}></div>
                </div>
                <span className="password-strength-text" style={{ color: strength.color }}>{strength.text}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                className="input-with-icon"
              />
              <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="field-error">Passwords don't match</p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && formData.confirmPassword.length >= 6 && (
              <p className="field-success">✓ Passwords match</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? (
              <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>Creating...</>
            ) : "Create Account →"}
          </button>
        </form>

        <p className="form-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;