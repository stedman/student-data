const period = require('../models/period');
const grades = require('../data/grades.json');

// regex for studentId param format
const reStudentId = /^\d{6}$/;

const classwork = {
  /**
   * Gets the raw student classwork record.
   *
   * @param  {number}  studentId  The student identifier
   *
   * @return {array}   The raw student classwork data.
   */
  getAllRecordsRaw: (studentId) => {
    const studentRecord = grades[studentId];

    if (!reStudentId.test(studentId) || studentRecord === undefined) {
      return {};
    }

    return studentRecord.course;
  },

  /**
   * Get a student's classwork data and refine it.
   *
   * @param  {number}  studentId  The student identifier
   *
   * @return {object}   The formatted student course data.
   */
  getAllRecords: (studentId) => {
    const rawRecord = classwork.getAllRecordsRaw(studentId);
    const recordEntries = Object.entries(rawRecord);
    const studentRecord = {};

    if (recordEntries.length === 0) {
      return studentRecord;
    }

    recordEntries.forEach(([courseId, courseData]) => {
      // If category scores have been set up, then we can track these grades.
      if (courseData.category) {
        const courseName = courseData.name;

        studentRecord[courseId] = {
          name: courseName,
          categoryTotal: courseData.categoryTotal,
          category: courseData.category
        };

        if (courseData.classwork) {
          const assignments = courseData.classwork
            .filter((work) => {
              // Don't bother with assignments that haven't been graded yet.
              return work.score !== '';
            })
            .map((work) => {
              const comment = work.score === 'M' ? `[missing work] ${work.comment}` : work.comment;

              return {
                dateDue: work.dateDue,
                dateDueMs: new Date(work.dateDue).getTime(),
                dateAssigned: work.dateAssigned,
                assignment: work.assignment,
                category: work.category,
                score: work.score,
                weightedScore: work.weightedScore,
                weightedTotalPoints: work.weightedTotalPoints,
                comment: comment.trim()
              };
            });

          studentRecord[courseId].classwork = assignments;
        }
      }
    });

    return studentRecord;
  },

  /**
   * Gets a student's classwork for specific Grading Period (report card run).
   *
   * @param  {number}  studentId      The student identifier
   * @param  {object}  gradingPeriod  The Grading Period object
   * @param  {Number}  [..key]        Grading Period key for student grade level
   * @param  {Number}  [..id]         Get records for this Grading Period
   * @param  {String}  [..date]       Get records for this date within Grading Period
   * @param  {Boolean} [..isAll]      Need all records?
   *
   * @return {object}  The student course data for period.
   */
  getGradingPeriodRecords: (studentId, gradingPeriod) => {
    const { isAll } = gradingPeriod;
    const fullRecord = classwork.getAllRecords(studentId);

    // Get ALL records.
    if (isAll) {
      return fullRecord;
    }

    const recordEntries = Object.entries(fullRecord);
    const studentRecord = {};

    if (recordEntries.length === 0) {
      return studentRecord;
    }

    const interval = period.getGradingPeriodInterval(gradingPeriod);

    recordEntries.forEach(([courseId, courseData]) => {
      const courseName = courseData.name;

      studentRecord[courseId] = {
        name: courseName,
        categoryTotal: courseData.categoryTotal,
        category: courseData.category
      };

      if (courseData.classwork) {
        const assignments = courseData.classwork.filter((work) => {
          // Use only classwork in the Grading Period range
          return (
            work.dateDueMs && work.dateDueMs >= interval.start && work.dateDueMs <= interval.end
          );
        });

        studentRecord[courseId].classwork = assignments;
      }
    });

    return studentRecord;
  },

  /**
   * Gets classwork alerts for low scores and comments for a specific Grading Period.
   *
   * @param  {number}  studentId      The student identifier
   * @param  {object}  gradingPeriod  The Grading Period object
   * @param  {Number}  [..key]        Grading Period key for student grade level
   * @param  {Number}  [..id]         Get records for this Grading Period
   * @param  {String}  [..date]       Get records for this date within Grading Period
   * @param  {Boolean} [..isAll]      Need all records?
   * @param  {Number}  lowerLimit     Optional grade threshold
   *
   * @return {array}  Assignments with comments or low scores.
   */
  getClassworkAlerts: (studentId, gradingPeriod, lowerLimit = 0) => {
    const gradingPeriodRecord = classwork.getGradingPeriodRecords(studentId, gradingPeriod);
    const recordEntries = Object.entries(gradingPeriodRecord);
    const alerts = [];

    if (recordEntries.length === 0) {
      return alerts;
    }

    recordEntries.forEach(([courseId, courseData]) => {
      const courseName = courseData.name;

      if (courseData.classwork) {
        courseData.classwork.forEach((work) => {
          const isLowerLimit = +work.score < +lowerLimit;

          if (work.comment !== '' || isLowerLimit) {
            alerts.push({
              date: work.dateDue,
              course: courseName,
              assignment: work.assignment,
              score: work.score,
              comment: isLowerLimit ? `[low score] ${work.comment}`.trim() : work.comment
            });
          }
        });
      }
    });

    return alerts;
  }
};

module.exports = classwork;
