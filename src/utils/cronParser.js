/**
 * CRON Parser
 * Parses CRON-like schedule strings with seconds support
 * Format: "second minute hour day month dayOfWeek"
 * Example: "31 10-15 1 * * MON-FRI"
 */

class CronParser {
  /**
   * Parse a CRON expression
   * @param {string} cronExpression - CRON string like "31 10-15 1 * * MON-FRI"
   * @returns {object} Parsed schedule object
   */
  static parse(cronExpression) {
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 6) {
      throw new Error('Invalid CRON expression. Expected format: "second minute hour day month dayOfWeek"');
    }

    return {
      second: this.parseField(parts[0], 0, 59),
      minute: this.parseField(parts[1], 0, 59),
      hour: this.parseField(parts[2], 0, 23),
      day: this.parseField(parts[3], 1, 31),
      month: this.parseField(parts[4], 1, 12),
      dayOfWeek: this.parseDayOfWeek(parts[5])
    };
  }

  /**
   * Parse a numeric field (second, minute, hour, day, month)
   */
  static parseField(field, min, max) {
    if (field === '*') {
      return { type: 'all', values: null };
    }

    // Handle ranges (e.g., "10-15")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      if (start < min || end > max || start > end) {
        throw new Error(`Invalid range in field: ${field}`);
      }
      return { type: 'range', values: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
    }

    // Handle lists (e.g., "1,3,5")
    if (field.includes(',')) {
      const values = field.split(',').map(Number);
      if (values.some(v => v < min || v > max)) {
        throw new Error(`Invalid value in list: ${field}`);
      }
      return { type: 'list', values };
    }

    // Handle single value
    const value = Number(field);
    if (value < min || value > max) {
      throw new Error(`Invalid value: ${field}`);
    }
    return { type: 'single', values: [value] };
  }

  /**
   * Parse day of week field (MON, TUE, etc. or 0-6)
   */
  static parseDayOfWeek(field) {
    const dayMap = {
      'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
    };

    if (field === '*') {
      return { type: 'all', values: null };
    }

    // Handle ranges like "MON-FRI"
    if (field.includes('-')) {
      const [start, end] = field.split('-');
      const startNum = dayMap[start.toUpperCase()];
      const endNum = dayMap[end.toUpperCase()];
      
      if (startNum === undefined || endNum === undefined) {
        throw new Error(`Invalid day range: ${field}`);
      }

      const values = [];
      let current = startNum;
      while (true) {
        values.push(current);
        if (current === endNum) break;
        current = (current + 1) % 7;
      }
      return { type: 'range', values };
    }

    // Handle lists
    if (field.includes(',')) {
      const values = field.split(',').map(day => {
        const upper = day.toUpperCase();
        return dayMap[upper] !== undefined ? dayMap[upper] : Number(day);
      });
      return { type: 'list', values };
    }

    // Single value
    const upper = field.toUpperCase();
    const value = dayMap[upper] !== undefined ? dayMap[upper] : Number(field);
    if (value < 0 || value > 6) {
      throw new Error(`Invalid day of week: ${field}`);
    }
    return { type: 'single', values: [value] };
  }

  /**
   * Calculate the next execution time from a given date
   * @param {Date} fromDate - Starting date
   * @param {object} schedule - Parsed schedule object
   * @returns {Date} Next execution time
   */
  static getNextExecution(fromDate, schedule) {
    let next = new Date(fromDate);
    next.setMilliseconds(0);

    // Start checking from the next second
    next.setSeconds(next.getSeconds() + 1);

    // Try up to 1 year in the future (safety limit)
    const maxAttempts = 365 * 24 * 60 * 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Check if this time matches the schedule
      if (this.matchesSchedule(next, schedule)) {
        return next;
      }

      // Move to next second
      next.setSeconds(next.getSeconds() + 1);
      attempts++;
    }

    throw new Error('Could not find next execution time within reasonable range');
  }

  /**
   * Check if a date matches the schedule
   */
  static matchesSchedule(date, schedule) {
    const second = date.getSeconds();
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfWeek = date.getDay();

    return (
      this.fieldMatches(second, schedule.second) &&
      this.fieldMatches(minute, schedule.minute) &&
      this.fieldMatches(hour, schedule.hour) &&
      this.fieldMatches(day, schedule.day) &&
      this.fieldMatches(month, schedule.month) &&
      this.fieldMatches(dayOfWeek, schedule.dayOfWeek)
    );
  }

  /**
   * Check if a value matches a field specification
   */
  static fieldMatches(value, field) {
    if (field.type === 'all') {
      return true;
    }
    return field.values.includes(value);
  }
}

module.exports = CronParser;

