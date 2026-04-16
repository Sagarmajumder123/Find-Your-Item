const express = require("express");
const router = express.Router();
const LostItem = require("../models/LostItem");
const FoundItem = require("../models/FoundItem");
const { protect } = require("../middleware/auth");
const { calculateMatchScore } = require("../utils/haversine");

// ================= GET ALL MATCHES (using MongoDB geo queries) =================
router.get("/", protect, async (req, res) => {
  try {
    const { category, maxDistance, minScore, page = 1, limit = 20 } = req.query;
    const maxDist = parseFloat(maxDistance) || 50; // Default 50km
    const minMatchScore = parseInt(minScore) || 0;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all active lost items
    let lostQuery = { status: 'active' };
    if (category) lostQuery.category = category;
    const lostItems = await LostItem.find(lostQuery)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const matches = [];

    // For each lost item, find nearby found items with same category using $near
    for (const lostItem of lostItems) {
      const foundQuery = {
        status: 'active',
        category: lostItem.category,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: lostItem.location.coordinates
            },
            $maxDistance: maxDist * 1000 // Convert km to meters
          }
        }
      };

      const nearbyFound = await FoundItem.find(foundQuery)
        .populate("user", "name email")
        .limit(10); // Limit per lost item to prevent explosion

      for (const foundItem of nearbyFound) {
        // Skip if both items are from the same user
        if (lostItem.user._id.toString() === foundItem.user._id.toString()) continue;

        const matchResult = calculateMatchScore(lostItem, foundItem);

        if (matchResult.score >= minMatchScore) {
          matches.push({
            lostItem,
            foundItem,
            ...matchResult
          });
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Paginate
    const total = matches.length;
    const paginatedMatches = matches.slice(skip, skip + parseInt(limit));

    res.json({
      matches: paginatedMatches,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("GET matches error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= GET MY MATCHES (current user's items) =================
router.get("/my", protect, async (req, res) => {
  try {
    const { maxDistance, minScore } = req.query;
    const maxDist = parseFloat(maxDistance) || 50;
    const minMatchScore = parseInt(minScore) || 0;
    const userId = req.user._id;

    // Get user's lost items
    const myLostItems = await LostItem.find({ user: userId, status: 'active' })
      .populate("user", "name email");

    // Get user's found items
    const myFoundItems = await FoundItem.find({ user: userId, status: 'active' })
      .populate("user", "name email");

    const matches = [];

    // Match user's lost items with all found items
    for (const lostItem of myLostItems) {
      const nearbyFound = await FoundItem.find({
        status: 'active',
        category: lostItem.category,
        user: { $ne: userId },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: lostItem.location.coordinates
            },
            $maxDistance: maxDist * 1000
          }
        }
      }).populate("user", "name email").limit(10);

      for (const foundItem of nearbyFound) {
        const matchResult = calculateMatchScore(lostItem, foundItem);
        if (matchResult.score >= minMatchScore) {
          matches.push({ lostItem, foundItem, ...matchResult });
        }
      }
    }

    // Match user's found items with all lost items
    for (const foundItem of myFoundItems) {
      const nearbyLost = await LostItem.find({
        status: 'active',
        category: foundItem.category,
        user: { $ne: userId },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: foundItem.location.coordinates
            },
            $maxDistance: maxDist * 1000
          }
        }
      }).populate("user", "name email").limit(10);

      for (const lostItem of nearbyLost) {
        // Avoid duplicates
        const exists = matches.find(
          m => m.lostItem._id.toString() === lostItem._id.toString() &&
               m.foundItem._id.toString() === foundItem._id.toString()
        );
        if (!exists) {
          const matchResult = calculateMatchScore(lostItem, foundItem);
          if (matchResult.score >= minMatchScore) {
            matches.push({ lostItem, foundItem, ...matchResult });
          }
        }
      }
    }

    matches.sort((a, b) => b.score - a.score);
    res.json({ matches, total: matches.length });
  } catch (error) {
    console.error("GET my matches error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= CLAIM ITEM =================
router.post("/claim", protect, async (req, res) => {
  try {
    const { lostItemId, foundItemId } = req.body;
    const userId = req.user._id;

    if (!lostItemId || !foundItemId) {
      return res.status(400).json({ message: "Both lostItemId and foundItemId are required" });
    }

    const lostItem = await LostItem.findById(lostItemId).populate("user", "name email");
    const foundItem = await FoundItem.findById(foundItemId).populate("user", "name email");

    if (!lostItem || !foundItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // User must own one of the items
    const ownsLost = lostItem.user._id.toString() === userId.toString();
    const ownsFound = foundItem.user._id.toString() === userId.toString();

    if (!ownsLost && !ownsFound) {
      return res.status(403).json({ message: "You must own one of the matched items" });
    }

    // Mark both as claimed
    lostItem.status = 'claimed';
    lostItem.claimedBy = ownsLost ? foundItem.user._id : userId;
    await lostItem.save();

    foundItem.status = 'claimed';
    foundItem.claimedBy = ownsFound ? lostItem.user._id : userId;
    await foundItem.save();

    // Create notification for the other user
    const Notification = require("../models/Notification");
    const otherUserId = ownsLost ? foundItem.user._id : lostItem.user._id;

    await Notification.create({
      user: otherUserId,
      type: 'claim',
      title: '🎉 Item Claimed!',
      message: `Someone claimed a match for "${ownsLost ? lostItem.title : foundItem.title}". Please verify and confirm.`,
      data: { lostItemId, foundItemId }
    });

    res.json({ message: "Items claimed successfully", lostItem, foundItem });
  } catch (error) {
    console.error("CLAIM error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= RESOLVE ITEM (confirm claim) =================
router.post("/resolve", protect, async (req, res) => {
  try {
    const { lostItemId, foundItemId } = req.body;
    const userId = req.user._id;

    const lostItem = await LostItem.findById(lostItemId);
    const foundItem = await FoundItem.findById(foundItemId);

    if (!lostItem || !foundItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Only involved users can resolve
    const isInvolved =
      lostItem.user.toString() === userId.toString() ||
      foundItem.user.toString() === userId.toString();

    if (!isInvolved) {
      return res.status(403).json({ message: "Not authorized" });
    }

    lostItem.status = 'resolved';
    await lostItem.save();

    foundItem.status = 'resolved';
    await foundItem.save();

    res.json({ message: "Items resolved successfully!" });
  } catch (error) {
    console.error("RESOLVE error:", error);
    res.status(500).json({ message: error.message });
  }
});
// ================= CHECK IF CHAT IS ALLOWED (match-based) =================
router.get("/check-chat/:otherUserId", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.otherUserId;

    // Check if there's a valid match between these two users
    // User A has a lost item and User B has a matching found item, or vice versa
    const myLostItems = await LostItem.find({ user: userId, status: { $in: ['active', 'claimed'] } });
    const myFoundItems = await FoundItem.find({ user: userId, status: { $in: ['active', 'claimed'] } });
    const otherLostItems = await LostItem.find({ user: otherUserId, status: { $in: ['active', 'claimed'] } });
    const otherFoundItems = await FoundItem.find({ user: otherUserId, status: { $in: ['active', 'claimed'] } });

    let hasMatch = false;
    let matchInfo = null;

    // My lost items vs their found items
    for (const lost of myLostItems) {
      for (const found of otherFoundItems) {
        if (lost.category === found.category) {
          const result = calculateMatchScore(lost, found);
          if (result.score >= 50) {
            hasMatch = true;
            matchInfo = { lostItemId: lost._id, foundItemId: found._id, score: result.score };
            break;
          }
        }
      }
      if (hasMatch) break;
    }

    // My found items vs their lost items
    if (!hasMatch) {
      for (const found of myFoundItems) {
        for (const lost of otherLostItems) {
          if (lost.category === found.category) {
            const result = calculateMatchScore(lost, found);
            if (result.score >= 50) {
              hasMatch = true;
              matchInfo = { lostItemId: lost._id, foundItemId: found._id, score: result.score };
              break;
            }
          }
        }
        if (hasMatch) break;
      }
    }

    res.json({ allowed: hasMatch, matchInfo });
  } catch (error) {
    console.error("CHECK-CHAT error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
