const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const seedController = require('./src/controllers/seedController');
const logger = require('./src/utils/logger');
const env = require('./src/config/env');

async function runDemoServer() {
  try {
    let mongoUri = process.env.MONGODB_URI;

    // If local MongoDB is not running, spin up the fast in-memory MongoDB instance
    logger.info('Initializing MongoDB Database for Staff Tracker...');
    let mongod = null;
    try {
      // Test if configured MONGODB_URI is reachable
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      logger.info(`Connected to external MongoDB at ${mongoUri}`);
    } catch (connErr) {
      logger.info('External MongoDB not detected. Launching in-memory MongoDB instance...');
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await mongoose.connect(mongoUri);
      logger.info(`In-Memory MongoDB started at ${mongoUri}`);
    }

    // Automatically seed the 3-level hierarchy:
    // 1 Admin, 2 Clusters (Delhi & Mumbai), 2 Cluster Managers, 2 Field Staff
    const mockReq = {};
    const mockRes = {
      status: () => mockRes,
      json: (data) => data,
    };
    await seedController.seedDatabase(mockReq, mockRes, (err) => {
      if (err) logger.error(`Seed warning: ${err.message}`);
    });
    logger.info('Test database automatically populated with 3-tier hierarchy.');

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log('\n================================================================');
      console.log('  🚀 STAFF TRACKER ENTERPRISE DEMO SERVER IS READY!');
      console.log('================================================================');
      console.log(`  🌐 WEB PORTAL:        http://localhost:${PORT}`);
      console.log(`  📡 API BASE URL:      http://localhost:${PORT}/api/v1`);
      console.log('----------------------------------------------------------------');
      console.log('  🔑 PRE-CONFIGURED 3-TIER TEST ACCOUNTS:');
      console.log('     1. Admin:           admin@kkgroup.com     / Admin@123');
      console.log('     2. Delhi Manager:   delhi.mgr@kkgroup.com / Manager@123');
      console.log('     3. Mumbai Manager:  mumbai.mgr@kkgroup.com/ Manager@123');
      console.log('     4. Delhi Staff:     delhi.staff@kkgroup.com/ Staff@123');
      console.log('     5. Mumbai Staff:    mumbai.staff@kkgroup.com/ Staff@123');
      console.log('================================================================');
      console.log('  👉 Open http://localhost:' + PORT + ' in your browser to test.');
      console.log('================================================================\n');
    });

    const cleanup = async () => {
      logger.info('Shutting down demo server...');
      server.close();
      await mongoose.disconnect();
      if (mongod) await mongod.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (error) {
    logger.error(`Failed to launch demo server: ${error.message}`);
    process.exit(1);
  }
}

runDemoServer();
