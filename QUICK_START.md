# Quick Start Guide

This guide will help you get started with the Job Scheduler in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Initialize Database

```bash
npm run init-db
```

This creates the SQLite database and tables.

## Step 3: Start the Server

```bash
npm start
```

You should see:
```
✓ Database connected
✓ Scheduler started
🚀 Server running on http://localhost:3000
```

## Step 4: Create Your First Job

Open a new terminal and run:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 * * * * *",
    "api": "https://httpbin.org/post",
    "type": "ATLEAST_ONCE"
  }'
```

This creates a job that runs every minute at 0 seconds.

**Response:**
```json
{
  "jobId": "some-uuid-here",
  "status": "created",
  "message": "Job created successfully"
}
```

Save the `jobId` from the response!

## Step 5: Check Job Executions

Wait about 65 seconds (to let the job execute), then:

```bash
curl http://localhost:3000/api/jobs/YOUR_JOB_ID/executions
```

Replace `YOUR_JOB_ID` with the jobId from Step 4.

**Response:**
```json
{
  "jobId": "your-job-id",
  "executions": [
    {
      "executionId": "exec-uuid",
      "timestamp": "2025-12-28T10:15:00.000Z",
      "status": "success",
      "httpStatus": 200,
      "duration": 1234
    }
  ]
}
```

## Step 6: Check Metrics

```bash
curl http://localhost:3000/api/metrics
```

## Understanding Schedule Format

The schedule format is: `"second minute hour day month dayOfWeek"`

### Examples:

- `"0 * * * * *"` - Every minute at 0 seconds
- `"30 0 * * * *"` - Every hour at 30 seconds past the hour
- `"0 0 12 * * *"` - Every day at 12:00:00 PM
- `"31 10-15 1 * * MON-FRI"` - Every 31st second of minutes 10-15, at 1 AM, Monday-Friday

### Schedule Components:

- **Second**: 0-59 (or `*` for all)
- **Minute**: 0-59 (or `*` for all)
- **Hour**: 0-23 (or `*` for all)
- **Day**: 1-31 (or `*` for all)
- **Month**: 1-12 (or `*` for all)
- **Day of Week**: 0-6 or SUN-SAT (or `*` for all)

### Ranges and Lists:

- `"10-15"` - Range from 10 to 15
- `"1,3,5"` - List: 1, 3, or 5
- `"MON-FRI"` - Monday through Friday

## Common Operations

### Update a Job

```bash
curl -X PUT http://localhost:3000/api/jobs/YOUR_JOB_ID \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "30 * * * * *"
  }'
```

### List All Jobs

```bash
curl http://localhost:3000/api/jobs
```

### Get Job Details

```bash
curl http://localhost:3000/api/jobs/YOUR_JOB_ID
```

### Delete a Job

```bash
curl -X DELETE http://localhost:3000/api/jobs/YOUR_JOB_ID
```

## Using Sample Data

To quickly create multiple test jobs:

```bash
npm run sample-data
```

This creates 4 sample jobs with different schedules.

## Testing with the Test Script

```bash
# Make sure server is running first
npm start

# In another terminal
npm run test-api
```

## Troubleshooting

### Port Already in Use

If port 3000 is busy, set a different port:
```bash
PORT=3001 npm start
```

### Database Errors

If you see database errors, reinitialize:
```bash
rm -rf data/*.db
npm run init-db
```

### Jobs Not Executing

1. Check server logs for errors
2. Verify the schedule format is correct
3. Check that the API endpoint is reachable
4. Use `/api/metrics` to see scheduler status

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design details
- Try creating jobs with different schedules
- Monitor executions and metrics

Happy Scheduling! 🚀

