const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const upload = require("../config/multer");
const Notification = require("../models/Notification");

// ================= GET CONVERSATIONS LIST =================
// Returns list of users the current user has chatted with
router.get("/conversations", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all unique users this user has exchanged messages with
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          },
          lastMessage: { $first: "$text" },
          lastMessageDate: { $first: "$createdAt" },
          lastMessageFileUrl: { $first: "$fileUrl" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", userId] },
                    { $ne: ["$status", "seen"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { lastMessageDate: -1 },
      },
    ]);

    // Populate user details with online status
    const conversations = await Promise.all(
      messages.map(async (msg) => {
        const user = await User.findById(msg._id).select("name email isOnline lastSeen");
        return {
          user: user,
          lastMessage: msg.lastMessage || (msg.lastMessageFileUrl ? '📎 File' : ''),
          lastMessageDate: msg.lastMessageDate,
          unreadCount: msg.unreadCount,
        };
      })
    );

    res.json(conversations);
  } catch (error) {
    console.error("GET conversations error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= GET MESSAGES WITH A USER =================
router.get("/messages/:userId", protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await Message.countDocuments({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    });

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
      deletedFor: { $ne: currentUserId } // Hide if deleted for me
    })
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as seen
    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: currentUserId,
        status: { $ne: 'seen' },
      },
      { status: 'seen', read: true }
    );

    res.json({
      messages,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("GET messages error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= SEND MESSAGE =================
router.post("/messages", protect, async (req, res) => {
  try {
    const { receiverId, text, fileUrl, fileName } = req.body;

    if (!receiverId || (!text && !fileUrl)) {
      return res
        .status(400)
        .json({ message: "Receiver and text/file are required" });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Verify a match exists between them
    const matchExists = await Notification.findOne({
      $or: [
        { user: req.user._id, 'data.chatUserId': receiverId.toString() },
        { user: receiverId, 'data.chatUserId': req.user._id.toString() },
        // Also check raw match notifications
        { 
          type: 'match',
          $or: [
            { user: req.user._id, 'data.foundItemId': { $exists: true } }, 
            { user: receiverId, 'data.foundItemId': { $exists: true } }
          ]
        }
      ]
    });

    // Simple check: do they have any type='match' notification together?
    // A better way: check if they have a common lost/found pair match notification
    const commonMatch = await Notification.findOne({
      type: 'match',
      $or: [
        { user: req.user._id, 'data.ownerId': receiverId.toString() }, // if we stored ownerId
        { 
          'data.lostItemId': { $exists: true }, 
          'data.foundItemId': { $exists: true },
          // This is getting complex, let's use a simpler heuristic for now:
          // A match notification exists for THIS user regarding SOME item they own vs OTHER user
        }
      ]
    });
    
    // Let's refine the match check: 
    // Is there a notification for req.user._id where data contains an item owned by receiverId?
    // OR vice versa.
    
    // Check if there is a match notification for the current user that links to the receiver as either owner or finder
    const validMatch = await Notification.findOne({
      type: 'match',
      user: req.user._id,
      $or: [
        { 'data.ownerId': receiverId.toString() },
        { 'data.finderId': receiverId.toString() }
      ]
    });
    
    // Also check vice-versa just in case (e.g. if the other user initiated the match info)
    const validMatchReverse = await Notification.findOne({
      type: 'match',
      user: receiverId,
      $or: [
        { 'data.ownerId': req.user._id.toString() },
        { 'data.finderId': req.user._id.toString() }
      ]
    });

    if (!validMatch && !validMatchReverse) {
       return res.status(403).json({ message: "You must have a verified match to initiate chat" });
    }

    const message = new Message({
      sender: req.user._id,
      receiver: receiverId,
      text: text || '',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      status: 'sent'
    });

    const savedMessage = await message.save();
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate("sender", "name email")
      .populate("receiver", "name email");

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("SEND message error:", error);
    res.status(400).json({ message: error.message });
  }
});

// ================= UPLOAD FILE FOR CHAT =================
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;

    res.json({ fileUrl, fileName });
  } catch (error) {
    console.error("UPLOAD file error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= UPDATE MESSAGE STATUS =================
router.put("/messages/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['delivered', 'seen'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only receiver can update status
    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Status can only go forward: sent -> delivered -> seen
    const statusOrder = { sent: 0, delivered: 1, seen: 2 };
    if (statusOrder[status] <= statusOrder[message.status]) {
      return res.json(message); // Already at or past this status
    }

    message.status = status;
    if (status === 'seen') message.read = true;
    await message.save();

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET UNREAD COUNT =================
router.get("/unread", protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      status: { $ne: 'seen' },
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET USER ONLINE STATUS =================
router.get("/user-status/:userId", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("isOnline lastSeen name");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      name: user.name
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DELETE MESSAGE =================
router.delete("/messages/:id", protect, async (req, res) => {
  try {
    const { type } = req.query; // 'me' or 'everyone'
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (type === 'everyone') {
      // Only sender can delete for everyone
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only sender can delete for everyone" });
      }
      message.isDeletedForAll = true;
      // Clear content for everyone (keep placeholder in UI)
      message.text = "";
      message.fileUrl = null;
      message.fileName = null;
      await message.save();

      // Notify via socket (if possible here or handle in frontend socket emit)
      const io = req.app.get("io");
      if (io) {
        const receiverId = message.receiver.toString();
        const senderId = message.sender.toString();
        io.to(`user_${receiverId}`).emit("messageDeleted", { messageId: message._id, type: 'everyone' });
        io.to(`user_${senderId}`).emit("messageDeleted", { messageId: message._id, type: 'everyone' });
      }
    } else {
      // Delete for me
      if (!message.deletedFor.includes(req.user._id)) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }
    }

    res.json({ message: "Message deleted successfully", messageId: message._id, type });
  } catch (error) {
    console.error("DELETE message error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
