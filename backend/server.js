const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      logger.info(`========================================================`);
      logger.info(`  Staff Tracker Production Backend Service Running`);
      logger.info(`  Port: ${env.PORT} | Environment: ${env.NODE_ENV}`);
      logger.info(`  Web Portal URL: http://localhost:${env.PORT}`);
      logger.info(`  API Base URL:   http://localhost:${env.PORT}/api/v1`);
      logger.info(`========================================================`);
    });

    const gracefulShutdown = () => {
      logger.info('Received terminate signal. Closing HTTP server gracefully...');
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
