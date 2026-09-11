/**
 * GPS Geofencing Utility for Employee Attendance
 * Office: Solaris Business Hub, 913, 9th Floor
 * Coordinates: 23.0577915, 72.538287
 * Radius: 100 meters
 */

const OFFICE_LOCATION = {
  name: "Solaris Business Hub, 913, 9th Floor",
  latitude: 23.0577915,
  longitude: 72.538287,
  radiusMeters: 100,
};

/**
 * Calculates real-world distance in meters between two points using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's mean radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validates whether the given request body contains valid GPS coordinates within the 100m geofence.
 * @param {object} body - Request payload containing latitude/longitude
 * @returns {{ isInside: boolean, distance: number|null, latitude: number|null, longitude: number|null, error: string|null }}
 */
function validateAttendanceGeofence(body) {
  if (!body) {
    return {
      isInside: false,
      distance: null,
      latitude: null,
      longitude: null,
      error: "Location coordinates are required. Please ensure location permission and GPS are enabled.",
    };
  }

  const rawLat =
    body.latitude !== undefined
      ? body.latitude
      : body.lat !== undefined
      ? body.lat
      : body.location?.latitude !== undefined
      ? body.location.latitude
      : null;

  const rawLon =
    body.longitude !== undefined
      ? body.longitude
      : body.lng !== undefined
      ? body.lng
      : body.long !== undefined
      ? body.long
      : body.location?.longitude !== undefined
      ? body.location.longitude
      : null;

  if (rawLat === null || rawLat === undefined || rawLon === null || rawLon === undefined) {
    return {
      isInside: false,
      distance: null,
      latitude: null,
      longitude: null,
      error: "Location permission and GPS coordinates are required to mark attendance.",
    };
  }

  const lat = parseFloat(rawLat);
  const lon = parseFloat(rawLon);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return {
      isInside: false,
      distance: null,
      latitude: null,
      longitude: null,
      error: "Invalid GPS coordinates provided.",
    };
  }

  // Check GPS accuracy if provided
  const rawAccuracy = body.accuracy || body.location?.accuracy;
  if (rawAccuracy !== undefined && rawAccuracy !== null) {
    const accuracy = parseFloat(rawAccuracy);
    if (!Number.isNaN(accuracy) && accuracy > 200) {
      return {
        isInside: false,
        distance: null,
        latitude: lat,
        longitude: lon,
        error: "GPS accuracy is too low to verify your location reliably. Please wait for better signal.",
      };
    }
  }

  const distance = calculateDistanceMeters(
    lat,
    lon,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude
  );

  const roundedDistance = Math.round(distance);

  if (distance > OFFICE_LOCATION.radiusMeters) {
    return {
      isInside: false,
      distance: roundedDistance,
      latitude: lat,
      longitude: lon,
      error: `You are outside the office location (${roundedDistance}m away). Attendance can only be marked within 100 meters of the office.`,
    };
  }

  return {
    isInside: true,
    distance: roundedDistance,
    latitude: lat,
    longitude: lon,
    error: null,
  };
}

module.exports = {
  OFFICE_LOCATION,
  calculateDistanceMeters,
  validateAttendanceGeofence,
};
