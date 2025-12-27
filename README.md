# High-Throughput Job Scheduler

A scalable job scheduler system capable of executing thousands of scheduled jobs per second with high accuracy and reliability.

## 📋 Table of Contents

- [Overview](#overview)
- [System Design](#system-design)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Data Flow](#data-flow)
- [Assumptions](#assumptions)

## 🎯 Overview

This job scheduler allows you to:
- Create jobs with CRON-like schedules
- Modify existing jobs
- View execution history for any job
- Get alerts on job failures
- Handle thousands of concurrent job executions

## 🏗️ System Design

### Core Components

1. **API Layer**: REST endpoints for job management
2. **Scheduler Engine**: Calculates next execution times and queues jobs
3. **Executor Pool**: Executes HTTP POST requests with retry logic
4. **Storage Layer**: Persists jobs and execution history
5. **Observability**: Logging and metrics collection

### Technology Stack

- **Runtime**: Node.js
- **Database**: SQLite (for simplicity, easily replaceable with PostgreSQL/MySQL)
- **HTTP Client**: Axios
- **Scheduling**: Custom scheduler with priority queue

## 🏛️ Architecture

### Architecture Diagram
![System Architecture Diagram](./architecture.png)

### Component Details

#### 1. API Layer (`src/routes/`)
- **Job Routes**: CRUD operations for jobs
- **Observability Routes**: Metrics, health checks, debugging endpoints
- Handles request validation and error handling

#### 2. Scheduler Service (`src/services/scheduler.js`)
- **CRON Parser**: Parses schedule strings with second-level precision
- **Next Execution Calculator**: Determines when each job should run next
- **Execution Loop**: Checks every 100ms for jobs ready to execute
- **Job Management**: Add, update, remove jobs dynamically

#### 3. Executor Service (`src/services/executor.js`)
- **HTTP Execution**: Makes POST requests to job APIs
- **Retry Logic**: Implements at-least-once semantics with exponential backoff
- **Failure Handling**: Logs errors and triggers alerts
- **Async Execution**: Non-blocking execution to handle thousands of jobs

#### 4. Data Models (`src/models/`)
- **Job Model**: Database operations for jobs
- **Execution Model**: Stores execution history and statistics

#### 5. Database (`src/database/`)
- **SQLite**: Lightweight database for job and execution storage
- **Schema**: Normalized tables with foreign key relationships
- **Indexes**: Optimized queries for execution history

### Scalability Design

1. **High-Throughput Execution**:
   - Non-blocking async execution
   - Execution loop with 100ms precision
   - Minimal schedule drift through precise timing

2. **Database Optimization**:
   - Indexed queries for fast execution lookups
   - Efficient job loading on startup
   - Batch operations where possible

3. **Fault Tolerance**:
   - Retry logic for failed HTTP requests
   - Graceful error handling
   - Job state persistence

4. **Observability**:
   - Comprehensive logging
   - Real-time metrics
   - Execution history tracking

## 🚀 Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Clear
```

2. Install dependencies:
```bash
npm install
```

3. Initialize the database:
```bash
npm run init-db
```

4. Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📡 API Documentation

### 1. Create Job

**Endpoint**: `POST /api/jobs`

**Request Body**:
```json
{
  "schedule": "31 10-15 1 * * MON-FRI",
  "api": "https://localhost:4444/foo",
  "type": "ATLEAST_ONCE"
}
```

**Response**:
```json
{
  "jobId": "uuid-here",
  "status": "created"
}
```

### 2. Get Job Executions

**Endpoint**: `GET /api/jobs/:jobId/executions`

**Response**:
```json
{
  "jobId": "uuid-here",
  "executions": [
    {
      "executionId": "exec-uuid",
      "timestamp": "2025-12-28T10:15:31.000Z",
      "status": "success",
      "httpStatus": 200,
      "duration": 1234
    }
  ]
}
```

### 3. Update Job

**Endpoint**: `PUT /api/jobs/:jobId`

**Request Body**:
```json
{
  "schedule": "45 10-15 1 * * MON-FRI",
  "api": "https://localhost:4444/bar",
  "type": "ATLEAST_ONCE"
}
```

### 4. Observability Endpoints

- `GET /api/metrics` - System metrics
- `GET /api/health` - Health check
- `GET /api/jobs` - List all jobs

## 🔄 Data Flow

1. **Job Creation**: Client → API → Database → Scheduler
2. **Job Execution**: Scheduler → Executor Pool → HTTP POST → Database (log result)
3. **Query Executions**: Client → API → Database → Response

## 📝 Assumptions

- SQLite is used for simplicity (production would use PostgreSQL/MySQL)
- Jobs are executed in-process (production would use worker processes/containers)
- Alert system logs to console (production would use email/Slack/webhooks)
- Schedule supports seconds-level granularity
- At-least-once semantics means retries on failure

## 🐳 Docker Support

### Using Docker Compose (Recommended)

```bash
docker-compose up --build
```

### Using Docker directly

```bash
docker build -t job-scheduler .
docker run -p 3000:3000 job-scheduler
```

## 📊 Sample Data

To create sample jobs for testing:

```bash
npm run sample-data
```

This will create 4 sample jobs with different schedules.

## 🧪 Testing

### Test the API

1. Start the server:
```bash
npm start
```

2. In another terminal, run the test script:
```bash
npm run test-api
```

### Manual Testing with cURL

#### Create a job:
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 * * * * *",
    "api": "https://httpbin.org/post",
    "type": "ATLEAST_ONCE"
  }'
```

#### Get job executions:
```bash
curl http://localhost:3000/api/jobs/{jobId}/executions
```

#### Get metrics:
```bash
curl http://localhost:3000/api/metrics
```

## 📈 Performance Considerations

- **Schedule Precision**: 100ms check interval ensures minimal drift
- **Concurrent Execution**: Jobs execute asynchronously, allowing thousands per second
- **Database**: SQLite is suitable for development; production should use PostgreSQL/MySQL
- **Memory**: Jobs are kept in memory for fast access; database is used for persistence

## 🔒 Trade-offs & Limitations

### Current Implementation:
- **Single Process**: All jobs run in one Node.js process
- **SQLite**: Simple but not ideal for high-concurrency production
- **In-Memory Scheduler**: Fast but lost on restart (jobs reloaded from DB)
- **Console Alerts**: Simple logging; production needs email/Slack/webhooks

### Production Recommendations:
- Use PostgreSQL/MySQL for better concurrency
- Implement worker processes/containers for job execution
- Add distributed locking for multi-instance deployments
- Integrate proper alerting (email, Slack, PagerDuty)
- Add rate limiting and authentication
- Implement job prioritization and queues

