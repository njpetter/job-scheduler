/**
 * Job Executor
 * Executes HTTP POST requests for jobs
 */

const axios = require('axios');
const Execution = require('../models/Execution');

class Executor {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Execute a job (make HTTP POST request)
   * @param {object} job - Job object with api, jobId, type
   * @returns {Promise<object>} Execution result
   */
  async execute(job) {
    const startTime = Date.now();
    const timestamp = new Date();
    const { jobId, api, type } = job;

    console.log(`[Executor] Executing job ${jobId} - POST ${api}`);

    try {
      // Make HTTP POST request
      const response = await this.makeRequest(api, type);
      
      const duration = Date.now() - startTime;
      const status = response.status >= 200 && response.status < 300 ? 'success' : 'failure';

      // Save execution record
      await Execution.create({
        jobId,
        timestamp,
        status,
        httpStatus: response.status,
        duration,
        error: null
      });

      // Alert on failure
      if (status === 'failure') {
        this.alertFailure(job, response.status, duration);
      }

      console.log(`[Executor] Job ${jobId} completed - Status: ${status}, Duration: ${duration}ms`);

      return {
        jobId,
        status,
        httpStatus: response.status,
        duration,
        timestamp
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Save execution record with error
      await Execution.create({
        jobId,
        timestamp,
        status: 'failure',
        httpStatus: null,
        duration,
        error: error.message
      });

      // Alert on failure
      this.alertFailure(job, null, duration, error.message);

      console.error(`[Executor] Job ${jobId} failed - Error: ${error.message}`);

      return {
        jobId,
        status: 'failure',
        httpStatus: null,
        duration,
        error: error.message,
        timestamp
      };
    }
  }

  /**
   * Make HTTP POST request with retry logic for ATLEAST_ONCE
   */
  async makeRequest(api, type) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(api, {}, {
          timeout: 30000, // 30 second timeout
          validateStatus: () => true // Don't throw on any status code
        });
        
        // If successful or type is not ATLEAST_ONCE, return immediately
        if (response.status >= 200 && response.status < 300 || type !== 'ATLEAST_ONCE') {
          return response;
        }
        
        // For ATLEAST_ONCE, retry on failure
        if (attempt < this.maxRetries) {
          console.log(`[Executor] Retry attempt ${attempt + 1}/${this.maxRetries} for ${api}`);
          await this.sleep(this.retryDelay * attempt); // Exponential backoff
        }
        
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          console.log(`[Executor] Retry attempt ${attempt + 1}/${this.maxRetries} for ${api}`);
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Alert user on job failure
   */
  alertFailure(job, httpStatus, duration, error = null) {
    const alertMessage = {
      type: 'JOB_FAILURE',
      jobId: job.jobId,
      api: job.api,
      timestamp: new Date().toISOString(),
      httpStatus,
      duration,
      error
    };

    // In production, this would send to email/Slack/webhook
    console.error('[ALERT]', JSON.stringify(alertMessage, null, 2));
    
    // TODO: Integrate with alerting service (email, Slack, etc.)
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Executor;

