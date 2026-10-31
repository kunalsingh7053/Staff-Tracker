const mongoose = require('mongoose');
const logger = require('../utils/logger');
const env = require('./env');

const connectDB = async (customUri = null) => {
  const uri = customUri || env.MONGODB_URI;
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB Connection Closed.');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
  }
};

module.exports = { connectDB, disconnectDB };
