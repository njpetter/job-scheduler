/**
 * Job Model
 * Handles database operations for jobs
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class Job {
  /**
   * Create a new job
   */
  static async create(jobSpec) {
    const jobId = uuidv4();
    const { schedule, api, type } = jobSpec;

    await db.run(
      `INSERT INTO jobs (jobId, schedule, api, type, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [jobId, schedule, api, type]
    );

    return { jobId, schedule, api, type, status: 'active' };
  }

  /**
   * Get a job by ID
   */
  static async getById(jobId) {
    return await db.get('SELECT * FROM jobs WHERE jobId = ?', [jobId]);
  }

  /**
   * Update a job
   * Only updates fields that are present in the updates object
   */
  static async update(jobId, updates) {
    // Build dynamic SQL based on which fields are present
    const allowedFields = ['schedule', 'api', 'type'];
    const fieldsToUpdate = [];
    const values = [];

    // Only include fields that are actually present in updates
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fieldsToUpdate.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    // If no fields to update, return the current job
    if (fieldsToUpdate.length === 0) {
      return await this.getById(jobId);
    }

    // Always update the updatedAt timestamp
    fieldsToUpdate.push('updatedAt = CURRENT_TIMESTAMP');
    
    // Add jobId for WHERE clause
    values.push(jobId);

    // Build and execute the dynamic SQL query
    const sql = `UPDATE jobs SET ${fieldsToUpdate.join(', ')} WHERE jobId = ?`;
    
    await db.run(sql, values);

    return await this.getById(jobId);
  }

  /**
   * Get all active jobs
   */
  static async getAllActive() {
    return await db.all('SELECT * FROM jobs WHERE status = ?', ['active']);
  }

  /**
   * Get all jobs
   */
  static async getAll() {
    return await db.all('SELECT * FROM jobs ORDER BY createdAt DESC');
  }

  /**
   * Delete a job (soft delete by setting status to 'deleted')
   */
  static async delete(jobId) {
    await db.run(
      `UPDATE jobs SET status = 'deleted', updatedAt = CURRENT_TIMESTAMP WHERE jobId = ?`,
      [jobId]
    );
  }
}

module.exports = Job;

