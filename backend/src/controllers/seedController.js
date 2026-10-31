const { User, Employee, Cluster, CompanySettings, Attendance, TravelSession } = require('../models');
const { ROLES, ACCOUNT_STATUS, ATTENDANCE_STATUS, TRAVEL_SESSION_STATUS } = require('../constants');

exports.seedDatabase = async (req, res, next) => {
  try {
    // 1. Ensure Company Settings exist
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        companyName: 'K.K. GROUP',
        workShiftStart: '09:00',
        workShiftEnd: '18:00',
        graceMinutes: 15,
        defaultPerKmRate: 6.5,
        gpsAccuracyThresholdMeters: 40,
        maxTravelSpeedKmh: 130,
      });
    }

    // 2. Create Admin if not present
    let admin = await User.findOne({ email: 'admin@kkgroup.com' });
    if (!admin) {
      const passwordHash = await User.hashPassword('Admin@123');
      admin = await User.create({
        employeeId: 'KK-ADM-001',
        email: 'admin@kkgroup.com',
        passwordHash,
        role: ROLES.ADMIN,
      });

      await Employee.create({
        userId: admin._id,
        employeeId: 'KK-ADM-001',
        fullName: 'Executive Administrator',
        mobileNumber: '+919999000001',
        department: 'Executive Management',
        designation: 'General Manager',
        baseSalary: 120000,
        perKmRate: 10.0,
      });
    }

    // 3. Create Clusters
    let delhiCluster = await Cluster.findOne({ code: 'CL-DEL-01' });
    if (!delhiCluster) {
      delhiCluster = await Cluster.create({
        name: 'Delhi NCR Hub',
        code: 'CL-DEL-01',
        description: 'Northern regional field operations and client service',
        city: 'New Delhi',
        state: 'Delhi',
        geofenceCenter: { type: 'Point', coordinates: [77.2090, 28.6139] },
        radiusMeters: 15000,
        createdBy: admin._id,
      });
    }

    let mumbaiCluster = await Cluster.findOne({ code: 'CL-BOM-01' });
    if (!mumbaiCluster) {
      mumbaiCluster = await Cluster.create({
        name: 'Mumbai Commercial Zone',
        code: 'CL-BOM-01',
        description: 'Western regional field supply chain operations',
        city: 'Mumbai',
        state: 'Maharashtra',
        geofenceCenter: { type: 'Point', coordinates: [72.8777, 19.0760] },
        radiusMeters: 20000,
        createdBy: admin._id,
      });
    }

    // 4. Create Cluster Managers
    let delhiMgr = await User.findOne({ email: 'delhi.mgr@kkgroup.com' });
    if (!delhiMgr) {
      const passwordHash = await User.hashPassword('Manager@123');
      delhiMgr = await User.create({
        employeeId: 'KK-MGR-101',
        email: 'delhi.mgr@kkgroup.com',
        passwordHash,
        role: ROLES.CLUSTER_MANAGER,
        assignedClusterIds: [delhiCluster._id],
      });

      await Employee.create({
        userId: delhiMgr._id,
        employeeId: 'KK-MGR-101',
        fullName: 'Vikram Malhotra',
        mobileNumber: '+919811000101',
        department: 'Operations',
        designation: 'Cluster Manager (Delhi)',
        clusterId: delhiCluster._id,
        baseSalary: 75000,
        perKmRate: 8.0,
      });

      await Cluster.findByIdAndUpdate(delhiCluster._id, { $addToSet: { managerIds: delhiMgr._id } });
    }

    let mumbaiMgr = await User.findOne({ email: 'mumbai.mgr@kkgroup.com' });
    if (!mumbaiMgr) {
      const passwordHash = await User.hashPassword('Manager@123');
      mumbaiMgr = await User.create({
        employeeId: 'KK-MGR-102',
        email: 'mumbai.mgr@kkgroup.com',
        passwordHash,
        role: ROLES.CLUSTER_MANAGER,
        assignedClusterIds: [mumbaiCluster._id],
      });

      await Employee.create({
        userId: mumbaiMgr._id,
        employeeId: 'KK-MGR-102',
        fullName: 'Pooja Deshmukh',
        mobileNumber: '+919822000102',
        department: 'Operations',
        designation: 'Cluster Manager (Mumbai)',
        clusterId: mumbaiCluster._id,
        baseSalary: 75000,
        perKmRate: 8.0,
      });

      await Cluster.findByIdAndUpdate(mumbaiCluster._id, { $addToSet: { managerIds: mumbaiMgr._id } });
    }

    // 5. Create Staff Employees
    let delhiStaff = await User.findOne({ email: 'delhi.staff@kkgroup.com' });
    if (!delhiStaff) {
      const passwordHash = await User.hashPassword('Staff@123');
      delhiStaff = await User.create({
        employeeId: 'KK-EMP-201',
        email: 'delhi.staff@kkgroup.com',
        passwordHash,
        role: ROLES.STAFF,
      });

      await Employee.create({
        userId: delhiStaff._id,
        employeeId: 'KK-EMP-201',
        fullName: 'Amit Verma',
        mobileNumber: '+919833000201',
        department: 'Field Logistics',
        designation: 'Senior Field Representative',
        clusterId: delhiCluster._id,
        managerId: delhiMgr._id,
        baseSalary: 28000,
        perKmRate: 6.5,
      });
    }

    let mumbaiStaff = await User.findOne({ email: 'mumbai.staff@kkgroup.com' });
    if (!mumbaiStaff) {
      const passwordHash = await User.hashPassword('Staff@123');
      mumbaiStaff = await User.create({
        employeeId: 'KK-EMP-202',
        email: 'mumbai.staff@kkgroup.com',
        passwordHash,
        role: ROLES.STAFF,
      });

      await Employee.create({
        userId: mumbaiStaff._id,
        employeeId: 'KK-EMP-202',
        fullName: 'Rohan Kulkarni',
        mobileNumber: '+919844000202',
        department: 'Field Logistics',
        designation: 'Field Inspection Officer',
        clusterId: mumbaiCluster._id,
        managerId: mumbaiMgr._id,
        baseSalary: 28000,
        perKmRate: 6.5,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Demo database seeded successfully with 3-tier hierarchy.',
      data: {
        admin: { email: 'admin@kkgroup.com', password: 'Admin@123', role: 'ADMIN' },
        delhiClusterManager: { email: 'delhi.mgr@kkgroup.com', password: 'Manager@123', role: 'CLUSTER_MANAGER', cluster: 'Delhi NCR Hub' },
        mumbaiClusterManager: { email: 'mumbai.mgr@kkgroup.com', password: 'Manager@123', role: 'CLUSTER_MANAGER', cluster: 'Mumbai Commercial Zone' },
        delhiStaff: { email: 'delhi.staff@kkgroup.com', password: 'Staff@123', role: 'STAFF', cluster: 'Delhi NCR Hub' },
        mumbaiStaff: { email: 'mumbai.staff@kkgroup.com', password: 'Staff@123', role: 'STAFF', cluster: 'Mumbai Commercial Zone' },
      },
    });
  } catch (error) {
    next(error);
  }
};
