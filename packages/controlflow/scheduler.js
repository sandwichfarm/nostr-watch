const schedule = require('node-schedule');

export class Scheduler {
  constructor(workers) {
      this.workers = workers;
      this.analysis = {};
      this.schedules = {};
      this.analyzeAndCacheWorkers();
      this.createSchedules();
  }

  analyzeAndCacheWorkers() {
    this.workers.sort((a, b) => a.frequency - b.frequency);
    const totalFrequency = this.workers.reduce((sum, worker) => sum + worker.frequency, 0);
    let cumulativeOffset = 0;
    this.workers.forEach(worker => {
        this.jobCache[worker.worker] = {
          frequency: worker.frequency,
          offset: this.calculateBestOffset(worker, cumulativeOffset, totalFrequency)
        };
        cumulativeOffset += this.jobCache[worker.worker].offset;
    });
  }

  calculateBestOffset(worker, currentOffset, totalFrequency) {
    // Calculate an ideal gap between tasks
    const idealGap = totalFrequency / this.workers.length;
    // Start by proposing an offset that spaces out the tasks evenly
    let proposedOffset = currentOffset + idealGap;
    // Adjust the proposed offset to avoid as much overlap as possible
    // This loop tries to find a spot where the current task is least likely to collide with others
    while (this.isCollision(proposedOffset, worker.frequency, totalFrequency)) {
      proposedOffset = (proposedOffset + worker.frequency) % totalFrequency;
    }
    return proposedOffset % totalFrequency;
  }

  isCollision(proposedOffset, frequency, totalFrequency) {
    // Check if the proposed offset collides with other tasks
    for (let otherWorkerName in this.jobCache) {
      const otherWorker = this.jobCache[otherWorkerName];
      if (this.doIntervalsOverlap(proposedOffset, frequency, otherWorker.offset, otherWorker.frequency, totalFrequency)) {
          return true;
      }
    }
    return false;
  }

  doIntervalsOverlap(start1, length1, start2, length2, totalLength) {
      // Simplified check for overlap between two intervals on a circular timeline
      const end1 = (start1 + length1) % totalLength;
      const end2 = (start2 + length2) % totalLength;
      if (start1 <= end1) {
          // Case 1: Interval 1 does not wrap around
          return (start2 < end1 && end2 > start1);
      } else {
          // Case 2: Interval 1 wraps around
          return (start2 < end1 || end2 > start1);
      }
  }


  createSchedules() {
    Object.keys(this.analysis).forEach(name => {
      const worker = this.analysis[name];
      // Calculate the initial start time based on the current time and the offset
      const startTime = new Date(Date.now() + worker.offset);
      // Define the rule for scheduling
      const rule = new schedule.RecurrenceRule();
      rule.start = startTime; // Set the start time
      rule.rule = `*/${Math.round(worker.frequency / 1000)} * * * * *`; // Set the frequency in seconds
      // Schedule the job
      this.schedules[name] = schedule.scheduleJob(rule, this.workers[name].handler);
    });
  }

  getAll() {
    return this.schedules;
  }

  get(name) {
    return this.schedules[name];
  }

  gracefulShutdown() {
    Object.values(this.schedules).forEach(job => {
      schedule.gracefulShutdown(job);
    });
  }
}
