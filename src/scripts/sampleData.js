const db = require('../database/db');
const Job = require('../models/Job');
const scheduler = require('../services/scheduler');

async function createSampleData() {
  try {
    await db.connect();
    console.log('Connected to database');

    const sampleJobs = [
      {
        schedule: '0 * * * * *',
        api: 'https://httpbin.org/post',
        type: 'ATLEAST_ONCE'
      },
      {
        schedule: '30 0 * * * *',
        api: 'https://httpbin.org/post',
        type: 'ATLEAST_ONCE'
      },
      {
        schedule: '0 0 12 * * *',
        api: 'https://httpbin.org/post',
        type: 'ATLEAST_ONCE'
      },
      {
        schedule: '31 10-15 1 * * MON-FRI',
        api: 'https://httpbin.org/post',
        type: 'ATLEAST_ONCE'
      }
    ];

    console.log('Creating sample jobs...');
    for (const jobSpec of sampleJobs) {
      const job = await Job.create(jobSpec);
      console.log(`Created job: ${job.jobId}`);
      console.log(`  Schedule: ${job.schedule}`);
      console.log(`  API: ${job.api}\n`);
    }

    console.log(`✓ Created ${sampleJobs.length} sample jobs`);
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample data:', error);
    process.exit(1);
  }
}

createSampleData();

