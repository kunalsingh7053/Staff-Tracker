const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Employee, Attendance, TravelSession, Cluster } = require('../models');
const { ROLES } = require('../constants');
const { hasClusterAccess } = require('../middleware/rbac');

exports.getDashboardMetrics = async (req, res, next) => {
  try {
    const { clusterId } = req.query;
    let employeeFilter = { accountStatus: 'ACTIVE' };
    const todayStr = new Date().toISOString().split('T')[0];

    // 3-Level Scope Enforcement:
    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) {
        employeeFilter.clusterId = clusterId;
      }
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowed = req.user.assignedClusterIds || [];
      if (allowed.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            totalEmployees: 0,
            presentToday: 0,
            absentToday: 0,
            currentlyTravelling: 0,
            totalKmTravelledToday: 0,
            lateArrivals: 0,
            clustersCount: 0,
          },
        });
      }

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({ success: false, message: 'Forbidden.' });
        }
        employeeFilter.clusterId = clusterId;
      } else {
        employeeFilter.clusterId = { $in: allowed };
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const employees = await Employee.find(employeeFilter).select('employeeId clusterId');
    const empIds = employees.map((e) => e.employeeId);

    // Attendance stats today
    const attendanceToday = await Attendance.find({ employeeId: { $in: empIds }, date: todayStr });
    const presentCount = attendanceToday.length;
    const lateArrivals = attendanceToday.filter((a) => a.status === 'LATE').length;
    const absentCount = Math.max(0, employees.length - presentCount);

    // Active travelling today
    const activeSessions = await TravelSession.find({
      employeeId: { $in: empIds },
      sessionStatus: 'IN_PROGRESS',
    });

    // Total distance travelled today (sessions started today)
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const allTodaySessions = await TravelSession.find({
      employeeId: { $in: empIds },
      startTime: { $gte: todayStart },
    });
    const totalKmTravelledToday = allTodaySessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0);

    const clustersCount = req.user.role === ROLES.ADMIN
      ? await Cluster.countDocuments({ isActive: true })
      : (req.user.assignedClusterIds ? req.user.assignedClusterIds.length : 0);

    return res.status(200).json({
      success: true,
      data: {
        role: req.user.role,
        totalEmployees: employees.length,
        presentToday: presentCount,
        absentToday: absentCount,
        currentlyTravelling: activeSessions.length,
        totalKmTravelledToday: Math.round(totalKmTravelledToday * 100) / 100,
        lateArrivals,
        clustersCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const { clusterId, date = new Date().toISOString().split('T')[0] } = req.query;
    let employeeFilter = { accountStatus: 'ACTIVE' };

    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowed = req.user.assignedClusterIds || [];
      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) return res.status(403).json({ success: false, message: 'Forbidden.' });
        employeeFilter.clusterId = clusterId;
      } else {
        employeeFilter.clusterId = { $in: allowed };
      }
    } else if (req.user.role === ROLES.ADMIN && clusterId) {
      employeeFilter.clusterId = clusterId;
    }

    const employees = await Employee.find(employeeFilter).populate('clusterId', 'name code').lean();
    const empIds = employees.map((e) => e.employeeId);
    const attendance = await Attendance.find({ employeeId: { $in: empIds }, date }).lean();

    const attMap = {};
    attendance.forEach((a) => {
      attMap[a.employeeId] = a;
    });

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Staff Tracker System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Attendance & Travel - ${date}`);
    sheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 16 },
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Cluster', key: 'cluster', width: 22 },
      { header: 'Department', key: 'dept', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Check In', key: 'checkIn', width: 14 },
      { header: 'Check Out', key: 'checkOut', width: 14 },
      { header: 'Working Hours', key: 'hours', width: 16 },
      { header: 'Late Minutes', key: 'late', width: 14 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D47A1' },
    };

    employees.forEach((emp) => {
      const a = attMap[emp.employeeId];
      sheet.addRow({
        empId: emp.employeeId,
        name: emp.fullName,
        cluster: emp.clusterId ? `${emp.clusterId.name} (${emp.clusterId.code})` : 'Unassigned',
        dept: emp.department,
        status: a ? a.status : 'ABSENT',
        checkIn: a ? new Date(a.checkInTime).toLocaleTimeString() : '-',
        checkOut: a && a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '-',
        hours: a ? (a.totalWorkingMinutes / 60).toFixed(1) + ' hrs' : '0.0 hrs',
        late: a ? `${a.lateMinutes} mins` : '-',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Staff_Report_${date}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

exports.exportPdf = async (req, res, next) => {
  try {
    const { clusterId, date = new Date().toISOString().split('T')[0] } = req.query;
    let employeeFilter = { accountStatus: 'ACTIVE' };

    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowed = req.user.assignedClusterIds || [];
      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) return res.status(403).json({ success: false, message: 'Forbidden.' });
        employeeFilter.clusterId = clusterId;
      } else {
        employeeFilter.clusterId = { $in: allowed };
      }
    } else if (req.user.role === ROLES.ADMIN && clusterId) {
      employeeFilter.clusterId = clusterId;
    }

    const employees = await Employee.find(employeeFilter).populate('clusterId', 'name code').lean();
    const empIds = employees.map((e) => e.employeeId);
    const attendance = await Attendance.find({ employeeId: { $in: empIds }, date }).lean();

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Staff_Summary_${date}.pdf"`);
    doc.pipe(res);

    // PDF Header
    doc.fontSize(20).text('K.K. GROUP - STAFF TRACKER', { align: 'center', bold: true });
    doc.fontSize(12).text(`Executive Field & Attendance Summary (${date})`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary Box
    const presentCount = attendance.length;
    const absentCount = Math.max(0, employees.length - presentCount);

    doc.fontSize(11).text(`Total Staff: ${employees.length}  |  Present: ${presentCount}  |  Absent: ${absentCount}`);
    doc.moveDown();
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(40, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Table rows
    employees.forEach((emp, index) => {
      const a = attendance.find((att) => att.employeeId === emp.employeeId);
      const status = a ? a.status : 'ABSENT';
      const cluster = emp.clusterId ? emp.clusterId.code : 'N/A';
      const checkIn = a ? new Date(a.checkInTime).toLocaleTimeString() : '--:--';

      doc.fontSize(10).text(
        `${index + 1}. [${emp.employeeId}] ${emp.fullName} - ${cluster} | Status: ${status} | CheckIn: ${checkIn}`
      );
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};
