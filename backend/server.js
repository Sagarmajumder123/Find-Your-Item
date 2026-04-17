const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO SETUP (Room-based, with online status)
========================= */
let io;
const onlineUsers = new Map(); // { odId: socketId }

try {
  const { Server } = require("socket.io");
  io = new Server(server, {
  cors: {
    origin: "https://your-frontend-name.onrender.com", // Change this to your Render frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

  const User = require("./models/User");
  const Message = require("./models/Message");

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // ===== User joins with their userId =====
    socket.on("join", async (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      // Join personal room for targeted notifications
      socket.join(`user_${userId}`);

      // Update online status in DB
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error("Error updating online status:", err);
      }

      // Broadcast online status to all connected clients
      io.emit("userOnline", { userId });
      console.log(`👤 User ${userId} is online`);
    });

    // ===== Join chat room (room-based messaging) =====
    socket.on("joinChat", ({ chatRoomId }) => {
      socket.join(chatRoomId);
      console.log(`💬 Socket joined room: ${chatRoomId}`);
    });

    socket.on("leaveChat", ({ chatRoomId }) => {
      socket.leave(chatRoomId);
    });

    // ===== Send message (emit to room only) =====
    socket.on("sendMessage", (data) => {
      const { receiverId, message, chatRoomId } = data;

      // Emit to the chat room
      if (chatRoomId) {
        socket.to(chatRoomId).emit("receiveMessage", message);
      }

      // Also emit to receiver's personal room (for unread count updates)
      io.to(`user_${receiverId}`).emit("newMessageNotification", {
        senderId: socket.userId,
        message
      });

      // Mark as delivered if receiver is online
      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket && message._id) {
        Message.findByIdAndUpdate(message._id, { status: 'delivered' })
          .catch(err => console.error("Delivery status update error:", err));

        io.to(`user_${socket.userId}`).emit("messageStatusUpdate", {
          messageId: message._id,
          status: 'delivered'
        });
      }
    });

    // ===== Message status updates =====
    socket.on("messageDelivered", async ({ messageId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { status: 'delivered' });
        io.to(`user_${senderId}`).emit("messageStatusUpdate", {
          messageId,
          status: 'delivered'
        });
      } catch (err) {
        console.error("Delivery update error:", err);
      }
    });

    socket.on("messageSeen", async ({ messageId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { status: 'seen', read: true });
        io.to(`user_${senderId}`).emit("messageStatusUpdate", {
          messageId,
          status: 'seen'
        });
      } catch (err) {
        console.error("Seen update error:", err);
      }
    });

    // ===== Mark all messages from sender as seen =====
    socket.on("markAllSeen", async ({ senderId }) => {
      try {
        const userId = socket.userId;
        if (!userId) return;

        await Message.updateMany(
          { sender: senderId, receiver: userId, status: { $ne: 'seen' } },
          { status: 'seen', read: true }
        );

        // Notify sender that messages are seen
        io.to(`user_${senderId}`).emit("allMessagesSeen", {
          by: userId
        });
      } catch (err) {
        console.error("Mark all seen error:", err);
      }
    });

    // ===== Typing indicator =====
    socket.on("typing", ({ receiverId, senderName, chatRoomId }) => {
      if (chatRoomId) {
        socket.to(chatRoomId).emit("userTyping", { senderName, senderId: socket.userId });
      } else {
        const receiverSocket = onlineUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("userTyping", { senderName });
        }
      }
    });

    socket.on("stopTyping", ({ receiverId, chatRoomId }) => {
      if (chatRoomId) {
        socket.to(chatRoomId).emit("userStopTyping", { senderId: socket.userId });
      } else {
        const receiverSocket = onlineUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("userStopTyping");
        }
      }
    });

    // ===== Get online users list =====
    socket.on("getOnlineUsers", () => {
      const onlineUserIds = Array.from(onlineUsers.keys());
      socket.emit("onlineUsersList", onlineUserIds);
    });

    // ===== Disconnect =====
    socket.on("disconnect", async () => {
      const userId = socket.userId;
      if (userId) {
        onlineUsers.delete(userId);

        // Update offline status in DB
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date()
          });
        } catch (err) {
          console.error("Error updating offline status:", err);
        }

        // Broadcast offline status
        io.emit("userOffline", { userId, lastSeen: new Date() });
        console.log(`👋 User ${userId} disconnected`);
      }
    });
  });
} catch (err) {
  console.log("⚠️ Socket.io not installed, chat will use polling only");
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES (UPLOADS)
========================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   ENV CHECK
========================= */
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env");
  process.exit(1);
}

/* =========================
   DATABASE CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

/* =========================
   ROUTES
========================= */
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/lost", require("./routes/lostRoutes"));
app.use("/api/found", require("./routes/foundRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/matches", require("./routes/matchRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Lost & Found API is running",
    socketIO: io ? "enabled" : "disabled",
    onlineUsers: onlineUsers.size,
  });
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Max 5MB per file." });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ message: "Too many files. Max 10 files." });
  }
  if (err.message && err.message.includes("Only image files")) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({
    message: "Internal Server Error",
  });
});

/* =========================
   MAKE IO ACCESSIBLE FOR ROUTES
========================= */
app.set("io", io);
app.set("onlineUsers", onlineUsers);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.use(cors({
    origin: "https://find-your-item-frontend.onrender.com", // Paste your actual Render frontend URL here
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));