/**
 * Job Scheduler
 * Manages job scheduling and execution timing
 */

const CronParser = require('../utils/cronParser');
const Job = require('../models/Job');
const Executor = require('./executor');
// We need direct DB access for the update command
const db = require('../database/db'); 

class Scheduler {
  constructor() {
    this.jobs = new Map(); // jobId -> { job, nextExecution, timeoutId }
    this.executor = new Executor();
    this.isRunning = false;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDelay: 0
    };
    this.db = db; // Store DB reference
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Scheduler] Starting scheduler...');
    
    // Load all active jobs from database
    await this.loadJobs();

    console.log('[Scheduler] Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.isRunning = false;
    // Clear all scheduled timeouts
    for (const [jobId, jobData] of this.jobs.entries()) {
      if (jobData.timeoutId) {
        clearTimeout(jobData.timeoutId);
      }
    }
    this.jobs.clear();
    console.log('[Scheduler] Scheduler stopped');
  }

  /**
   * Load all active jobs from database
   */
  async loadJobs() {
    const activeJobs = await Job.getAllActive();
    
    for (const job of activeJobs) {
      await this.scheduleJob(job);
    }
    
    console.log(`[Scheduler] Loaded ${activeJobs.length} active jobs`);
  }

  /**
   * Schedule a job (Internal Helper)
   */
  async scheduleJob(job) {
    try {
      const schedule = CronParser.parse(job.schedule);
      const now = new Date();
      const nextExecution = CronParser.getNextExecution(now, schedule);

      // Cancel existing schedule if job already exists in memory
      if (this.jobs.has(job.jobId)) {
        const existing = this.jobs.get(job.jobId);
        if (existing.timeoutId) {
          clearTimeout(existing.timeoutId);
        }
      }

      // Calculate delay until next execution
      let delay = nextExecution.getTime() - now.getTime();

      // If delay is negative (execution time passed), find next time
      if (delay < 0) {
        const newNext = CronParser.getNextExecution(new Date(now.getTime() + 1000), schedule);
        delay = newNext.getTime() - now.getTime();
        this.scheduleExecution(job, newNext, delay);
      } else {
        this.scheduleExecution(job, nextExecution, delay);
      }

      // Store in memory
      this.jobs.set(job.jobId, {
        job,
        schedule,
        nextExecution,
        timeoutId: null // Updated inside scheduleExecution
      });

      console.log(`[Scheduler] Scheduled job ${job.jobId} - Next execution: ${nextExecution.toISOString()}`);
    } catch (error) {
      console.error(`[Scheduler] Error scheduling job ${job.jobId}:`, error.message);
    }
  }

  /**
   * Schedule a single execution using the system timer
   */
  scheduleExecution(job, executionTime, delay) {
    // Safety check: 32-bit integer limit for setTimeout
    const MAX_DELAY = 2147483647;
    if (delay > MAX_DELAY) {
        delay = MAX_DELAY;
    }

    const timeoutId = setTimeout(async () => {
      // Execute the job
      await this.executeJob(job);
      
      // Once done, reschedule
      await this.rescheduleJob(job.jobId);
    }, delay);

    // Update the map
    if (this.jobs.has(job.jobId)) {
        const jobData = this.jobs.get(job.jobId);
        jobData.timeoutId = timeoutId;
        jobData.nextExecution = executionTime;
    }
  }

  /**
   * Execute a job
   */
  async executeJob(job) {
    const jobData = this.jobs.get(job.jobId);
    const scheduledTime = jobData ? jobData.nextExecution : new Date();
    const actualTime = new Date();
    const drift = actualTime.getTime() - scheduledTime.getTime();

    // Update metrics
    this.metrics.totalExecutions++;
    if (drift > 0) {
      this.metrics.averageDelay = 
        (this.metrics.averageDelay * (this.metrics.totalExecutions - 1) + drift) / 
        this.metrics.totalExecutions;
    }

    console.log(`[Scheduler] Executing job ${job.jobId} (drift: ${drift}ms)`);

    // Non-blocking execution
    this.executor.execute(job).then(result => {
      if (result.status === 'success') {
        this.metrics.successfulExecutions++;
      } else {
        this.metrics.failedExecutions++;
      }
    }).catch(error => {
      console.error(`[Scheduler] Error executing job ${job.jobId}:`, error);
      this.metrics.failedExecutions++;
    });
  }

  /**
   * Reschedule a job after execution
   */
  async rescheduleJob(jobId) {
    const jobData = this.jobs.get(jobId);
    if (!jobData) return;

    try {
      const now = new Date();
      const nextExecution = CronParser.getNextExecution(now, jobData.schedule);
      const delay = nextExecution.getTime() - now.getTime();

      this.scheduleExecution(jobData.job, nextExecution, delay);
      
      console.log(`[Scheduler] Rescheduled job ${jobId} - Next: ${nextExecution.toISOString()}`);
    } catch (error) {
      console.error(`[Scheduler] Error rescheduling job ${jobId}:`, error.message);
    }
  }

  /**
   * Add a new job
   */
  async addJob(job) {
    await this.scheduleJob(job);
  }

  /**
   * UPDATE JOB (New Method for True Editing)
   * Updates database and restarts the job in memory
   */
  async updateJob(jobId, updates) {
    // 1. Check if job exists in memory
    const existingJobData = this.jobs.get(jobId);
    if (!existingJobData) {
        throw new Error('Job not found in active scheduler');
    }

    // 2. Clear the old timer
    if (existingJobData.timeoutId) {
        clearTimeout(existingJobData.timeoutId);
    }

    // 3. Update the Database (Persistence)
    // We use the direct DB reference we imported
    await this.db.run(
        `UPDATE jobs SET schedule = ?, api = ?, type = ?, status = 'active' WHERE jobId = ?`,
        [updates.schedule, updates.api, updates.type, jobId]
    );

    // 4. Update the Job Object
    const updatedJob = {
        ...existingJobData.job, // Keep ID and other props
        schedule: updates.schedule,
        api: updates.api,
        type: updates.type,
        status: 'active'
    };

    // 5. Reschedule immediately with new settings
    await this.scheduleJob(updatedJob);
    
    console.log(`[Scheduler] updatedJob: Successfully updated ${jobId}`);
    return updatedJob;
  }

  /**
   * Remove a job
   */
  removeJob(jobId) {
    const jobData = this.jobs.get(jobId);
    if (jobData && jobData.timeoutId) {
      clearTimeout(jobData.timeoutId);
    }
    this.jobs.delete(jobId);
    console.log(`[Scheduler] Removed job ${jobId}`);
  }

  /**
   * Get scheduler metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeJobs: this.jobs.size,
      successRate: this.metrics.totalExecutions > 0 
        ? (this.metrics.successfulExecutions / this.metrics.totalExecutions * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Singleton instance
const scheduler = new Scheduler();

module.exports = scheduler;