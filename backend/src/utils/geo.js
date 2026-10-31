/**
 * Geospatial and Distance Calculation Utilities
 * Implements Earth WGS-84 Haversine distance and GPS filtering algorithms
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Calculates Great-Circle distance between two coordinates in Kilometers
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Evaluates whether a GPS point is valid or should be filtered as noise/jitter
 * @param {Object} current Current GPS point { latitude, longitude, accuracy, speed, timestamp }
 * @param {Object|null} previous Previous valid GPS point { latitude, longitude, timestamp }
 * @param {Object} options Configuration thresholds
 * @returns {Object} { isValid: boolean, filterReason: string|null, distanceKm: number, speedKmh: number }
 */
function filterGpsPoint(current, previous, options = {}) {
  const maxAccuracy = options.maxAccuracyMeters || 40;
  const maxSpeedKmh = options.maxTravelSpeedKmh || 130;
  const minDisplacement = options.minDisplacementMeters || 10;

  // Rule 1: Accuracy Gate
  if (current.accuracy > maxAccuracy) {
    return {
      isValid: false,
      filterReason: 'ACCURACY_EXCEEDED',
      distanceKm: 0,
      speedKmh: 0,
    };
  }

  // Rule 2: Reported speed check (if available in m/s)
  const reportedSpeedKmh = (current.speed || 0) * 3.6;
  if (reportedSpeedKmh > maxSpeedKmh) {
    return {
      isValid: false,
      filterReason: 'EXCESSIVE_SPEED',
      distanceKm: 0,
      speedKmh: reportedSpeedKmh,
    };
  }

  // Initial fix in session
  if (!previous) {
    return {
      isValid: true,
      filterReason: null,
      distanceKm: 0,
      speedKmh: reportedSpeedKmh,
    };
  }

  const timeDeltaSeconds =
    (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;

  if (timeDeltaSeconds <= 0) {
    return {
      isValid: false,
      filterReason: 'STATIONARY_JITTER',
      distanceKm: 0,
      speedKmh: 0,
    };
  }

  const distanceKm = calculateHaversineDistanceKm(
    previous.latitude,
    previous.longitude,
    current.latitude,
    current.longitude
  );
  const distanceMeters = distanceKm * 1000;

  // Rule 3: Stationary Jitter Suppression (< 10m drift while still)
  if (distanceMeters < minDisplacement) {
    return {
      isValid: false,
      filterReason: 'STATIONARY_JITTER',
      distanceKm: 0,
      speedKmh: 0,
    };
  }

  // Rule 4: Teleport / Implausible Jump check
  const calculatedSpeedKmh = (distanceMeters / timeDeltaSeconds) * 3.6;
  if (calculatedSpeedKmh > maxSpeedKmh) {
    return {
      isValid: false,
      filterReason: 'IMPLAUSIBLE_JUMP',
      distanceKm: 0,
      speedKmh: calculatedSpeedKmh,
    };
  }

  return {
    isValid: true,
    filterReason: null,
    distanceKm,
    speedKmh: reportedSpeedKmh > 0 ? reportedSpeedKmh : calculatedSpeedKmh,
  };
}

module.exports = {
  EARTH_RADIUS_KM,
  calculateHaversineDistanceKm,
  filterGpsPoint,
};
