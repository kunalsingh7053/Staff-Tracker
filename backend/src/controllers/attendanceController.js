const { Attendance, Employee, CompanySettings, TravelSession, CorrectionRequest, AuditLog } = require('../models');
const { ATTENDANCE_STATUS, ROLES, CORRECTION_STATUS, TRAVEL_SESSION_STATUS } = require('../constants');
const { hasClusterAccess } = require('../middleware/rbac');

// Helper to format Date into YYYY-MM-DD
const formatDateStr = (date = new Date()) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

exports.checkIn = async (req, res, next) => {
  try {
    const { latitude, longitude, address, deviceId, notes, isOfflineSync, offlineRecordedAt } = req.body;

    if (latitude === undefined || longitude === undefined || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Latitude, longitude, and deviceId are required for check-in.',
      });
    }

    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found for this account.',
      });
    }

    const dateStr = formatDateStr();
    const existing = await Attendance.findOne({ employeeId: employee.employeeId, date: dateStr });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for today.',
        data: existing,
      });
    }

    // Load company settings to evaluate late arrival
    let settings = await CompanySettings.findOne();
    if (!settings) settings = new CompanySettings();

    const checkInTime = offlineRecordedAt ? new Date(offlineRecordedAt) : new Date();
    let status = ATTENDANCE_STATUS.PRESENT;
    let lateMinutes = 0;

    const [shiftHour, shiftMinute] = settings.workShiftStart.split(':').map(Number);
    const shiftStartTime = new Date(checkInTime);
    shiftStartTime.setHours(shiftHour, shiftMinute, 0, 0);

    const diffMs = checkInTime.getTime() - shiftStartTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes > settings.graceMinutes) {
      status = ATTENDANCE_STATUS.LATE;
      lateMinutes = diffMinutes;
    }

    const attendance = new Attendance({
      employeeId: employee.employeeId,
      userId: req.user._id,
      clusterId: employee.clusterId || null,
      date: dateStr,
      checkInTime,
      checkInLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      checkInAddress: address || null,
      checkInDeviceId: deviceId,
      status,
      lateMinutes,
      isOfflineSync: !!isOfflineSync,
      offlineRecordedAt: offlineRecordedAt ? new Date(offlineRecordedAt) : null,
      notes: notes || null,
    });

    await attendance.save();

    return res.status(201).json({
      success: true,
      message: 'Check-in recorded successfully.',
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const { latitude, longitude, address, deviceId } = req.body;

    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    const dateStr = formatDateStr();
    const attendance = await Attendance.findOne({ employeeId: employee.employeeId, date: dateStr });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No check-in found for today. You must check in first before checking out.',
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out for today.',
        data: attendance,
      });
    }

    const checkOutTime = new Date();
    const diffMs = checkOutTime.getTime() - new Date(attendance.checkInTime).getTime();
    const workingMinutes = Math.max(0, Math.floor(diffMs / 60000));

    // Determine half day vs full day
    let settings = await CompanySettings.findOne();
    if (!settings) settings = new CompanySettings();

    const workingHours = workingMinutes / 60;
    if (workingHours < settings.halfDayThresholdHours) {
      attendance.status = ATTENDANCE_STATUS.HALF_DAY;
    }

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = {
      type: 'Point',
      coordinates: [longitude || 0, latitude || 0],
    };
    attendance.checkOutAddress = address || null;
    attendance.checkOutDeviceId = deviceId || null;
    attendance.totalWorkingMinutes = workingMinutes;

    await attendance.save();

    // Auto-stop any active travel session for this attendance
    await TravelSession.updateMany(
      { attendanceId: attendance._id, sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS },
      { $set: { sessionStatus: TRAVEL_SESSION_STATUS.COMPLETED, endTime: checkOutTime } }
    );

    return res.status(200).json({
      success: true,
      message: 'Check-out recorded successfully.',
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayStatus = async (req, res, next) => {
  try {
    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    const dateStr = formatDateStr();
    const attendance = await Attendance.findOne({ employeeId: employee.employeeId, date: dateStr });
    const activeTravel = await TravelSession.findOne({
      employeeId: employee.employeeId,
      sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
    });

    return res.status(200).json({
      success: true,
      data: {
        date: dateStr,
        isCheckedIn: !!attendance,
        isCheckedOut: !!(attendance && attendance.checkOutTime),
        attendance: attendance || null,
        activeTravelSession: activeTravel || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyHistory = async (req, res, next) => {
  try {
    const { month } = req.query; // YYYY-MM
    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    let filter = { employeeId: employee.employeeId };
    if (month) {
      filter.date = { $regex: `^${month}` };
    }

    const records = await Attendance.find(filter).sort({ date: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAttendanceMonitor = async (req, res, next) => {
  try {
    const { date = formatDateStr(), clusterId } = req.query;
    let employeeFilter = { accountStatus: 'ACTIVE' };

    // 3-Level Scope Enforcement:
    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) {
        employeeFilter.clusterId = clusterId;
      }
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowedClusters = req.user.assignedClusterIds || [];
      if (allowedClusters.length === 0) {
        return res.status(200).json({ success: true, data: { present: [], absent: [], late: [] } });
      }

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You cannot monitor attendance for this cluster.',
          });
        }
        employeeFilter.clusterId = clusterId;
      } else {
        employeeFilter.clusterId = { $in: allowedClusters };
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const allEmployees = await Employee.find(employeeFilter)
      .populate('clusterId', 'name code')
      .lean();

    const empIds = allEmployees.map((e) => e.employeeId);
    const attendanceRecords = await Attendance.find({
      employeeId: { $in: empIds },
      date,
    }).lean();

    const attendanceMap = {};
    attendanceRecords.forEach((a) => {
      attendanceMap[a.employeeId] = a;
    });

    const present = [];
    const absent = [];
    const late = [];

    allEmployees.forEach((emp) => {
      const record = attendanceMap[emp.employeeId];
      if (record) {
        const enriched = { ...emp, attendance: record };
        present.push(enriched);
        if (record.status === ATTENDANCE_STATUS.LATE) {
          late.push(enriched);
        }
      } else {
        absent.push(emp);
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        date,
        totalStaff: allEmployees.length,
        presentCount: present.length,
        absentCount: absent.length,
        lateCount: late.length,
        present,
        absent,
        late,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.submitCorrection = async (req, res, next) => {
  try {
    const { attendanceId, requestedCheckIn, requestedCheckOut, reason } = req.body;
    if (!attendanceId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'attendanceId and reason are required.',
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    if (req.user.role === ROLES.STAFF && attendance.employeeId !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only submit corrections for yourself.' });
    }

    const request = new CorrectionRequest({
      attendanceId: attendance._id,
      employeeId: attendance.employeeId,
      clusterId: attendance.clusterId,
      requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
      requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
      reason: reason.trim(),
    });

    await request.save();

    return res.status(201).json({
      success: true,
      message: 'Correction request submitted successfully.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewCorrection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewRemarks } = req.body; // APPROVED or REJECTED

    if (![CORRECTION_STATUS.APPROVED, CORRECTION_STATUS.REJECTED].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
    }

    const request = await CorrectionRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Correction request not found.' });
    }

    // Role check: Cluster Manager must have access to request.clusterId
    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!request.clusterId || !hasClusterAccess(req.user, request.clusterId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only review corrections for your assigned cluster.',
        });
      }
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewRemarks = reviewRemarks || null;
    await request.save();

    if (status === CORRECTION_STATUS.APPROVED) {
      const attendance = await Attendance.findById(request.attendanceId);
      if (attendance) {
        if (request.requestedCheckIn) attendance.checkInTime = request.requestedCheckIn;
        if (request.requestedCheckOut) attendance.checkOutTime = request.requestedCheckOut;
        if (attendance.checkInTime && attendance.checkOutTime) {
          const diffMs = new Date(attendance.checkOutTime).getTime() - new Date(attendance.checkInTime).getTime();
          attendance.totalWorkingMinutes = Math.max(0, Math.floor(diffMs / 60000));
        }
        attendance.notes = `Correction approved by ${req.user.employeeId}`;
        await attendance.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Correction request ${status.toLowerCase()} successfully.`,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
