const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class Execution {
  static async create(executionData) {
    const executionId = uuidv4();
    const { jobId, timestamp, status, httpStatus, duration, error } = executionData;

    await db.run(
      `INSERT INTO executions (executionId, jobId, timestamp, status, httpStatus, duration, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [executionId, jobId, timestamp.toISOString(), status, httpStatus, duration, error]
    );

    return {
      executionId,
      jobId,
      timestamp: timestamp.toISOString(),
      status,
      httpStatus,
      duration,
      error
    };
  }

  static async getLastN(jobId, limit = 5) {
    return await db.all(
      `SELECT * FROM executions 
       WHERE jobId = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [jobId, limit]
    );
  }

  static async getStats(jobId) {
    const stats = await db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
        AVG(duration) as avgDuration
       FROM executions 
       WHERE jobId = ?`,
      [jobId]
    );
    return stats;
  }

  static async getAll(limit = 100) {
    return await db.all(
      `SELECT * FROM executions 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );
  }
}

module.exports = Execution;

