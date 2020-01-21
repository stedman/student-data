const classworkData = require('../data/classwork.json');
const intervalData = require('../data/intervals.json');
const course = require('./course');

const grade = {
  /**
   * Gets the raw student classwork data.
   *
   * @param  {number}  studentId  The student identifier
   * @return {object}  The raw student classwork data.
   */
  getStudentClassworkData: (studentId) => {
    return classworkData[studentId] ? classworkData[studentId].classwork : {};
  },

  /**
   * Gets the student classwork data.
   *
   * @param  {number}  studentId  The student identifier
   * @return {object}  The student classwork with enhancements.
   */
  getStudentClasswork: (studentId) => {
    const allStudentClasswork = grade.getStudentClassworkData(studentId);

    const stuff = allStudentClasswork.map((work) => {
      const newWork = work;

      newWork.dateDueMs = new Date(work.dateDue).getTime();
      newWork.courseId = work.course.substring(0, 9).trim();

      // Get matching course using first 9 chars of classwork course info.
      newWork.catWeight = course.getCourse(newWork.courseId).category[work.category];

      return newWork;
    });

    return stuff;
  },

  /**
   * Gets a student's classwork for specific Marking Period (report card run).
   *
   * @param  {number}  studentId                        The student identifier
   * @param  {number}  [runId=grade.getRunIdForDate()]  The run identifier
   * @return {object}  The student classwork data object for period.
   */
  getStudentClassworkPeriod: (studentId, runId = grade.getRunIdForDate()) => {
    const runDateInMs = grade.getRunDateInMs(runId);

    return grade.getStudentClasswork(studentId).filter((work) => {
      // Use only classwork in the Marking Period range
      return work.dateDueMs > runDateInMs.start && work.dateDueMs < runDateInMs.end;
    });
  },

  /**
   * Gets grades for classwork grouped into course and category.
   *
   * @param  {number}  studentId                        The student identifier
   * @param  {number}  [runId=grade.getRunIdForDate()]  The run identifier
   * @return {object}  The student classwork grades data.
   */
  getStudentClassworkGrades: (studentId, runId = grade.getRunIdForDate()) => {
    const classwork = {};

    grade.getStudentClassworkPeriod(studentId, runId).forEach((work) => {
      if (work.score !== '') {
        classwork[work.courseId] = classwork[work.courseId] || {};
        classwork[work.courseId][work.category] = classwork[work.courseId][work.category] || [];
        classwork[work.courseId][work.category].push(Number(work.score));
      }
    });

    return classwork;
  },

  /**
   * Gets weighted grades for classwork grouped into course and category.
   *
   * @param  {number}  studentId                        The student identifier
   * @param  {number}  [runId=grade.getRunIdForDate()]  The run identifier
   * @return {object}  The student classwork grades data weighted.
   */
  getStudentClassworkGradesWeighted: (studentId, runId = grade.getRunIdForDate()) => {
    const classwork = {};

    grade.getStudentClassworkPeriod(studentId, runId).forEach((work) => {
      if (work.score !== '') {
        classwork[work.courseId] = classwork[work.courseId] || {};
        classwork[work.courseId][work.category] = classwork[work.courseId][work.category] || [];
        classwork[work.courseId][work.category].push(Number(work.score) * work.catWeight);
      }
    });

    return classwork;
  },

  /**
   * Gets the grade average for classwork in the Marked Period.
   *
   * @param  {number}  studentId                        The student identifier
   * @param  {number}  [runId=grade.getRunIdForDate()]  The run identifier
   * @return {object}  The student classwork grades average grade data.
   */
  getStudentClassworkGradesAverage: (studentId, runId = grade.getRunIdForDate()) => {
    const classwork = grade.getStudentClassworkGradesWeighted(studentId, runId);
    const courseAverageGrade = {};

    Object.keys(classwork).map((cId) => {
      const courseClasswork = classwork[cId];

      // Get all possible course categories.
      // As we loop thru the results, remove active categories.
      // Subtract the weights of the inactive categories from 1.
      // Then divide the course totals by this weight adjustment.
      const courseData = course.getCourse(cId).category;
      const courseCatClone = { ...courseData };

      const courseTotal = Object.keys(courseClasswork).reduce((courseTotalAcc, cat) => {
        const catScores = courseClasswork[cat];
        const count = catScores.length;
        const catTotal = catScores.reduce((catTotalAcc, score) => {
          return catTotalAcc + score;
        }, 0);

        delete courseCatClone[cat];

        return courseTotalAcc + catTotal / count;
      }, 0);

      // Calculate weight adjustment as described above. Default to 1 if result is 0 (or undefined).
      const weightAdjustment =
        Object.values(courseCatClone).reduce((catTotal, catWeight) => {
          return catTotal - catWeight;
        }, 1) || 1;

      courseAverageGrade[cId] = (courseTotal / weightAdjustment).toFixed(2);

      return courseAverageGrade[cId];
    });

    return courseAverageGrade;
  },

  /**
   * Gets the run identifier for date.
   *
   * @param  {object||string}  [targetDate=new Date()]  The target date
   * @return {number}  The run identifier for date.
   */
  getRunIdForDate: (targetDate = new Date()) => {
    return intervalData.findIndex((runEnd, idx) => {
      const prevRunEnd = intervalData[idx - 1];

      if (prevRunEnd === undefined) return false;

      const start = new Date(prevRunEnd);
      const end = new Date(runEnd);
      const target = new Date(targetDate);

      return target > start && target < end;
    });
  },

  /**
   * Gets the run date in milliseconds.
   *
   * @param  {number}  [runId]  The run identifier
   * @return {object}  The run date in milliseconds.
   */
  getRunDateInMs: (runId = grade.getRunIdForDate()) => {
    const prevRunEnd = intervalData[runId - 1];

    if (prevRunEnd === undefined) return false;

    const convertToMs = (time) => new Date(time).getTime();

    return {
      start: convertToMs(prevRunEnd),
      end: convertToMs(intervalData[runId])
    };
  }
};

module.exports = grade;