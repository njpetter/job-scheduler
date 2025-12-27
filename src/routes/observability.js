/**
 * Observability Routes
 * Endpoints for monitoring, debugging, and metrics
 */

const express = require('express');
const router = express.Router();
const Execution = require('../models/Execution');
const scheduler = require('../services/scheduler');

/**
 * GET /api/metrics
 * Get system metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const schedulerMetrics = scheduler.getMetrics();
    
    res.json({
      scheduler: schedulerMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      scheduler: {
        isRunning: scheduler.isRunning,
        activeJobs: scheduler.jobs.size
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/executions
 * Get recent executions (for debugging)
 */
router.get('/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const executions = await Execution.getAll(limit);

    res.json({
      count: executions.length,
      executions
    });
  } catch (error) {
    console.error('[API] Error fetching executions:', error);
    res.status(500).json({
      error: 'Failed to fetch executions',
      message: error.message
    });
  }
});

/**
 * GET /api/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const schedulerMetrics = scheduler.getMetrics();
    
    // Get execution stats from database
    const allExecutions = await Execution.getAll(1000);
    const totalExecutions = allExecutions.length;
    const successCount = allExecutions.filter(e => e.status === 'success').length;
    const failureCount = allExecutions.filter(e => e.status === 'failure').length;
    const avgDuration = allExecutions.length > 0
      ? allExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / allExecutions.length
      : 0;

    res.json({
      scheduler: schedulerMetrics,
      database: {
        totalExecutions,
        successCount,
        failureCount,
        successRate: totalExecutions > 0 
          ? ((successCount / totalExecutions) * 100).toFixed(2) + '%'
          : '0%',
        averageDuration: Math.round(avgDuration) + 'ms'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

module.exports = router;

