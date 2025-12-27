const axios = require('axios');
const Execution = require('../models/Execution');

class Executor {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async execute(job) {
    const startTime = Date.now();
    const timestamp = new Date();
    const { jobId, api, type } = job;

    console.log(`[Executor] Executing job ${jobId} - POST ${api}`);

    try {
      const response = await this.makeRequest(api, type);
      
      const duration = Date.now() - startTime;
      const status = response.status >= 200 && response.status < 300 ? 'success' : 'failure';

      await Execution.create({
        jobId,
        timestamp,
        status,
        httpStatus: response.status,
        duration,
        error: null
      });

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
      
      await Execution.create({
        jobId,
        timestamp,
        status: 'failure',
        httpStatus: null,
        duration,
        error: error.message
      });

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

  async makeRequest(api, type) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(api, {}, {
          timeout: 30000,
          validateStatus: () => true
        });
        
        if (response.status >= 200 && response.status < 300 || type !== 'ATLEAST_ONCE') {
          return response;
        }
        
        if (attempt < this.maxRetries) {
          console.log(`[Executor] Retry attempt ${attempt + 1}/${this.maxRetries} for ${api}`);
          await this.sleep(this.retryDelay * attempt);
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

    console.error('[ALERT]', JSON.stringify(alertMessage, null, 2));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Executor;

