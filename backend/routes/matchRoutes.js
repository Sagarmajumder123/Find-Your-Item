const express = require("express");
const router = express.Router();
const LostItem = require("../models/LostItem");
const FoundItem = require("../models/FoundItem");
const Claim = require("../models/Claim");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { calculateMatchScore } = require("../utils/haversine");

// ================= GET MATCHES (Restricted to current user's items) =================
router.get("/", protect, async (req, res) => {
  try {
    const { category, maxDistance, minScore, page = 1, limit = 20 } = req.query;
    const maxDist = parseFloat(maxDistance) || 50; 
    const minMatchScore = parseInt(minScore) || 50; 
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user._id;

    // We only find matches where the current user is either the LOST owner OR the FOUND owner
    let userLostQuery = { user: userId, status: 'active' };
    if (category) userLostQuery.category = category;
    const myLostItems = await LostItem.find(userLostQuery).populate("user", "name email");

    const matches = [];

    for (const lostItem of myLostItems) {
      const foundQuery = {
        status: 'active',
        category: lostItem.category,
        user: { $ne: userId },
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: lostItem.location.coordinates },
            $maxDistance: maxDist * 1000
          }
        }
      };

      const nearbyFound = await FoundItem.find(foundQuery).populate("user", "name email").limit(10);

      for (const foundItem of nearbyFound) {
        const matchResult = calculateMatchScore(lostItem, foundItem);
        if (matchResult.score >= minMatchScore) {
          matches.push({ lostItem, foundItem, ...matchResult });
        }
      }
    }

    let userFoundQuery = { user: userId, status: 'active' };
    if (category) userFoundQuery.category = category;
    const myFoundItems = await FoundItem.find(userFoundQuery).populate("user", "name email");

    for (const foundItem of myFoundItems) {
      const lostQuery = {
        status: 'active',
        category: foundItem.category,
        user: { $ne: userId },
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: foundItem.location.coordinates },
            $maxDistance: maxDist * 1000
          }
        }
      };

      const nearbyLost = await LostItem.find(lostQuery).populate("user", "name email").limit(10);

      for (const lostItem of nearbyLost) {
        const exists = matches.find(m => 
          m.lostItem._id.toString() === lostItem._id.toString() && 
          m.foundItem._id.toString() === foundItem._id.toString()
        );
        if (exists) continue;

        const matchResult = calculateMatchScore(lostItem, foundItem);
        if (matchResult.score >= minMatchScore) {
          matches.push({ lostItem, foundItem, ...matchResult });
        }
      }
    }

    matches.sort((a, b) => b.score - a.score);
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

// ================= SUBMIT CLAIM REQUEST (With Security Answer) =================
router.post("/claim", protect, async (req, res) => {
  try {
    const { lostItemId, foundItemId, answer } = req.body;
    const userId = req.user._id;

    if (!lostItemId || !foundItemId || !answer) {
      return res.status(400).json({ message: "LostItem, FoundItem, and Answer are required" });
    }

    const lostItem = await LostItem.findById(lostItemId);
    const foundItem = await FoundItem.findById(foundItemId);

    if (!lostItem || !foundItem) return res.status(404).json({ message: "Item not found" });

    // Ensure the current user owns the lost item (they are the claimer)
    if (lostItem.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only claim items matching your own report" });
    }

    // Check if a pending claim already exists
    const existing = await Claim.findOne({ claimer: userId, foundItem: foundItemId, status: 'pending' });
    if (existing) return res.status(400).json({ message: "You already have a pending claim for this item" });

    // Create the claim request
    const claim = await Claim.create({
      lostItem: lostItemId,
      foundItem: foundItemId,
      claimer: userId,
      finder: foundItem.user,
      answer: answer
    });

    // Notify the finder
    await Notification.create({
      user: foundItem.user,
      type: 'claim',
      title: '📩 New Claim Request',
      message: `Someone provided an answer for your found "${foundItem.title}". Review it now!`,
      data: { claimId: claim._id, foundItemId }
    });

    res.status(201).json({ message: "Claim request submitted successfully", claim });
  } catch (error) {
    console.error("CLAIM request error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================= VERIFY CLAIM (Finder Approves/Rejects) =================
router.post("/verify-claim", protect, async (req, res) => {
  try {
    const { claimId, action, rejectionReason } = req.body;
    const userId = req.user._id;

    const claim = await Claim.findById(claimId).populate("lostItem foundItem");
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    // Only the finder can verify
    if (claim.finder.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to verify this claim" });
    }

    if (action === 'approved') {
      claim.status = 'approved';
      
      // Update item statuses to 'resolved'
      await LostItem.findByIdAndUpdate(claim.lostItem._id, { status: 'resolved' });
      await FoundItem.findByIdAndUpdate(claim.foundItem._id, { status: 'resolved' });

      // Notify the owner
      await Notification.create({
        user: claim.claimer,
        type: 'match',
        title: '✅ Claim Approved!',
        message: `Your claim for "${claim.foundItem.title}" was approved by the finder! You can now chat to arrange handover.`,
        data: { foundItemId: claim.foundItem._id, status: 'approved' }
      });
    } else {
      claim.status = 'rejected';
      claim.rejectionReason = rejectionReason || '';
      
      // Notify the owner
      await Notification.create({
        user: claim.claimer,
        type: 'system',
        title: '❌ Claim Rejected',
        message: `Your answer for "${claim.foundItem.title}" was rejected. Feel free to try again with more details.`,
        data: { foundItemId: claim.foundItem._id, status: 'rejected' }
      });
    }

    await claim.save();
    res.json({ message: `Claim ${action} successfully`, claim });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET PENDING CLAIMS (For Finder) =================
router.get("/claims/received", protect, async (req, res) => {
  try {
    const claims = await Claim.find({ finder: req.user._id, status: 'pending' })
      .populate("claimer", "name email")
      .populate("lostItem")
      .populate("foundItem");
    res.json(claims);
  } catch (error) {
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
