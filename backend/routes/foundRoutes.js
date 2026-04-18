const express = require("express");
const router = express.Router();
const FoundItem = require("../models/FoundItem");
const LostItem = require("../models/LostItem");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const upload = require("../config/multer");
const { calculateMatchScore } = require("../utils/haversine");
const fs = require("fs");
const path = require("path");

const CATEGORIES = FoundItem.CATEGORIES;
const COLORS = FoundItem.COLORS;

// ================= GET ALL FOUND ITEMS (Restricted to User) =================
router.get("/", protect, async (req, res) => {
  try {
    const { search, location, dateFrom, dateTo, category, color, status } = req.query;
    const query = { user: req.user._id };
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
    const items = await FoundItem.find(query).populate("user", "name email").sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/user/me", protect, async (req, res) => {
  try {
    const items = await FoundItem.find({ user: req.user._id }).populate("user", "name email").sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await FoundItem.findById(req.params.id).populate("user", "name email");
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= CREATE FOUND ITEM =================
router.post("/", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, category, color, brand, latitude, longitude, locationName, date } = req.body;

    if (!title || !description || !category || !color) {
      return res.status(400).json({ message: "Title, description, category, and color are required" });
    }
    if (!CATEGORIES.includes(category)) return res.status(400).json({ message: "Invalid category" });
    if (!COLORS.includes(color)) return res.status(400).json({ message: "Invalid color" });

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ message: "Valid latitude and longitude are required" });

    const images = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];

    // NO reward field for found items
    const item = new FoundItem({
      title, description, category, color,
      brand: brand || '',
      location: { type: 'Point', coordinates: [lng, lat] },
      locationName: locationName || '',
      date: date || new Date(),
      images,
      user: req.user._id,
    });

    const savedItem = await item.save();
    const populatedItem = await FoundItem.findById(savedItem._id).populate("user", "name email");

    // ===== TRIGGER MATCHING + SOCKET.IO =====
    const io = req.app.get("io");
    triggerMatching(populatedItem, 'found', io).catch(err => console.error("Match trigger error:", err));

    res.status(201).json(populatedItem);
  } catch (error) {
    console.error("CREATE found item error:", error);
    res.status(400).json({ message: error.message });
  }
});

// ================= UPDATE =================
router.put("/:id", protect, upload.array("images", 10), async (req, res) => {
  try {
    const item = await FoundItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });

    const { title, description, category, color, brand, latitude, longitude, locationName, date, existingImages } = req.body;

    let keepImages = [];
    if (existingImages) keepImages = JSON.parse(existingImages);
    const removedImages = item.images.filter((img) => !keepImages.includes(img));
    removedImages.forEach((img) => {
      const filePath = path.join(__dirname, "..", img);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    const newImages = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];

    item.title = title || item.title;
    item.description = description || item.description;
    item.date = date || item.date;
    item.images = [...keepImages, ...newImages];
    if (category && CATEGORIES.includes(category)) item.category = category;
    if (color && COLORS.includes(color)) item.color = color;
    if (brand !== undefined) item.brand = brand;
    if (locationName) item.locationName = locationName;

    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    if (!isNaN(latVal) && !isNaN(lngVal)) {
      item.location = { type: 'Point', coordinates: [lngVal, latVal] };
    }

    const updatedItem = await item.save();
    const populatedItem = await FoundItem.findById(updatedItem._id).populate("user", "name email");
    res.json(populatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ================= DELETE =================
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await FoundItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });
    item.images.forEach((img) => {
      const filePath = path.join(__dirname, "..", img);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    await FoundItem.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= MATCHING TRIGGER =================
async function triggerMatching(newItem, type, io) {
  try {
    const maxDist = 50;
    if (type === 'found') {
      const lostItems = await LostItem.find({
        status: 'active',
        category: newItem.category,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: newItem.location.coordinates },
            $maxDistance: maxDist * 1000
          }
        }
      }).populate("user", "name email").limit(10);

      for (const lostItem of lostItems) {
        if (lostItem.user._id.toString() === newItem.user._id.toString()) continue;
        const matchResult = calculateMatchScore(lostItem, newItem);
        if (matchResult.score < 50) continue;

        // Notify lost item owner
        await createAndEmitNotification(io, {
          userId: lostItem.user._id,
          lostItemId: lostItem._id,
          foundItemId: newItem._id,
          matchResult,
          message: `A found "${newItem.title}" matches your lost item! ${matchResult.distance}km away. Score: ${matchResult.score}%`,
        });

        // Notify found item reporter
        await createAndEmitNotification(io, {
          userId: newItem.user._id,
          lostItemId: lostItem._id,
          foundItemId: newItem._id,
          matchResult,
          message: `A lost "${lostItem.title}" was reported ${matchResult.distance}km from your found item. Score: ${matchResult.score}%`,
        });
      }
    }
  } catch (err) {
    console.error("Matching trigger error:", err);
  }
}

async function createAndEmitNotification(io, { userId, lostItemId, foundItemId, matchResult, message }) {
  const exists = await Notification.findOne({
    user: userId, type: 'match',
    'data.lostItemId': lostItemId.toString(),
    'data.foundItemId': foundItemId.toString()
  });
  if (exists) return;

  const notification = await Notification.create({
    user: userId, type: 'match',
    title: `🔗 ${matchResult.label} Match!`,
    message,
    data: {
      lostItemId: lostItemId.toString(),
      foundItemId: foundItemId.toString(),
      score: matchResult.score,
      distance: matchResult.distance,
      label: matchResult.label
    }
  });

  if (io) {
    io.to(`user_${userId.toString()}`).emit('newNotification', notification);
    io.to(`user_${userId.toString()}`).emit('newMatchNotification', {
      notification, matchScore: matchResult.score, distance: matchResult.distance
    });
  }
}

module.exports = router;
