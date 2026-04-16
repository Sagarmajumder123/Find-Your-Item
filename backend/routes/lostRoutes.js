const express = require("express");
const router = express.Router();
const LostItem = require("../models/LostItem");
const FoundItem = require("../models/FoundItem");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const upload = require("../config/multer");
const { calculateMatchScore } = require("../utils/haversine");
const fs = require("fs");
const path = require("path");

const CATEGORIES = LostItem.CATEGORIES;
const COLORS = LostItem.COLORS;

// ================= GET ALL LOST ITEMS =================
router.get("/", async (req, res) => {
  try {
    const { search, location, dateFrom, dateTo, category, color, status } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (location) query.locationName = { $regex: location, $options: "i" };
    if (category && CATEGORIES.includes(category)) query.category = category;
    if (color && COLORS.includes(color)) query.color = color;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }
    const items = await LostItem.find(query).populate("user", "name email").sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error("GET lost items error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/user/me", protect, async (req, res) => {
  try {
    const items = await LostItem.find({ user: req.user._id }).populate("user", "name email").sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await LostItem.findById(req.params.id).populate("user", "name email");
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= CREATE LOST ITEM =================
router.post("/", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, category, color, brand, reward, latitude, longitude, locationName, date } = req.body;

    if (!title || !description || !category || !color) {
      return res.status(400).json({ message: "Title, description, category, and color are required" });
    }
    if (!CATEGORIES.includes(category)) return res.status(400).json({ message: "Invalid category" });
    if (!COLORS.includes(color)) return res.status(400).json({ message: "Invalid color" });

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ message: "Valid latitude and longitude are required" });

    const images = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];

    const item = new LostItem({
      title, description, category, color,
      brand: brand || '',
      reward: reward ? parseFloat(reward) : 0,
      location: { type: 'Point', coordinates: [lng, lat] },
      locationName: locationName || '',
      date: date || new Date(),
      images,
      user: req.user._id,
    });

    const savedItem = await item.save();
    const populatedItem = await LostItem.findById(savedItem._id).populate("user", "name email");

    // ===== TRIGGER MATCHING + SOCKET.IO NOTIFICATION =====
    const io = req.app.get("io");
    triggerMatching(populatedItem, 'lost', io).catch(err => console.error("Match trigger error:", err));

    res.status(201).json(populatedItem);
  } catch (error) {
    console.error("CREATE lost item error:", error);
    res.status(400).json({ message: error.message });
  }
});

// ================= UPDATE LOST ITEM =================
router.put("/:id", protect, upload.array("images", 10), async (req, res) => {
  try {
    const item = await LostItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });

    const { title, description, category, color, brand, reward, latitude, longitude, locationName, date, existingImages } = req.body;

    let keepImages = [];
    if (existingImages) keepImages = JSON.parse(existingImages);

    const removedImages = item.images.filter((img) => !keepImages.includes(img));
    removedImages.forEach((img) => {
      const filePath = path.join(__dirname, "..", img);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    const newImages = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];
    const allImages = [...keepImages, ...newImages];

    item.title = title || item.title;
    item.description = description || item.description;
    item.date = date || item.date;
    item.images = allImages;
    if (category && CATEGORIES.includes(category)) item.category = category;
    if (color && COLORS.includes(color)) item.color = color;
    if (brand !== undefined) item.brand = brand;
    if (reward !== undefined) item.reward = parseFloat(reward) || 0;
    if (locationName) item.locationName = locationName;

    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    if (!isNaN(latVal) && !isNaN(lngVal)) {
      item.location = { type: 'Point', coordinates: [lngVal, latVal] };
    }

    const updatedItem = await item.save();
    const populatedItem = await LostItem.findById(updatedItem._id).populate("user", "name email");
    res.json(populatedItem);
  } catch (error) {
    console.error("UPDATE lost item error:", error);
    res.status(400).json({ message: error.message });
  }
});

// ================= DELETE LOST ITEM =================
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await LostItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });
    item.images.forEach((img) => {
      const filePath = path.join(__dirname, "..", img);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    await LostItem.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= MATCHING TRIGGER — FIXED WITH SOCKET.IO EMIT =================
async function triggerMatching(newItem, type, io) {
  try {
    const maxDist = 50;

    if (type === 'lost') {
      const foundItems = await FoundItem.find({
        status: 'active',
        category: newItem.category,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: newItem.location.coordinates },
            $maxDistance: maxDist * 1000
          }
        }
      }).populate("user", "name email").limit(10);

      for (const foundItem of foundItems) {
        if (foundItem.user._id.toString() === newItem.user._id.toString()) continue;

        const matchResult = calculateMatchScore(newItem, foundItem);
        if (matchResult.score < 50) continue; // Only category+ matches

        // Notify found item owner
        await createAndEmitNotification(io, {
          userId: foundItem.user._id,
          newItem, otherItem: foundItem, matchResult,
          message: `A lost "${newItem.title}" matches your found item! ${matchResult.distance}km away. Score: ${matchResult.score}%`,
        });

        // Notify lost item owner
        await createAndEmitNotification(io, {
          userId: newItem.user._id,
          newItem: foundItem, otherItem: newItem, matchResult,
          message: `A found "${foundItem.title}" matches your lost item! ${matchResult.distance}km away. Score: ${matchResult.score}%`,
        });
      }
    }
  } catch (err) {
    console.error("Matching trigger error:", err);
  }
}

async function createAndEmitNotification(io, { userId, newItem, otherItem, matchResult, message }) {
  const lostId = otherItem.category ? otherItem._id : newItem._id;
  const foundId = newItem._id;

  // Prevent duplicate notifications
  const exists = await Notification.findOne({
    user: userId,
    type: 'match',
    'data.lostItemId': lostId.toString(),
    'data.foundItemId': foundId.toString()
  });
  if (exists) return;

  const notification = await Notification.create({
    user: userId,
    type: 'match',
    title: `🔗 ${matchResult.label} Match!`,
    message,
    data: {
      lostItemId: lostId.toString(),
      foundItemId: foundId.toString(),
      score: matchResult.score,
      distance: matchResult.distance,
      label: matchResult.label
    }
  });

  // ✅ EMIT VIA SOCKET.IO — real-time notification
  if (io) {
    io.to(`user_${userId.toString()}`).emit('newNotification', notification);
    io.to(`user_${userId.toString()}`).emit('newMatchNotification', {
      notification,
      matchScore: matchResult.score,
      distance: matchResult.distance
    });
  }
}

module.exports = router;