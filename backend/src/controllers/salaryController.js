const { SalaryRecord, Employee, Attendance, TravelSession, TravelClaim, AuditLog } = require('../models');
const { ROLES, SALARY_STATUS, CLAIM_STATUS } = require('../constants');
const { hasClusterAccess } = require('../middleware/rbac');

exports.generateMonthlySalary = async (req, res, next) => {
  try {
    const { monthYear, clusterId, totalWorkingDaysInMonth = 26 } = req.body; // 'YYYY-MM'

    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({
        success: false,
        message: 'Valid monthYear in format YYYY-MM is required.',
      });
    }

    let employeeFilter = { accountStatus: 'ACTIVE' };
    if (clusterId) {
      employeeFilter.clusterId = clusterId;
    }

    const employees = await Employee.find(employeeFilter);
    const generatedRecords = [];

    for (const emp of employees) {
      // 1. Calculate attendance stats for the month
      const attendance = await Attendance.find({
        employeeId: emp.employeeId,
        date: { $regex: `^${monthYear}` },
      });

      let presentDays = 0;
      let halfDays = 0;
      let lateCount = 0;
      let totalOvertimeMinutes = 0;

      attendance.forEach((att) => {
        if (att.status === 'HALF_DAY') {
          halfDays++;
        } else {
          presentDays++;
        }
        if (att.status === 'LATE') lateCount++;
        totalOvertimeMinutes += att.overtimeMinutes || 0;
      });

      const effectivePresentDays = presentDays + halfDays * 0.5;
      const absentDays = Math.max(0, totalWorkingDaysInMonth - effectivePresentDays);

      // 2. Calculate verified field travel distance for the month
      const startDate = new Date(`${monthYear}-01T00:00:00.000Z`);
      const [year, month] = monthYear.split('-').map(Number);
      const endDate = new Date(year, month, 1);

      const travelSessions = await TravelSession.find({
        employeeId: emp.employeeId,
        startTime: { $gte: startDate, $lt: endDate },
        sessionStatus: 'COMPLETED',
      });

      const totalDistanceKm = travelSessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0);
      const perKmRate = emp.perKmRate || 6.5;
      const travelAllowanceAmount = Math.round(totalDistanceKm * perKmRate * 100) / 100;

      // 3. Pro-rated base salary based on attendance
      const dailyBaseWage = emp.dailyWage > 0 ? emp.dailyWage : emp.baseSalary / totalWorkingDaysInMonth;
      const earnedBaseSalary = Math.round(dailyBaseWage * effectivePresentDays * 100) / 100;

      // 4. Overtime pay
      const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10;
      const overtimePay = Math.round(overtimeHours * (emp.overtimeHourlyRate || 0) * 100) / 100;

      // 5. Deductions for unexcused absences
      const deductions = Math.round(dailyBaseWage * absentDays * 100) / 100;

      const grossEarnings = Math.round((earnedBaseSalary + travelAllowanceAmount + overtimePay) * 100) / 100;
      const netPayable = grossEarnings; // Deductions already accounted for in earnedBaseSalary

      const salaryDoc = await SalaryRecord.findOneAndUpdate(
        { employeeId: emp.employeeId, monthYear },
        {
          employeeId: emp.employeeId,
          clusterId: emp.clusterId || null,
          monthYear,
          baseSalary: emp.baseSalary,
          totalWorkingDays: totalWorkingDaysInMonth,
          presentDays,
          halfDays,
          absentDays,
          totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
          perKmRate,
          travelAllowanceAmount,
          overtimeHours,
          overtimePay,
          grossEarnings,
          deductions,
          netPayable,
          status: SALARY_STATUS.GENERATED,
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      generatedRecords.push(salaryDoc);
    }

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'SALARY_BATCH_GENERATED',
      entity: 'SalaryRecord',
      entityId: monthYear,
      newState: { count: generatedRecords.length, monthYear },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Generated salary records for ${generatedRecords.length} employees for ${monthYear}.`,
      data: generatedRecords,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalaryRecords = async (req, res, next) => {
  try {
    const { monthYear, clusterId } = req.query;
    let filter = {};

    if (monthYear) filter.monthYear = monthYear;

    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) filter.clusterId = clusterId;
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowed = req.user.assignedClusterIds || [];
      if (allowed.length === 0) return res.status(200).json({ success: true, data: [] });

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized cluster.' });
        }
        filter.clusterId = clusterId;
      } else {
        filter.clusterId = { $in: allowed };
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const records = await SalaryRecord.find(filter)
      .populate('clusterId', 'name code')
      .sort({ netPayable: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMySlips = async (req, res, next) => {
  try {
    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const records = await SalaryRecord.find({ employeeId: employee.employeeId })
      .sort({ monthYear: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitClaim = async (req, res, next) => {
  try {
    const { claimDate, claimedDistanceKm, claimedAmount, tollAndParkingAmount, remarks, sessionId } = req.body;

    if (!claimDate || claimedDistanceKm === undefined || claimedAmount === undefined || !remarks) {
      return res.status(400).json({
        success: false,
        message: 'claimDate, claimedDistanceKm, claimedAmount, and remarks are required.',
      });
    }

    const employee = req.employee || (await Employee.findOne({ userId: req.user._id }));
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    const claim = new TravelClaim({
      employeeId: employee.employeeId,
      clusterId: employee.clusterId || null,
      sessionId: sessionId || null,
      claimDate,
      claimedDistanceKm,
      claimedAmount,
      tollAndParkingAmount: tollAndParkingAmount || 0,
      remarks: remarks.trim(),
      status: CLAIM_STATUS.PENDING,
    });

    await claim.save();

    return res.status(201).json({
      success: true,
      message: 'Travel claim submitted successfully for review.',
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClaims = async (req, res, next) => {
  try {
    const { status, clusterId } = req.query;
    let filter = {};

    if (status) filter.status = status;

    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) filter.clusterId = clusterId;
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowed = req.user.assignedClusterIds || [];
      if (allowed.length === 0) return res.status(200).json({ success: true, data: [] });

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({ success: false, message: 'Forbidden.' });
        }
        filter.clusterId = clusterId;
      } else {
        filter.clusterId = { $in: allowed };
      }
    } else if (req.user.role === ROLES.STAFF) {
      filter.employeeId = req.user.employeeId;
    }

    const claims = await TravelClaim.find(filter)
      .populate('clusterId', 'name code')
      .populate('reviewedBy', 'employeeId email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: claims,
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (![CLAIM_STATUS.APPROVED, CLAIM_STATUS.REJECTED].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
    }

    const claim = await TravelClaim.findById(id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found.' });
    }

    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!claim.clusterId || !hasClusterAccess(req.user, claim.clusterId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: You cannot review claims for other clusters.' });
      }
    }

    claim.status = status;
    claim.reviewedBy = req.user._id;
    claim.reviewNotes = reviewNotes || null;
    await claim.save();

    return res.status(200).json({
      success: true,
      message: `Travel claim ${status.toLowerCase()} successfully.`,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};
