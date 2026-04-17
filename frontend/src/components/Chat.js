import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  getConversations, getMessages, sendMessage as sendMessageAPI,
  uploadChatFile, getUserStatus, BASE_URL
} from "../api";
import { playMessageSound, playSentSound } from "../utils/sounds";

const API_BASE = BASE_URL;

const Chat = () => {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isUserOnline, joinChatRoom, leaveChatRoom } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(paramUserId || null);
  const [activeChatRoom, setActiveChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [chatUserStatus, setChatUserStatus] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selfChatError, setSelfChatError] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // ===== SELF-MESSAGE BLOCK =====
  useEffect(() => {
    if (activeChat && user && activeChat === user._id) {
      setSelfChatError(true);
    } else {
      setSelfChatError(false);
    }
  }, [activeChat, user]);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await getConversations();
        // Filter out self-conversations
        const convos = (res.data || []).filter(c => c.user?._id !== user?._id);
        setConversations(convos);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [user]);

  const fetchMessages = useCallback(async (chatUserId) => {
    if (!chatUserId) return;
    try {
      const res = await getMessages(chatUserId);
      const data = res.data;
      setMessages(data.messages || data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, []);

  useEffect(() => {
    if (activeChat && !selfChatError) {
      fetchMessages(activeChat);
      getUserStatus(activeChat).then((res) => setChatUserStatus(res.data)).catch(() => {});

      const roomId = joinChatRoom(activeChat);
      setActiveChatRoom(roomId);

      if (socket) socket.emit("markAllSeen", { senderId: activeChat });

      return () => { if (roomId) leaveChatRoom(roomId); };
    }
  }, [activeChat, selfChatError, fetchMessages, joinChatRoom, leaveChatRoom, socket]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
      const senderId = message.sender?._id || message.sender;
      // Don't process messages from self
      if (senderId === user?._id) return;

      setMessages((prev) => [...prev, message]);
      playMessageSound(); // 🔊 Sound on receive

      if (message._id) {
        socket.emit("messageSeen", { messageId: message._id, senderId });
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.user?._id === senderId);
        if (existing) {
          return prev.map((c) =>
            c.user?._id === senderId
              ? { ...c, lastMessage: message.text || "📎 File", lastMessageDate: message.createdAt }
              : c
          );
        }
        return prev;
      });
    };

    const handleTyping = () => setTyping(true);
    const handleStopTyping = () => setTyping(false);

    const handleStatusUpdate = ({ messageId, status }) => {
      setMessages((prev) => prev.map((msg) => msg._id === messageId ? { ...msg, status } : msg));
    };

    const handleAllSeen = ({ by }) => {
      if (by === activeChat) {
        setMessages((prev) =>
          prev.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            if (senderId === user?._id && msg.status !== "seen") return { ...msg, status: "seen" };
            return msg;
          })
        );
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("userTyping", handleTyping);
    socket.on("userStopTyping", handleStopTyping);
    socket.on("messageStatusUpdate", handleStatusUpdate);
    socket.on("allMessagesSeen", handleAllSeen);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("userTyping", handleTyping);
      socket.off("userStopTyping", handleStopTyping);
      socket.off("messageStatusUpdate", handleStatusUpdate);
      socket.off("allMessagesSeen", handleAllSeen);
    };
  }, [socket, activeChat, user]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Typing indicator
  const handleTypingInput = (e) => {
    setNewMessage(e.target.value);
    if (socket && activeChat) {
      socket.emit("typing", { receiverId: activeChat, senderName: user?.name, chatRoomId: activeChatRoom });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stopTyping", { receiverId: activeChat, chatRoomId: activeChatRoom });
      }, 1500);
    }
  };

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || sending || selfChatError) return;

    setSending(true);
    try {
      const res = await sendMessageAPI({ receiverId: activeChat, text: newMessage.trim() });
      const savedMessage = res.data;
      setMessages((prev) => [...prev, savedMessage]);
      playSentSound(); // 🔊 Sound on send

      if (socket) {
        socket.emit("sendMessage", { receiverId: activeChat, message: savedMessage, chatRoomId: activeChatRoom });
        socket.emit("stopTyping", { receiverId: activeChat, chatRoomId: activeChatRoom });
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.user?._id === activeChat);
        if (existing) {
          return prev.map((c) =>
            c.user?._id === activeChat ? { ...c, lastMessage: newMessage.trim(), lastMessageDate: new Date() } : c
          );
        }
        return [{ user: savedMessage.receiver, lastMessage: newMessage.trim(), lastMessageDate: new Date(), unreadCount: 0 }, ...prev];
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally { setSending(false); }
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat || selfChatError) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await uploadChatFile(formData);
      const { fileUrl, fileName } = uploadRes.data;
      const res = await sendMessageAPI({ receiverId: activeChat, text: "", fileUrl, fileName });
      const savedMessage = res.data;
      setMessages((prev) => [...prev, savedMessage]);
      playSentSound();

      if (socket) socket.emit("sendMessage", { receiverId: activeChat, message: savedMessage, chatRoomId: activeChatRoom });

      setConversations((prev) => {
        const existing = prev.find((c) => c.user?._id === activeChat);
        if (existing) return prev.map((c) => c.user?._id === activeChat ? { ...c, lastMessage: "📎 " + fileName, lastMessageDate: new Date() } : c);
        return prev;
      });
    } catch (err) {
      console.error("Failed to upload file:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");
  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  };

  const getLastSeen = () => {
    if (!chatUserStatus) return "";
    if (isUserOnline(activeChat)) return "Online";
    if (chatUserStatus.lastSeen) {
      const diff = Math.floor((new Date() - new Date(chatUserStatus.lastSeen)) / 1000);
      if (diff < 60) return "Last seen just now";
      if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
      return `Last seen ${new Date(chatUserStatus.lastSeen).toLocaleDateString()}`;
    }
    return "Offline";
  };

  // ===== "Sent" / "Delivered" / "Seen" TAGS (not ticks) =====
  const renderMessageStatus = (msg) => {
    const senderId = msg.sender?._id || msg.sender;
    if (senderId !== user?._id) return null;

    const status = msg.status || "sent";
    switch (status) {
      case "seen":
        return <span className="msg-tag msg-tag-seen">Seen</span>;
      case "delivered":
        return <span className="msg-tag msg-tag-delivered">Delivered</span>;
      default:
        return <span className="msg-tag msg-tag-sent">Sent</span>;
    }
  };

  const isImageFile = (url) => url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  const getActiveUser = () => conversations.find((c) => c.user?._id === activeChat)?.user;

  const getMessageGroups = () => {
    const groups = [];
    let currentDate = null;
    messages.forEach((msg) => {
      const date = formatDate(msg.createdAt);
      if (date !== currentDate) { currentDate = date; groups.push({ type: "date", date }); }
      groups.push({ type: "message", data: msg });
    });
    return groups;
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading chats...</p></div>;

  return (
    <div className="page-container">
      <div className="chat-container">
        {/* Sidebar */}
        <div className={`chat-sidebar ${!activeChat ? "show" : ""}`}>
          <div className="chat-sidebar-header">💬 Messages</div>
          <div className="chat-list">
            {conversations.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}><p style={{ fontSize: "0.875rem" }}>No conversations yet</p></div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.user?._id}
                  className={`chat-list-item ${activeChat === conv.user?._id ? "active" : ""}`}
                  onClick={() => { setActiveChat(conv.user?._id); navigate(`/chat/${conv.user?._id}`, { replace: true }); }}
                >
                  <div className="chat-list-avatar">
                    {getInitial(conv.user?.name)}
                    {isUserOnline(conv.user?._id) && <span className="online-dot"></span>}
                  </div>
                  <div className="chat-list-info">
                    <div className="chat-list-name">{conv.user?.name || "Unknown"}</div>
                    <div className="chat-list-preview">{conv.lastMessage}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="chat-list-time">{formatDate(conv.lastMessageDate)}</div>
                    {conv.unreadCount > 0 && <div className="chat-list-unread">{conv.unreadCount}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Main */}
        <div className="chat-main">
          {activeChat ? (
            selfChatError ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">🚫</div>
                <h3>Can't message yourself</h3>
                <p>You cannot send messages to your own account. Select another conversation.</p>
                <button className="btn btn-secondary" onClick={() => { setActiveChat(null); navigate("/chat", { replace: true }); }}>
                  ← Back to conversations
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="chat-main-header">
                  <button className="btn btn-secondary btn-sm back-btn" onClick={() => { setActiveChat(null); navigate("/chat", { replace: true }); }}>←</button>
                  <div className="chat-list-avatar" style={{ width: 36, height: 36 }}>
                    {getInitial(getActiveUser()?.name)}
                    {isUserOnline(activeChat) && <span className="online-dot small"></span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{getActiveUser()?.name || "User"}</div>
                    <div className={`chat-user-status ${isUserOnline(activeChat) ? "online" : "offline"}`}>
                      {typing ? (
                        <span className="typing-indicator">
                          <span className="typing-dots"><span></span><span></span><span></span></span>
                          typing...
                        </span>
                      ) : getLastSeen()}
                    </div>
                  </div>
                </div>

                {/* Messages — SCROLLABLE */}
                <div className="chat-messages" ref={messagesContainerRef}>
                  {messages.length === 0 ? (
                    <div className="chat-empty"><div className="chat-empty-icon">💬</div><p>No messages yet. Say hello!</p></div>
                  ) : (
                    getMessageGroups().map((group, i) => {
                      if (group.type === "date") {
                        return <div key={`date-${i}`} className="chat-date-separator"><span>{group.date}</span></div>;
                      }
                      const msg = group.data;
                      const isSent = (msg.sender?._id || msg.sender) === user?._id;

                      return (
                        <div key={msg._id || i} className={`chat-message ${isSent ? "sent" : "received"} animate-msg`}>
                          {!isSent && <div className="chat-message-sender">{msg.sender?.name || ""}</div>}
                          {msg.fileUrl && (
                            <div className="chat-file-attachment">
                              {isImageFile(msg.fileUrl) ? (
                                <img src={`${API_BASE}${msg.fileUrl}`} alt={msg.fileName || "Attachment"} className="chat-file-image" onClick={() => window.open(`${API_BASE}${msg.fileUrl}`, "_blank")} />
                              ) : (
                                <a href={`${API_BASE}${msg.fileUrl}`} target="_blank" rel="noopener noreferrer" className="chat-file-link">📎 {msg.fileName || "File"}</a>
                              )}
                            </div>
                          )}
                          {msg.text && <div>{msg.text}</div>}
                          <div className="chat-message-time">
                            {formatTime(msg.createdAt)}
                            {renderMessageStatus(msg)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form className="chat-input-area" onSubmit={handleSend}>
                  <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.txt" />
                  <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} title="Attach file">
                    {uploadingFile ? "⏳" : "📎"}
                  </button>
                  <input type="text" className="chat-input" placeholder="Type a message..." value={newMessage} onChange={handleTypingInput} maxLength={2000} />
                  <button type="submit" className="chat-send-btn" disabled={!newMessage.trim() || sending} title="Send message">
                    ➤
                  </button>
                </form>
              </>
            )
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the sidebar or contact someone from a matched item</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
