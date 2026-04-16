/**
 * Haversine formula — distance between two GPS coordinates
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate match score between a lost and found item
 * SCORING:
 *   Category match = 50 pts (mandatory — skip if no match)
 *   Distance       = 0-30 pts (closer = higher)
 *   Color match    = 0-10 pts
 *   Brand match    = 0-10 pts
 *   Total          = 0-100
 */
function calculateMatchScore(lostItem, foundItem) {
  let score = 0;
  const breakdown = {};

  // 1. Category match (50 points — MANDATORY)
  if (lostItem.category !== foundItem.category) {
    return { score: 0, distance: 999, daysDifference: 999, label: 'No Match', breakdown: { category: 0 } };
  }
  score += 50;
  breakdown.category = 50;

  // 2. Distance score (0-30 points)
  const [lostLng, lostLat] = lostItem.location.coordinates;
  const [foundLng, foundLat] = foundItem.location.coordinates;
  const distance = haversineDistance(lostLat, lostLng, foundLat, foundLng);

  let distanceScore = 0;
  if (distance <= 0.5) distanceScore = 30;
  else if (distance <= 1) distanceScore = 25;
  else if (distance <= 2) distanceScore = 22;
  else if (distance <= 5) distanceScore = 18;
  else if (distance <= 10) distanceScore = 14;
  else if (distance <= 20) distanceScore = 10;
  else if (distance <= 50) distanceScore = 5;
  else distanceScore = 0;

  score += distanceScore;
  breakdown.distance = distanceScore;

  // 3. Color match (0-10 points)
  let colorScore = 0;
  if (lostItem.color && foundItem.color) {
    if (lostItem.color === foundItem.color) {
      colorScore = 10;
    }
  }
  score += colorScore;
  breakdown.color = colorScore;

  // 4. Brand match (0-10 points)
  let brandScore = 0;
  if (lostItem.brand && foundItem.brand) {
    const lostBrand = lostItem.brand.toLowerCase().trim();
    const foundBrand = foundItem.brand.toLowerCase().trim();
    if (lostBrand && foundBrand) {
      if (lostBrand === foundBrand) {
        brandScore = 10;
      } else if (lostBrand.includes(foundBrand) || foundBrand.includes(lostBrand)) {
        brandScore = 5; // Partial brand match
      }
    }
  }
  score += brandScore;
  breakdown.brand = brandScore;

  // Time difference (info only, no score impact)
  const lostDate = new Date(lostItem.date);
  const foundDate = new Date(foundItem.date);
  const daysDiff = Math.abs((foundDate - lostDate) / (1000 * 60 * 60 * 24));

  // Determine match label
  let label = 'Weak';
  if (score >= 85) label = 'Exact Match';
  else if (score >= 70) label = 'Strong';
  else if (score >= 55) label = 'Medium';

  return {
    score,
    distance: Math.round(distance * 100) / 100,
    daysDifference: Math.round(daysDiff * 10) / 10,
    label,
    breakdown
  };
}

module.exports = { haversineDistance, calculateMatchScore };
