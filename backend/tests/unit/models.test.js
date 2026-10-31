const mongoose = require('mongoose');
const {
  User,
  Employee,
  Attendance,
  TravelSession,
  LocationPoint,
  SalaryRecord,
  TravelClaim,
  CorrectionRequest,
  CompanySettings,
  Notification,
  AuditLog,
} = require('../../src/models');
const {
  ROLES,
  ACCOUNT_STATUS,
  ATTENDANCE_STATUS,
  TRAVEL_SESSION_STATUS,
  CLAIM_STATUS,
  CORRECTION_STATUS,
  SALARY_STATUS,
  NOTIFICATION_TYPE,
} = require('../../src/constants');

describe('Phase 1 Database Models & Schema Validation', () => {

  describe('User Model', () => {
    it('should validate a properly structured User document', async () => {
      const user = new User({
        employeeId: 'kk-emp-101',
        email: 'employee@kkgroup.com',
        passwordHash: 'hashed_password_sample_string',
        role: ROLES.STAFF,
      });

      const err = user.validateSync();
      expect(err).toBeUndefined();
      expect(user.employeeId).toBe('KK-EMP-101'); // uppercase transform
      expect(user.role).toBe(ROLES.STAFF);
      expect(user.isActive).toBe(true);
    });

    it('should fail validation if required fields are missing', () => {
      const user = new User({});
      const err = user.validateSync();
      expect(err.errors.employeeId).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.passwordHash).toBeDefined();
    });

    it('should reject invalid email formatting', () => {
      const user = new User({
        employeeId: 'KK-EMP-102',
        email: 'invalid-email-address',
        passwordHash: 'dummyhash',
      });
      const err = user.validateSync();
      expect(err.errors.email).toBeDefined();
    });

    it('should correctly hash passwords and compare with bcrypt', async () => {
      const plain = 'SecurePassword@123';
      const hash = await User.hashPassword(plain);
      expect(hash).not.toBe(plain);

      const user = new User({
        employeeId: 'KK-ADMIN-01',
        email: 'admin@kkgroup.com',
        passwordHash: hash,
        role: ROLES.ADMIN,
      });

      const isMatch = await user.comparePassword(plain);
      expect(isMatch).toBe(true);

      const isWrongMatch = await user.comparePassword('WrongPassword');
      expect(isWrongMatch).toBe(false);

      const jsonUser = user.toJSON();
      expect(jsonUser.passwordHash).toBeUndefined();
    });
  });

  describe('Employee Model', () => {
    it('should validate valid employee data', () => {
      const emp = new Employee({
        userId: new mongoose.Types.ObjectId(),
        employeeId: 'KK-EMP-101',
        fullName: 'Rajesh Kumar',
        mobileNumber: '+919876543210',
        department: 'Operations',
        designation: 'Senior Field Executive',
        baseSalary: 35000,
        perKmRate: 6.5,
      });

      const err = emp.validateSync();
      expect(err).toBeUndefined();
      expect(emp.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(emp.perKmRate).toBe(6.5);
    });

    it('should reject negative salary or negative perKmRate', () => {
      const emp = new Employee({
        userId: new mongoose.Types.ObjectId(),
        employeeId: 'KK-EMP-102',
        fullName: 'Anil Sharma',
        mobileNumber: '+919876543211',
        department: 'Logistics',
        designation: 'Driver',
        baseSalary: -500,
        perKmRate: -2.0,
      });

      const err = emp.validateSync();
      expect(err.errors.baseSalary).toBeDefined();
      expect(err.errors.perKmRate).toBeDefined();
    });
  });

  describe('Attendance Model', () => {
    it('should validate complete check-in attendance record', () => {
      const att = new Attendance({
        employeeId: 'KK-EMP-101',
        userId: new mongoose.Types.ObjectId(),
        date: '2026-10-30',
        checkInTime: new Date(),
        checkInLocation: {
          type: 'Point',
          coordinates: [77.2090, 28.6139], // New Delhi [lng, lat]
        },
        checkInDeviceId: 'device-uuid-android-pixel-7',
        status: ATTENDANCE_STATUS.PRESENT,
      });

      const err = att.validateSync();
      expect(err).toBeUndefined();
      expect(att.totalWorkingMinutes).toBe(0);
      expect(att.isOfflineSync).toBe(false);
    });

    it('should require checkInLocation and checkInDeviceId', () => {
      const att = new Attendance({
        employeeId: 'KK-EMP-101',
        userId: new mongoose.Types.ObjectId(),
        date: '2026-10-30',
        checkInTime: new Date(),
      });

      const err = att.validateSync();
      expect(err.errors.checkInLocation).toBeDefined();
      expect(err.errors.checkInDeviceId).toBeDefined();
    });
  });

  describe('TravelSession & LocationPoint Models', () => {
    it('should validate TravelSession with starting coordinate', () => {
      const session = new TravelSession({
        attendanceId: new mongoose.Types.ObjectId(),
        employeeId: 'KK-EMP-101',
        startTime: new Date(),
        startLocation: {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
        },
        sessionStatus: TRAVEL_SESSION_STATUS.IN_PROGRESS,
      });

      const err = session.validateSync();
      expect(err).toBeUndefined();
      expect(session.totalDistanceKm).toBe(0);
      expect(session.purpose).toBe('Field Duty');
    });

    it('should validate LocationPoint breadcrumb with accuracy & telemetry', () => {
      const point = new LocationPoint({
        sessionId: new mongoose.Types.ObjectId(),
        employeeId: 'KK-EMP-101',
        location: {
          type: 'Point',
          coordinates: [77.2100, 28.6150],
        },
        accuracy: 12.5,
        speed: 8.5,
        timestamp: new Date(),
        batteryLevel: 85,
        isCharging: false,
      });

      const err = point.validateSync();
      expect(err).toBeUndefined();
      expect(point.isFiltered).toBe(false);
    });
  });

  describe('SalaryRecord, Claims, & Settings Models', () => {
    it('should validate SalaryRecord calculations', () => {
      const salary = new SalaryRecord({
        employeeId: 'KK-EMP-101',
        monthYear: '2026-10',
        baseSalary: 30000,
        totalWorkingDays: 26,
        presentDays: 24,
        totalDistanceKm: 420.5,
        perKmRate: 6.5,
        travelAllowanceAmount: 2733.25,
        grossEarnings: 32733.25,
        netPayable: 32733.25,
        status: SALARY_STATUS.DRAFT,
      });

      const err = salary.validateSync();
      expect(err).toBeUndefined();
      expect(salary.travelAllowanceAmount).toBe(2733.25);
    });

    it('should validate TravelClaim record', () => {
      const claim = new TravelClaim({
        employeeId: 'KK-EMP-101',
        claimDate: '2026-10-30',
        claimedDistanceKm: 45.2,
        claimedAmount: 293.8,
        remarks: 'Client inspection visit at Sector 62',
      });

      const err = claim.validateSync();
      expect(err).toBeUndefined();
      expect(claim.status).toBe(CLAIM_STATUS.PENDING);
    });

    it('should load default CompanySettings correctly', () => {
      const settings = new CompanySettings();
      expect(settings.companyName).toBe('K.K. GROUP');
      expect(settings.workShiftStart).toBe('09:00');
      expect(settings.workShiftEnd).toBe('18:00');
      expect(settings.graceMinutes).toBe(15);
      expect(settings.defaultPerKmRate).toBe(6.5);
      expect(settings.gpsAccuracyThresholdMeters).toBe(40);
      expect(settings.maxTravelSpeedKmh).toBe(130);
    });

    it('should validate Notification and AuditLog models', () => {
      const notification = new Notification({
        recipientUserId: new mongoose.Types.ObjectId(),
        title: 'Check-in Confirmed',
        body: 'Your attendance for today has been marked successfully.',
        type: NOTIFICATION_TYPE.CHECK_IN,
      });
      expect(notification.validateSync()).toBeUndefined();
      expect(notification.isRead).toBe(false);

      const log = new AuditLog({
        actorRole: ROLES.ADMIN,
        action: 'EMPLOYEE_CREATED',
        entity: 'Employee',
        entityId: 'KK-EMP-101',
      });
      expect(log.validateSync()).toBeUndefined();
      expect(log.timestamp).toBeDefined();
    });
  });
});
