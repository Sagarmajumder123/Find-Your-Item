const Notification = require("../models/Notification");

/**
 * Access levels:
 * - 'owner': User owns the item
 * - 'match': User has a confirmed match notification with this item
 * - 'public': No special access (limited data only)
 */
const getItemAccessLevel = async (userId, item, modelName) => {
  if (!userId) return 'public';
  if (item.user.toString() === userId.toString()) return 'owner';

  // Check for a match notification linking this user and item
  // Notification.data contains { lostItemId, foundItemId }
  const matchCriteria = {
    user: userId,
    type: 'match'
  };

  if (modelName === 'LostItem') {
    matchCriteria['data.lostItemId'] = item._id.toString();
  } else {
    matchCriteria['data.foundItemId'] = item._id.toString();
  }

  const match = await Notification.findOne(matchCriteria);
  return match ? 'match' : 'public';
};

module.exports = { getItemAccessLevel };
