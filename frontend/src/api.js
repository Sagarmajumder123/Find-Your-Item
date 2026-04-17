import axios from "axios";

const API = axios.create({
  baseURL: "https://find-your-item-oxzn.onrender.com",
});

// ✅ Auto-attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===================== AUTH =====================
export const register = (data) => API.post("/auth/register", data);
export const login = (data) => API.post("/auth/login", data);
export const getMe = () => API.get("/auth/me");

// ===================== LOST ITEMS =====================
export const getLostItems = (params) => API.get("/lost", { params });
export const getLostItem = (id) => API.get(`/lost/${id}`);
export const createLostItem = (data) =>
  API.post("/lost", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateLostItem = (id, data) =>
  API.put(`/lost/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteLostItem = (id) => API.delete(`/lost/${id}`);
export const getMyLostItems = () => API.get("/lost/user/me");

// ===================== FOUND ITEMS =====================
export const getFoundItems = (params) => API.get("/found", { params });
export const getFoundItem = (id) => API.get(`/found/${id}`);
export const createFoundItem = (data) =>
  API.post("/found", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateFoundItem = (id, data) =>
  API.put(`/found/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteFoundItem = (id) => API.delete(`/found/${id}`);
export const getMyFoundItems = () => API.get("/found/user/me");

// ===================== CHAT =====================
export const getConversations = () => API.get("/chat/conversations");
export const getMessages = (userId, params) => API.get(`/chat/messages/${userId}`, { params });
export const sendMessage = (data) => API.post("/chat/messages", data);
export const getUnreadCount = () => API.get("/chat/unread");
export const uploadChatFile = (formData) =>
  API.post("/chat/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateMessageStatus = (id, status) =>
  API.put(`/chat/messages/${id}/status`, { status });
export const getUserStatus = (userId) => API.get(`/chat/user-status/${userId}`);

// ===================== MATCHES =====================
export const getMatches = (params) => API.get("/matches", { params });
export const getMyMatches = (params) => API.get("/matches/my", { params });
export const claimMatch = (data) => API.post("/matches/claim", data);
export const resolveMatch = (data) => API.post("/matches/resolve", data);

// ===================== NOTIFICATIONS =====================
export const getNotifications = (params) => API.get("/notifications", { params });
export const getNotificationUnreadCount = () => API.get("/notifications/unread-count");
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.put("/notifications/read-all");
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);

// ===================== CHAT VALIDATION =====================
export const checkChatAllowed = (otherUserId) => API.get(`/matches/check-chat/${otherUserId}`);

export default API;