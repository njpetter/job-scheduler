const express = require('express');
const db = require('./database/db');
const scheduler = require('./services/scheduler');
const jobRoutes = require('./routes/jobs');
const observabilityRoutes = require('./routes/observability');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(express.static(path.join(__dirname, '../public')));
app.put('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { schedule, api, type } = req.body;
        
        // Basic Validation
        if (!schedule || !api) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Call the new updateJob method in scheduler.js
        await scheduler.updateJob(id, { schedule, api, type });
        
        res.json({ message: 'Job updated successfully', jobId: id });
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use('/api/jobs', jobRoutes);
app.use('/api', observabilityRoutes);
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

async function start() {
  try {
    await db.connect();
    console.log('✓ Database connected');

    await scheduler.start();
    console.log('✓ Scheduler started');

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

start();