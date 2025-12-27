/**
 * Job Scheduler
 * Manages job scheduling and execution timing
 */

const CronParser = require('../utils/cronParser');
const Job = require('../models/Job');
const Executor = require('./executor');

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
   * Schedule a job
   */
  async scheduleJob(job) {
    try {
      const schedule = CronParser.parse(job.schedule);
      const now = new Date();
      const nextExecution = CronParser.getNextExecution(now, schedule);

      // Cancel existing schedule if job already exists
      if (this.jobs.has(job.jobId)) {
        const existing = this.jobs.get(job.jobId);
        if (existing.timeoutId) {
          clearTimeout(existing.timeoutId);
        }
      }

      // Calculate delay until next execution
      const delay = nextExecution.getTime() - now.getTime();

      // If delay is somehow negative (execution time passed while processing), 
      // look for the NEXT execution time to avoid infinite immediate loops.
      if (delay < 0) {
        const newNext = CronParser.getNextExecution(new Date(now.getTime() + 1000), schedule);
        const newDelay = newNext.getTime() - now.getTime();
        this.scheduleExecution(job, newNext, newDelay);
      } else {
        this.scheduleExecution(job, nextExecution, delay);
      }

      // We only store the basic info. The timeout callback handles the rest.
      // We don't need to store 'timeoutId' in the map IF we don't plan to cancel individually,
      // but it's good practice to keep it for the stop() function.
      this.jobs.set(job.jobId, {
        job,
        schedule,
        nextExecution,
        timeoutId: null // Will be updated inside scheduleExecution
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
    // Safety check: 32-bit integer limit for setTimeout is ~24.8 days.
    // If delay is larger, we should set a max delay and re-check later.
    const MAX_DELAY = 2147483647;
    if (delay > MAX_DELAY) {
        delay = MAX_DELAY;
    }

    const timeoutId = setTimeout(async () => {
      // Execute the job
      await this.executeJob(job);
      
      // Once done, calculate the NEXT run and reschedule
      await this.rescheduleJob(job.jobId);
    }, delay);

    // Update the map with the new timeout ID so we can cancel it if needed
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

    // Execute job asynchronously.
    // We do NOT await this.executor.execute() because we don't want to delay
    // the rescheduling of the next run.
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
      // Calculate next run based on NOW, ensuring we don't schedule in the past
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
   * Update an existing job
   */
  async updateJob(job) {
    await this.scheduleJob(job);
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