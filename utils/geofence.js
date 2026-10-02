/**
 * GPS Geofencing Utility for Employee Attendance
 * Office: Solaris Business Hub, 913, 9th Floor
 * Coordinates: 23.057808, 72.538926
 * Radius: 70 meters
 */

const OFFICE_LOCATION = {
  name: "Solaris Business Hub, 913, 9th Floor",
  latitude: parseFloat(process.env.OFFICE_LATITUDE) || 23.057808,
  longitude: parseFloat(process.env.OFFICE_LONGITUDE) || 72.538926,
  radiusMeters: parseFloat(process.env.OFFICE_RADIUS_METERS) || 70,
};

const GEOFENCE_AUTO_CHECKOUT_DELAY_SECONDS =
  parseInt(process.env.GEOFENCE_AUTO_CHECKOUT_DELAY_SECONDS, 10) || 10;

const LOCATION_FETCH_INTERVAL_SECONDS = 20; // Automatically fetch GPS location every 20 seconds

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
 * Validates whether the given request body contains valid GPS coordinates within the geofence.
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

  // Support explicit exit / out-of-radius flags sent directly by background listeners
  if (body.isOutside === true || body.geofenceExit === true || body.event === "exit" || body.outOfRadius === true) {
    return {
      isInside: false,
      distance: body.distance ? Math.round(Number(body.distance)) : 100,
      latitude: body.latitude || body.lat || null,
      longitude: body.longitude || body.lng || null,
      error: "Device reported out-of-radius geofence exit.",
    };
  }

  const rawLat =
    body.latitude !== undefined
      ? body.latitude
      : body.lat !== undefined
      ? body.lat
      : body.location?.latitude !== undefined
      ? body.location.latitude
      : body.location?.lat !== undefined
      ? body.location.lat
      : body.coords?.latitude !== undefined
      ? body.coords.latitude
      : body.position?.coords?.latitude !== undefined
      ? body.position.coords.latitude
      : body.currentLocation?.latitude !== undefined
      ? body.currentLocation.latitude
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
      : body.location?.lng !== undefined
      ? body.location.lng
      : body.coords?.longitude !== undefined
      ? body.coords.longitude
      : body.position?.coords?.longitude !== undefined
      ? body.position.coords.longitude
      : body.currentLocation?.longitude !== undefined
      ? body.currentLocation.longitude
      : null;

  const directDistance =
    body.distance !== undefined
      ? parseFloat(body.distance)
      : body.distanceFromOffice !== undefined
      ? parseFloat(body.distanceFromOffice)
      : null;

  if (
    (rawLat === null || rawLat === undefined || rawLon === null || rawLon === undefined) &&
    directDistance !== null &&
    !Number.isNaN(directDistance)
  ) {
    const roundedDist = Math.round(directDistance);
    const isInside = roundedDist <= OFFICE_LOCATION.radiusMeters;
    return {
      isInside,
      distance: roundedDist,
      latitude: null,
      longitude: null,
      error: isInside
        ? null
        : `You are outside the office location (${roundedDist}m away). Attendance can only be marked within ${OFFICE_LOCATION.radiusMeters} meters of the office.`,
    };
  }

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
      error: `You are outside the office location (${roundedDistance}m away). Attendance can only be marked within ${OFFICE_LOCATION.radiusMeters} meters of the office.`,
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

/**
 * Determines whether the user/attendance is currently on break ("break-start").
 * Rules:
 * - If request body indicates status is break-start / on break
 * - If Attendance document has an active break (breaks array item without endTime)
 * - If Session has status 'break' or 'break-start'
 * - If Attendance status is break-start
 * 
 * @param {object} attendance 
 * @param {object} session 
 * @param {object} body 
 * @returns {boolean}
 */
function isBreakStartActive(attendance, session = null, body = {}) {
  // 1. Check body payload flags or statuses
  const rawStatus = (
    body.status ||
    body.attendanceStatus ||
    body.currentStatus ||
    body.breakStatus ||
    body.action ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (
    rawStatus === "breakstart" ||
    rawStatus === "break" ||
    rawStatus === "onbreak" ||
    rawStatus === "breakstarted" ||
    body.isBreak === true ||
    body.onBreak === true ||
    body.isOnBreak === true
  ) {
    return true;
  }

  // 2. Check if attendance document has an active running break (break started, no end time)
  if (attendance && Array.isArray(attendance.breaks)) {
    const hasActiveBreak = attendance.breaks.some((b) => !b.endTime);
    if (hasActiveBreak) {
      return true;
    }
  }

  // 3. Check attendance status field if present
  if (attendance && typeof attendance.status === "string") {
    const attStatus = attendance.status.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (attStatus === "breakstart" || attStatus === "break" || attStatus === "onbreak") {
      return true;
    }
  }

  // 4. Check active session status
  if (session && typeof session.status === "string") {
    const sessStatus = session.status.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (sessStatus === "break" || sessStatus === "breakstart" || sessStatus === "onbreak") {
      return true;
    }
  }

  return false;
}

module.exports = {
  OFFICE_LOCATION,
  GEOFENCE_AUTO_CHECKOUT_DELAY_SECONDS,
  LOCATION_FETCH_INTERVAL_SECONDS,
  calculateDistanceMeters,
  validateAttendanceGeofence,
  isBreakStartActive,
};
