const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security HTTP headers with relaxed content security policy for maps and charts
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static web dashboard assets
app.use('/public', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Staff Tracker Enterprise Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Serve web portal for direct browser access
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
