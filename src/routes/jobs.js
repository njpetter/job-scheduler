const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Execution = require('../models/Execution');
const scheduler = require('../services/scheduler');

router.post('/', async (req, res) => {
  try {
    const { schedule, api, type } = req.body;

    if (!schedule || !api || !type) {
      return res.status(400).json({
        error: 'Missing required fields: schedule, api, type'
      });
    }

    if (type !== 'ATLEAST_ONCE' && type !== 'EXACTLY_ONCE') {
      return res.status(400).json({
        error: 'Invalid type. Must be ATLEAST_ONCE or EXACTLY_ONCE'
      });
    }

    if (typeof schedule !== 'string' || schedule.split(/\s+/).length !== 6) {
      return res.status(400).json({
        error: 'Invalid schedule format. Expected: "second minute hour day month dayOfWeek"'
      });
    }

    const job = await Job.create({ schedule, api, type });
    await scheduler.addJob(job);

    res.status(201).json({
      jobId: job.jobId,
      status: 'created',
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('[API] Error creating job:', error);
    res.status(500).json({
      error: 'Failed to create job',
      message: error.message
    });
  }
});

router.get('/:jobId/executions', async (req, res) => {
  try {
    const { jobId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const job = await Job.getById(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    const executions = await Execution.getLastN(jobId, limit);

    res.json({
      jobId,
      executions: executions.map(exec => ({
        executionId: exec.executionId,
        timestamp: exec.timestamp,
        status: exec.status,
        httpStatus: exec.httpStatus,
        duration: exec.duration,
        error: exec.error
      }))
    });
  } catch (error) {
    console.error('[API] Error fetching executions:', error);
    res.status(500).json({
      error: 'Failed to fetch executions',
      message: error.message
    });
  }
});

router.put('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { schedule, api, type } = req.body;

    const job = await Job.getById(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    const updates = {};
    if (schedule !== undefined) {
      if (typeof schedule !== 'string' || schedule.split(/\s+/).length !== 6) {
        return res.status(400).json({
          error: 'Invalid schedule format'
        });
      }
      updates.schedule = schedule;
    }
    if (api !== undefined) updates.api = api;
    if (type !== undefined) {
      if (type !== 'ATLEAST_ONCE' && type !== 'EXACTLY_ONCE') {
        return res.status(400).json({
          error: 'Invalid type. Must be ATLEAST_ONCE or EXACTLY_ONCE'
        });
      }
      updates.type = type;
    }

    const updatedJob = await Job.update(jobId, updates);
    const schedulerUpdates = {
      schedule: updates.schedule !== undefined ? updates.schedule : updatedJob.schedule,
      api: updates.api !== undefined ? updates.api : updatedJob.api,
      type: updates.type !== undefined ? updates.type : updatedJob.type
    };
    await scheduler.updateJob(jobId, schedulerUpdates);

    res.json({
      jobId: updatedJob.jobId,
      status: 'updated',
      job: updatedJob
    });
  } catch (error) {
    console.error('[API] Error updating job:', error);
    res.status(500).json({
      error: 'Failed to update job',
      message: error.message
    });
  }
});

router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.getById(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    res.json(job);
  } catch (error) {
    console.error('[API] Error fetching job:', error);
    res.status(500).json({
      error: 'Failed to fetch job',
      message: error.message
    });
  }
});

router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.getById(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    await Job.delete(jobId);
    scheduler.removeJob(jobId);

    res.json({
      jobId,
      status: 'deleted',
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting job:', error);
    res.status(500).json({
      error: 'Failed to delete job',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const jobs = await Job.getAll();
    res.json({
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('[API] Error fetching jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
});

module.exports = router;

