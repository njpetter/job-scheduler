const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function stressTest() {
    console.log('🔥 Starting STRESS TEST: Creating 500 jobs...');
    
    const startTime = Date.now();
    const requests = [];

    // Create 500 jobs safely using "List Syntax"
    // This runs at second 0 and second 30 of every minute
    const safeSchedule = "0,30 * * * * *"; 

    for (let i = 0; i < 500; i++) {
        const payload = {
            schedule: safeSchedule,
            api: 'https://httpbin.org/post',
            type: 'ATLEAST_ONCE'
        };
        // Fire request immediately
        requests.push(axios.post(`${BASE_URL}/jobs`, payload));
    }

    try {
        // Wait for all 500 creations to finish
        await Promise.all(requests.map(p => p.catch(e => e))); 
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n✅ Finished sending 500 requests in ${duration.toFixed(2)}s`);
        
        // Verification Check
        const metrics = await axios.get(`${BASE_URL}/metrics`);
        console.log(`\n📊 Dashboard Status: ${metrics.data.scheduler.activeJobs} Active Jobs`);

    } catch (error) {
        console.error('Stress test failed:', error.message);
    }
}

stressTest();