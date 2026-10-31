const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { connectDB, disconnectDB } = require('../../src/config/db');
const { User, Employee, Cluster } = require('../../src/models');
const { ROLES } = require('../../src/constants');

describe('3-Tier Role Hierarchy & Multi-Cluster Integration Tests', () => {
  let mongoServer;
  let adminToken;
  let managerDelhiToken;
  let managerMumbaiToken;
  let staffDelhiToken;
  let staffMumbaiToken;

  let delhiClusterId;
  let mumbaiClusterId;
  let staffDelhiEmpId;
  let staffMumbaiEmpId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await connectDB(uri);

    // Seed the initial database using the seed controller endpoint
    const seedRes = await request(app).post('/api/v1/auth/seed');
    expect(seedRes.status).toBe(200);

    // Login as Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      loginId: 'admin@kkgroup.com',
      password: 'Admin@123',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;

    // Login as Delhi Manager
    const delhiMgrLogin = await request(app).post('/api/v1/auth/login').send({
      loginId: 'delhi.mgr@kkgroup.com',
      password: 'Manager@123',
    });
    expect(delhiMgrLogin.status).toBe(200);
    managerDelhiToken = delhiMgrLogin.body.data.token;

    // Login as Mumbai Manager
    const mumbaiMgrLogin = await request(app).post('/api/v1/auth/login').send({
      loginId: 'mumbai.mgr@kkgroup.com',
      password: 'Manager@123',
    });
    expect(mumbaiMgrLogin.status).toBe(200);
    managerMumbaiToken = mumbaiMgrLogin.body.data.token;

    // Login as Delhi Staff
    const delhiStaffLogin = await request(app).post('/api/v1/auth/login').send({
      loginId: 'delhi.staff@kkgroup.com',
      password: 'Staff@123',
    });
    expect(delhiStaffLogin.status).toBe(200);
    staffDelhiToken = delhiStaffLogin.body.data.token;
    staffDelhiEmpId = delhiStaffLogin.body.data.user.employeeId;

    // Login as Mumbai Staff
    const mumbaiStaffLogin = await request(app).post('/api/v1/auth/login').send({
      loginId: 'mumbai.staff@kkgroup.com',
      password: 'Staff@123',
    });
    expect(mumbaiStaffLogin.status).toBe(200);
    staffMumbaiToken = mumbaiStaffLogin.body.data.token;
    staffMumbaiEmpId = mumbaiStaffLogin.body.data.user.employeeId;

    // Retrieve cluster IDs
    const clustersRes = await request(app)
      .get('/api/v1/clusters')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(clustersRes.status).toBe(200);

    const delhiCluster = clustersRes.body.data.find((c) => c.code === 'CL-DEL-01');
    const mumbaiCluster = clustersRes.body.data.find((c) => c.code === 'CL-BOM-01');
    delhiClusterId = delhiCluster._id;
    mumbaiClusterId = mumbaiCluster._id;
  });

  afterAll(async () => {
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('1. Cluster Scoping & Multi-Manager Support', () => {
    it('Admin should be able to create unlimited clusters', async () => {
      const res = await request(app)
        .post('/api/v1/clusters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bangalore Tech Zone',
          code: 'CL-BLR-01',
          city: 'Bangalore',
          state: 'Karnataka',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('CL-BLR-01');
    });

    it('Admin should see ALL company clusters', async () => {
      const res = await request(app)
        .get('/api/v1/clusters')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('Cluster Manager should see ONLY their assigned cluster(s)', async () => {
      const resDelhi = await request(app)
        .get('/api/v1/clusters')
        .set('Authorization', `Bearer ${managerDelhiToken}`);

      expect(resDelhi.status).toBe(200);
      expect(resDelhi.body.data.length).toBe(1);
      expect(resDelhi.body.data[0].code).toBe('CL-DEL-01');

      const resMumbai = await request(app)
        .get('/api/v1/clusters')
        .set('Authorization', `Bearer ${managerMumbaiToken}`);

      expect(resMumbai.status).toBe(200);
      expect(resMumbai.body.data.length).toBe(1);
      expect(resMumbai.body.data[0].code).toBe('CL-BOM-01');
    });

    it('Staff role should be FORBIDDEN from cluster management APIs', async () => {
      const res = await request(app)
        .get('/api/v1/clusters')
        .set('Authorization', `Bearer ${staffDelhiToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin should support assigning multiple managers to a single cluster', async () => {
      // Create a secondary manager for Delhi
      const newMgrRes = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Secondary Delhi Manager',
          email: 'delhi.mgr2@kkgroup.com',
          password: 'Password@123',
          mobileNumber: '+919999000888',
          department: 'Operations',
          designation: 'Assistant Cluster Manager',
          role: ROLES.CLUSTER_MANAGER,
          clusterId: delhiClusterId,
        });

      expect(newMgrRes.status).toBe(201);
      const newMgrUserId = newMgrRes.body.data.user.id;

      // Assign the new manager to Delhi cluster
      const assignRes = await request(app)
        .post(`/api/v1/clusters/${delhiClusterId}/managers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ managerIds: [newMgrUserId] });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.managerIds.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Employee Data Scoping & Role Boundaries', () => {
    it('Cluster Manager can only list employees in their assigned cluster', async () => {
      const res = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${managerDelhiToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((emp) => {
        expect(emp.clusterId._id.toString()).toBe(delhiClusterId.toString());
      });
    });

    it('Cluster Manager is FORBIDDEN from accessing other cluster employee details', async () => {
      // Delhi manager tries to view Mumbai staff
      const res = await request(app)
        .get(`/api/v1/employees/${staffMumbaiEmpId}`)
        .set('Authorization', `Bearer ${managerDelhiToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('Staff cannot query employee list', async () => {
      const res = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${staffDelhiToken}`);

      expect(res.status).toBe(403);
    });

    it('Staff can view their own profile, but NOT another employee’s profile', async () => {
      // Staff views self -> OK
      const selfRes = await request(app)
        .get(`/api/v1/employees/${staffDelhiEmpId}`)
        .set('Authorization', `Bearer ${staffDelhiToken}`);

      expect(selfRes.status).toBe(200);
      expect(selfRes.body.data.employeeId).toBe(staffDelhiEmpId);

      // Staff views another employee -> 403 Forbidden
      const otherRes = await request(app)
        .get(`/api/v1/employees/${staffMumbaiEmpId}`)
        .set('Authorization', `Bearer ${staffDelhiToken}`);

      expect(otherRes.status).toBe(403);
    });
  });

  describe('3. Employee Cluster Transfer', () => {
    it('Admin can transfer an employee between clusters', async () => {
      const transferRes = await request(app)
        .post('/api/v1/clusters/transfer-employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: staffDelhiEmpId,
          targetClusterId: mumbaiClusterId,
        });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.data.clusterId).toBe(mumbaiClusterId.toString());

      // Now Mumbai Manager CAN see the transferred employee
      const mumbaiView = await request(app)
        .get(`/api/v1/employees/${staffDelhiEmpId}`)
        .set('Authorization', `Bearer ${managerMumbaiToken}`);

      expect(mumbaiView.status).toBe(200);

      // Delhi Manager can NO LONGER view the transferred employee
      const delhiView = await request(app)
        .get(`/api/v1/employees/${staffDelhiEmpId}`)
        .set('Authorization', `Bearer ${managerDelhiToken}`);

      expect(delhiView.status).toBe(403);
    });
  });

  describe('4. Attendance, GPS Travel, & Live Monitoring', () => {
    it('Staff can check-in with GPS coords, device info, and prevent duplicate check-in', async () => {
      // First check-in succeeds
      const checkInRes = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({
          latitude: 19.0760,
          longitude: 72.8777,
          address: 'Mumbai Gateway Terminal',
          deviceId: 'android-imei-987654',
        });

      expect(checkInRes.status).toBe(201);
      expect(checkInRes.body.data.status).toBeDefined();

      // Duplicate check-in fails with 400 Bad Request
      const duplicateRes = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({
          latitude: 19.0760,
          longitude: 72.8777,
          deviceId: 'android-imei-987654',
        });

      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body.message).toContain('already checked in');
    });

    it('Staff can start travel, stream GPS waypoints, accumulate distance, and stop travel', async () => {
      // 1. Start travel
      const startRes = await request(app)
        .post('/api/v1/travel/start')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({
          latitude: 19.0760,
          longitude: 72.8777,
          purpose: 'Inspection Visit',
        });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.data._id;

      // 2. Stream GPS batch
      const now = Date.now();
      const points = [
        {
          latitude: 19.0780,
          longitude: 72.8790,
          accuracy: 10,
          speed: 8.5,
          timestamp: new Date(now + 30000), // 30s later (~31 km/h)
        },
        {
          latitude: 19.0800,
          longitude: 72.8803,
          accuracy: 12,
          speed: 8.7,
          timestamp: new Date(now + 60000), // 60s later (~31 km/h)
        },
      ];

      const batchRes = await request(app)
        .post('/api/v1/travel/location-batch')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({ sessionId, points });

      expect(batchRes.status).toBe(200);
      expect(batchRes.body.data.totalDistanceKm).toBeGreaterThan(0);

      // 3. Stop travel
      const stopRes = await request(app)
        .post('/api/v1/travel/stop')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({
          sessionId,
          latitude: 19.0900,
          longitude: 72.8900,
        });

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.sessionStatus).toBe('COMPLETED');
    });

    it('Cluster Manager live fleet tracker only includes personnel from their assigned cluster', async () => {
      const fleetRes = await request(app)
        .get('/api/v1/travel/live-fleet')
        .set('Authorization', `Bearer ${managerMumbaiToken}`);

      expect(fleetRes.status).toBe(200);
      fleetRes.body.data.forEach((item) => {
        expect(item.clusterId._id.toString()).toBe(mumbaiClusterId.toString());
      });
    });

    it('Admin live fleet tracker shows company-wide fleet', async () => {
      const adminFleetRes = await request(app)
        .get('/api/v1/travel/live-fleet')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminFleetRes.status).toBe(200);
      expect(adminFleetRes.body.totalFieldStaff).toBeGreaterThanOrEqual(2);
    });
  });

  describe('5. Salary Calculation & Travel Claim Workflow', () => {
    it('Admin can calculate monthly payroll combining working days and verified kilometres', async () => {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const res = await request(app)
        .post('/api/v1/salary/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ monthYear });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('Staff can submit travel reimbursement claim and Cluster Manager can approve it', async () => {
      // Staff submits claim
      const claimRes = await request(app)
        .post('/api/v1/salary/claims')
        .set('Authorization', `Bearer ${staffMumbaiToken}`)
        .send({
          claimDate: '2026-10-30',
          claimedDistanceKm: 28.5,
          claimedAmount: 185.25,
          tollAndParkingAmount: 40,
          remarks: 'Bridge toll and client travel',
        });

      expect(claimRes.status).toBe(201);
      const claimId = claimRes.body.data._id;

      // Mumbai Manager approves claim
      const reviewRes = await request(app)
        .put(`/api/v1/salary/claims/${claimId}`)
        .set('Authorization', `Bearer ${managerMumbaiToken}`)
        .send({ status: 'APPROVED' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('APPROVED');
    });
  });
});
