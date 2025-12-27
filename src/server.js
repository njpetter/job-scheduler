/**
 * Main Server File
 * Entry point for the Job Scheduler application
 */

const express = require('express');
const db = require('./database/db');
const scheduler = require('./services/scheduler');
const jobRoutes = require('./routes/jobs');
const observabilityRoutes = require('./routes/observability');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Serve static frontend files (Dashboard)
// This must be BEFORE other routes so it works on '/'
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/jobs', jobRoutes);
app.use('/api', observabilityRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Initialize database and start server
async function start() {
  try {
    // Connect to database
    await db.connect();
    console.log('✓ Database connected');

    // Start scheduler
    await scheduler.start();
    console.log('✓ Scheduler started');

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard:    http://localhost:${PORT}`);
      console.log(`📈 Metrics:      http://localhost:${PORT}/api/metrics\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  scheduler.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  scheduler.stop();
  await db.close();
  process.exit(0);
});

// Start the application
start();