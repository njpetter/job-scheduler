const CronParser = require('../utils/cronParser');
const Job = require('../models/Job');
const Executor = require('./executor');
const db = require('../database/db'); 

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.executor = new Executor();
    this.isRunning = false;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDelay: 0
    };
    this.db = db;
  }

  async start() {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Scheduler] Starting scheduler...');
    
    await this.loadJobs();

    console.log('[Scheduler] Scheduler started');
  }

  stop() {
    this.isRunning = false;
    for (const [jobId, jobData] of this.jobs.entries()) {
      if (jobData.timeoutId) {
        clearTimeout(jobData.timeoutId);
      }
    }
    this.jobs.clear();
    console.log('[Scheduler] Scheduler stopped');
  }

  async loadJobs() {
    const activeJobs = await Job.getAllActive();
    
    for (const job of activeJobs) {
      await this.scheduleJob(job);
    }
    
    console.log(`[Scheduler] Loaded ${activeJobs.length} active jobs`);
  }

  async scheduleJob(job) {
    try {
      const schedule = CronParser.parse(job.schedule);
      const now = new Date();
      const nextExecution = CronParser.getNextExecution(now, schedule);

      if (this.jobs.has(job.jobId)) {
        const existing = this.jobs.get(job.jobId);
        if (existing.timeoutId) {
          clearTimeout(existing.timeoutId);
        }
      }

      let delay = nextExecution.getTime() - now.getTime();

      if (delay < 0) {
        const newNext = CronParser.getNextExecution(new Date(now.getTime() + 1000), schedule);
        delay = newNext.getTime() - now.getTime();
        this.scheduleExecution(job, newNext, delay);
      } else {
        this.scheduleExecution(job, nextExecution, delay);
      }

      this.jobs.set(job.jobId, {
        job,
        schedule,
        nextExecution,
        timeoutId: null
      });

      console.log(`[Scheduler] Scheduled job ${job.jobId} - Next execution: ${nextExecution.toISOString()}`);
    } catch (error) {
      console.error(`[Scheduler] Error scheduling job ${job.jobId}:`, error.message);
    }
  }

  scheduleExecution(job, executionTime, delay) {
    const MAX_DELAY = 2147483647;
    if (delay > MAX_DELAY) {
        delay = MAX_DELAY;
    }

    const timeoutId = setTimeout(async () => {
      await this.executeJob(job);
      await this.rescheduleJob(job.jobId);
    }, delay);

    if (this.jobs.has(job.jobId)) {
        const jobData = this.jobs.get(job.jobId);
        jobData.timeoutId = timeoutId;
        jobData.nextExecution = executionTime;
    }
  }

  async executeJob(job) {
    const jobData = this.jobs.get(job.jobId);
    const scheduledTime = jobData ? jobData.nextExecution : new Date();
    const actualTime = new Date();
    const drift = actualTime.getTime() - scheduledTime.getTime();

    this.metrics.totalExecutions++;
    if (drift > 0) {
      this.metrics.averageDelay = 
        (this.metrics.averageDelay * (this.metrics.totalExecutions - 1) + drift) / 
        this.metrics.totalExecutions;
    }

    console.log(`[Scheduler] Executing job ${job.jobId} (drift: ${drift}ms)`);

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

  async addJob(job) {
    await this.scheduleJob(job);
  }

  async updateJob(jobId, updates) {
    const existingJobData = this.jobs.get(jobId);
    if (!existingJobData) {
        throw new Error('Job not found in active scheduler');
    }

    if (existingJobData.timeoutId) {
        clearTimeout(existingJobData.timeoutId);
    }

    await this.db.run(
        `UPDATE jobs SET schedule = ?, api = ?, type = ?, status = 'active' WHERE jobId = ?`,
        [updates.schedule, updates.api, updates.type, jobId]
    );

    const updatedJob = {
        ...existingJobData.job,
        schedule: updates.schedule,
        api: updates.api,
        type: updates.type,
        status: 'active'
    };

    await this.scheduleJob(updatedJob);
    
    console.log(`[Scheduler] updatedJob: Successfully updated ${jobId}`);
    return updatedJob;
  }

  removeJob(jobId) {
    const jobData = this.jobs.get(jobId);
    if (jobData && jobData.timeoutId) {
      clearTimeout(jobData.timeoutId);
    }
    this.jobs.delete(jobId);
    console.log(`[Scheduler] Removed job ${jobId}`);
  }

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

const scheduler = new Scheduler();

module.exports = scheduler;