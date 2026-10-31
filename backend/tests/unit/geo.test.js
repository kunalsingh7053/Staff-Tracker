const { calculateHaversineDistanceKm, filterGpsPoint } = require('../../src/utils/geo');

describe('GPS Distance Calculation & Noise Filtering Engine', () => {

  describe('Haversine Formula Verification', () => {
    it('should calculate accurate distance between known Delhi landmarks', () => {
      // Point A: India Gate (28.6129° N, 77.2295° E)
      // Point B: Qutub Minar (28.5244° N, 77.1855° E)
      // Benchmark geodesic distance is ~10.66 km (10.6 - 10.7 km)
      const distance = calculateHaversineDistanceKm(28.6129, 77.2295, 28.5244, 77.1855);
      expect(distance).toBeGreaterThan(10.60);
      expect(distance).toBeLessThan(10.75);
    });

    it('should return 0 when calculating distance between identical points', () => {
      const distance = calculateHaversineDistanceKm(28.6129, 77.2295, 28.6129, 77.2295);
      expect(distance).toBe(0);
    });

    it('should calculate short walking distance with sub-meter precision', () => {
      // ~111 meters North (approx 0.001 deg lat)
      const distance = calculateHaversineDistanceKm(28.6000, 77.2000, 28.6010, 77.2000);
      const meters = distance * 1000;
      expect(meters).toBeGreaterThan(110);
      expect(meters).toBeLessThan(112);
    });
  });

  describe('Noise, Jitter, and Teleport Filtering', () => {
    const baseTimestamp = new Date('2026-10-30T10:00:00.000Z').getTime();

    it('should filter points with accuracy worse than threshold (> 40m)', () => {
      const point = {
        latitude: 28.6129,
        longitude: 77.2295,
        accuracy: 55, // Inaccurate GPS
        speed: 5,
        timestamp: new Date(baseTimestamp),
      };

      const result = filterGpsPoint(point, null, { maxAccuracyMeters: 40 });
      expect(result.isValid).toBe(false);
      expect(result.filterReason).toBe('ACCURACY_EXCEEDED');
      expect(result.distanceKm).toBe(0);
    });

    it('should filter points exceeding max realistic speed (> 130 km/h)', () => {
      const point = {
        latitude: 28.6129,
        longitude: 77.2295,
        accuracy: 10,
        speed: 45, // 45 m/s = 162 km/h
        timestamp: new Date(baseTimestamp),
      };

      const result = filterGpsPoint(point, null, { maxTravelSpeedKmh: 130 });
      expect(result.isValid).toBe(false);
      expect(result.filterReason).toBe('EXCESSIVE_SPEED');
    });

    it('should accept the first valid location fix in a session', () => {
      const firstPoint = {
        latitude: 28.6129,
        longitude: 77.2295,
        accuracy: 12,
        speed: 0,
        timestamp: new Date(baseTimestamp),
      };

      const result = filterGpsPoint(firstPoint, null);
      expect(result.isValid).toBe(true);
      expect(result.distanceKm).toBe(0);
    });

    it('should suppress stationary jitter when displacement is under 10 meters', () => {
      const prev = {
        latitude: 28.612900,
        longitude: 77.229500,
        accuracy: 8,
        timestamp: new Date(baseTimestamp),
      };

      // Slight GPS wobble of ~3 meters
      const wobble = {
        latitude: 28.612925,
        longitude: 77.229515,
        accuracy: 8,
        speed: 0.2,
        timestamp: new Date(baseTimestamp + 5000), // 5s later
      };

      const result = filterGpsPoint(wobble, prev, { minDisplacementMeters: 10 });
      expect(result.isValid).toBe(false);
      expect(result.filterReason).toBe('STATIONARY_JITTER');
    });

    it('should filter impossible teleport jumps (e.g., 5 km in 5 seconds)', () => {
      const prev = {
        latitude: 28.6129,
        longitude: 77.2295,
        timestamp: new Date(baseTimestamp),
      };

      // Leaps 5 km away in 5 seconds -> speed = 3600 km/h
      const teleport = {
        latitude: 28.6500,
        longitude: 77.2500,
        accuracy: 15,
        speed: 0,
        timestamp: new Date(baseTimestamp + 5000),
      };

      const result = filterGpsPoint(teleport, prev, { maxTravelSpeedKmh: 130 });
      expect(result.isValid).toBe(false);
      expect(result.filterReason).toBe('IMPLAUSIBLE_JUMP');
    });

    it('should accept genuine realistic vehicle travel and calculate distance', () => {
      const prev = {
        latitude: 28.6129,
        longitude: 77.2295,
        timestamp: new Date(baseTimestamp),
      };

      // Moved ~250m down the road over 30 seconds (~30 km/h)
      const validMove = {
        latitude: 28.6150,
        longitude: 77.2305,
        accuracy: 10,
        speed: 8.3, // ~30 km/h
        timestamp: new Date(baseTimestamp + 30000),
      };

      const result = filterGpsPoint(validMove, prev);
      expect(result.isValid).toBe(true);
      expect(result.filterReason).toBeNull();
      expect(result.distanceKm).toBeGreaterThan(0.2);
      expect(result.distanceKm).toBeLessThan(0.3);
      expect(result.speedKmh).toBeGreaterThan(20);
    });
  });
});
