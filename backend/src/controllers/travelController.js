const { TravelSession, LocationPoint, Attendance, Employee, CompanySettings } = require('../models');
const { TRAVEL_SESSION_STATUS, ROLES } = require('../constants');
const { filterGpsPoint } = require('../utils/geo');
const { hasClusterAccess } = require('../middleware/rbac');

exports.startTravel = async (req, res, next) => {
  try {
    const { latitude, longitude, purpose = 'Field Duty' } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Starting latitude and longitude are required.',
      });
    }

    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    // Must have checked in today
    const dateStr = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ employeeId: employee.employeeId, date: dateStr });
    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'You must check in first before starting field travel.',
      });
    }

    // Check if a session is already active
    const active = await TravelSession.findOne({
      employeeId: employee.employeeId,
      sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
    });
    if (active) {
      return res.status(400).json({
        success: false,
        message: 'A travel session is already active.',
        data: active,
      });
    }

    const session = new TravelSession({
      attendanceId: attendance._id,
      employeeId: employee.employeeId,
      clusterId: employee.clusterId || null,
      startTime: new Date(),
      startLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      purpose: purpose.trim(),
      sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
    });

    await session.save();

    // Create the first LocationPoint fix
    await LocationPoint.create({
      sessionId: session._id,
      employeeId: employee.employeeId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      accuracy: 10,
      timestamp: new Date(),
      isFiltered: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Field travel session started.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

exports.recordLocationBatch = async (req, res, next) => {
  try {
    const { sessionId, points } = req.body;

    if (!sessionId || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and a non-empty points array are required.',
      });
    }

    const session = await TravelSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Travel session not found.' });
    }

    if (session.sessionStatus !== TRAVEL_SESSION_STATUS.IN_PROGRESS) {
      return res.status(400).json({
        success: false,
        message: `Cannot add points to session in status: ${session.sessionStatus}`,
      });
    }

    // Load company GPS settings
    let settings = await CompanySettings.findOne();
    if (!settings) settings = new CompanySettings();

    const options = {
      maxAccuracyMeters: settings.gpsAccuracyThresholdMeters,
      maxTravelSpeedKmh: settings.maxTravelSpeedKmh,
      minDisplacementMeters: 10,
    };

    // Find the last valid point in this session
    let lastPoint = await LocationPoint.findOne({
      sessionId: session._id,
      isFiltered: false,
    }).sort({ timestamp: -1 });

    let distanceAddedKm = 0;
    let validCount = 0;
    const documentsToInsert = [];

    for (const raw of points) {
      const prevFormat = lastPoint
        ? {
            latitude: lastPoint.location.coordinates[1],
            longitude: lastPoint.location.coordinates[0],
            timestamp: lastPoint.timestamp,
          }
        : null;

      const evalResult = filterGpsPoint(raw, prevFormat, options);

      const doc = {
        sessionId: session._id,
        employeeId: session.employeeId,
        location: {
          type: 'Point',
          coordinates: [raw.longitude, raw.latitude],
        },
        altitude: raw.altitude || 0,
        accuracy: raw.accuracy || 10,
        speed: raw.speed || 0,
        bearing: raw.bearing || 0,
        timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
        isFiltered: !evalResult.isValid,
        filterReason: evalResult.filterReason,
        batteryLevel: raw.batteryLevel || null,
        isCharging: !!raw.isCharging,
      };

      documentsToInsert.push(doc);

      if (evalResult.isValid) {
        distanceAddedKm += evalResult.distanceKm;
        validCount++;
        lastPoint = doc;
      }
    }

    if (documentsToInsert.length > 0) {
      await LocationPoint.insertMany(documentsToInsert);
    }

    session.totalDistanceKm = Math.round((session.totalDistanceKm + distanceAddedKm) * 1000) / 1000;
    session.totalPointsCount += validCount;
    await session.save();

    return res.status(200).json({
      success: true,
      message: `${validCount} valid points accumulated. Added ${distanceAddedKm.toFixed(3)} km.`,
      data: {
        sessionId: session._id,
        totalDistanceKm: session.totalDistanceKm,
        totalPointsCount: session.totalPointsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.stopTravel = async (req, res, next) => {
  try {
    const { sessionId, latitude, longitude } = req.body;

    const session = await TravelSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Travel session not found.' });
    }

    const endTime = new Date();
    const durationMinutes = Math.max(0, Math.floor((endTime - new Date(session.startTime)) / 60000));

    session.sessionStatus = TRAVEL_SESSION_STATUS.COMPLETED;
    session.endTime = endTime;
    session.totalDurationMinutes = durationMinutes;

    if (latitude !== undefined && longitude !== undefined) {
      session.endLocation = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Field travel session completed successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

exports.getActiveSession = async (req, res, next) => {
  try {
    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const session = await TravelSession.findOne({
      employeeId: employee.employeeId,
      sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
    });

    return res.status(200).json({
      success: true,
      data: session || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.getLiveFleet = async (req, res, next) => {
  try {
    const { clusterId } = req.query;
    let employeeFilter = { accountStatus: 'ACTIVE' };

    // 3-Level Scope Enforcement:
    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) {
        employeeFilter.clusterId = clusterId;
      }
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowedClusters = req.user.assignedClusterIds || [];
      if (allowedClusters.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You cannot view live fleet for this cluster.',
          });
        }
        employeeFilter.clusterId = clusterId;
      } else {
        employeeFilter.clusterId = { $in: allowedClusters };
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const employees = await Employee.find(employeeFilter)
      .populate('clusterId', 'name code')
      .lean();

    const empIds = employees.map((e) => e.employeeId);

    // Find active travel sessions
    const activeSessions = await TravelSession.find({
      employeeId: { $in: empIds },
      sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
    }).lean();

    const sessionIds = activeSessions.map((s) => s._id);

    // Get the most recent location point for each active session
    const latestPoints = await LocationPoint.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$sessionId',
          latitude: { $first: { $arrayElemAt: ['$location.coordinates', 1] } },
          longitude: { $first: { $arrayElemAt: ['$location.coordinates', 0] } },
          accuracy: { $first: '$accuracy' },
          speed: { $first: '$speed' },
          batteryLevel: { $first: '$batteryLevel' },
          timestamp: { $first: '$timestamp' },
        },
      },
    ]);

    const pointMap = {};
    latestPoints.forEach((p) => {
      pointMap[p._id.toString()] = p;
    });

    const sessionMap = {};
    activeSessions.forEach((s) => {
      sessionMap[s.employeeId] = {
        ...s,
        currentLocation: pointMap[s._id.toString()] || null,
      };
    });

    const fleet = employees.map((emp) => ({
      ...emp,
      isTravelling: !!sessionMap[emp.employeeId],
      activeTravelSession: sessionMap[emp.employeeId] || null,
    }));

    return res.status(200).json({
      success: true,
      totalFieldStaff: employees.length,
      activeTravellingCount: activeSessions.length,
      data: fleet,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await TravelSession.findById(id).populate('clusterId', 'name code').lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Role security
    if (req.user.role === ROLES.STAFF && session.employeeId !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot view another employee’s travel route.' });
    }

    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!session.clusterId || !hasClusterAccess(req.user, session.clusterId._id)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Session belongs to another cluster.' });
      }
    }

    // Fetch valid GPS breadcrumbs for route map polyline
    const points = await LocationPoint.find({ sessionId: session._id, isFiltered: false })
      .sort({ timestamp: 1 })
      .select('location accuracy speed timestamp batteryLevel')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...session,
        points: points.map((p) => ({
          latitude: p.location.coordinates[1],
          longitude: p.location.coordinates[0],
          accuracy: p.accuracy,
          speed: p.speed,
          timestamp: p.timestamp,
          batteryLevel: p.batteryLevel,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
