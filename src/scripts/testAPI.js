const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Testing Job Scheduler API\n');

  try {
    console.log('1. Health Check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✓', health.data);
    console.log('');

    console.log('2. Creating a job...');
    const createResponse = await axios.post(`${BASE_URL}/jobs`, {
      schedule: '0 * * * * *',
      api: 'https://httpbin.org/post',
      type: 'ATLEAST_ONCE'
    });
    const jobId = createResponse.data.jobId;
    console.log('✓ Job created:', jobId);
    console.log('');

    console.log('3. Getting job details...');
    const job = await axios.get(`${BASE_URL}/jobs/${jobId}`);
    console.log('✓ Job details:', job.data);
    console.log('');

    console.log('4. Waiting 65 seconds for job execution...');
    await new Promise(resolve => setTimeout(resolve, 65000));

    console.log('5. Getting job executions...');
    const executions = await axios.get(`${BASE_URL}/jobs/${jobId}/executions`);
    console.log('✓ Executions:', JSON.stringify(executions.data, null, 2));
    console.log('');

    console.log('6. Getting metrics...');
    const metrics = await axios.get(`${BASE_URL}/metrics`);
    console.log('✓ Metrics:', JSON.stringify(metrics.data, null, 2));
    console.log('');

    console.log('7. Updating job...');
    const updateResponse = await axios.put(`${BASE_URL}/jobs/${jobId}`, {
      schedule: '30 * * * * *'
    });
    console.log('✓ Job updated:', updateResponse.data);
    console.log('');

    console.log('8. Listing all jobs...');
    const allJobs = await axios.get(`${BASE_URL}/jobs`);
    console.log('✓ Total jobs:', allJobs.data.count);
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testAPI();

