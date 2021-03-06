const period = require('../models/period');
const student = require('../models/student');
const classwork = require('../models/classwork');
const grade = require('../models/grade');

// TODO: automate hostname for prod/dev
const rootUrl = 'http://localhost:3001/api/v1/students';
// regex for studentId param format
const reStudentId = /^\d{6}$/;

const sanitizeQuery = (request, name) => {
  const re = {
    runId: /^[0-6]$/,
    runDate: /^\d{1,2}[-/]\d{1,2}[-/]20\d{2}$/,
    alertsScore: /^\d{1,2}$/
  };

  if (re[name]) {
    return re[name].test(request.query[name]) ? request.query[name] : undefined;
  }

  return undefined;
};

const studentController = {
  /**
   * Get all student records.
   */
  getAll: (req, res) => {
    const students = student.getAllStudentRecords();

    try {
      const records = Object.keys(students).reduce((acc, id) => {
        const studentRecord = students[id];
        const periodKey = studentRecord.gradingPeriodKey;
        const gradingPeriod = period.getGradingPeriodIndex({ key: periodKey });

        acc.push({
          id: +id,
          name: students[id].name,
          grade: studentRecord.grade,
          gradingPeriod,
          school: studentRecord.building,
          studentUrl: `${rootUrl}/${id}`
        });

        return acc;
      }, []);

      res.status(200).json(records);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  },

  /**
   * Get student record.
   *
   * @param {number}  studentId   The school-provided student identifier.
   */
  getStudent: (req, res) => {
    const { studentId } = req.params;
    const studentRecord = student.getStudentRecord(studentId);
    const periodKey = studentRecord.gradingPeriodKey;
    const gradingPeriod = period.getGradingPeriodIndex({ key: periodKey });

    if (reStudentId.test(studentId)) {
      res.status(200).json({
        id: +studentId,
        name: studentRecord.name,
        grade: studentRecord.grade,
        gradingPeriod,
        building: studentRecord.building,
        homeroom: studentRecord.homeroom,
        courses: studentRecord.courses,
        classworkUrl: `${rootUrl}/${studentId}/classwork`,
        gradesUrl: `${rootUrl}/${studentId}/grades`,
        gradesAverageUrl: `${rootUrl}/${studentId}/grades/average`
      });
    } else {
      res.status(400).send('Bad Request');
    }
  },

  /**
   * Get student classwork.
   *
   * @param {number}  studentId     The school-provided student identifier.
   * @param {Number}  [query.runId]    Get records for this Grading Period
   * @param {String}  [query.runDate]  Get records for this date within Grading Period
   * @param {Boolean} [query.all]      Get all records
   */
  getClasswork: (req, res) => {
    const { studentId } = req.params;

    if (reStudentId.test(studentId)) {
      const studentRecord = student.getStudentRecord(studentId);
      const gradingPeriod = {
        key: studentRecord.gradingPeriodKey,
        id: sanitizeQuery(req, 'runId'),
        date: sanitizeQuery(req, 'runDate'),
        isAll: req.query.all !== undefined
      };

      // Get classwork for most recent period, or specific run if provided
      res.status(200).json({
        studentId: +studentId,
        studentName: studentRecord === undefined ? '' : studentRecord.name,
        interval: period.getGradingPeriodInterval(gradingPeriod),
        course: classwork.getGradingPeriodRecords(studentId, gradingPeriod)
      });
    } else {
      res.status(400).send('Bad Request');
    }
  },

  /**
   * Get student grades for specific Grading Period.
   *
   * @param {number}  studentId     The school-provided student identifier.
   * @param {Number}  [query.runId]    Get records for this Grading Period
   * @param {String}  [query.runDate]  Get records for this date within Grading Period
   * @param {Boolean} [query.all]      Get all records
   */
  getGrades: (req, res) => {
    const { studentId } = req.params;

    if (reStudentId.test(studentId)) {
      const studentRecord = student.getStudentRecord(studentId);
      const gradingPeriod = {
        key: studentRecord.gradingPeriodKey,
        id: sanitizeQuery(req, 'runId'),
        date: sanitizeQuery(req, 'runDate'),
        isAll: req.query.all !== undefined
      };

      // Build up query string for HATEOS link.
      let query = '';
      const queries = Object.entries(req.query);
      if (queries.length) {
        query = `?${queries.join('&').replace(',', '=')}`;
      }

      res.status(200).json({
        studentId: +studentId,
        studentName: studentRecord === undefined ? '' : studentRecord.name,
        courseGrades: grade.getGrades(studentId, gradingPeriod),
        gradesAverageUrl: `${rootUrl}/${studentId}/grades/average${query}`
      });
    } else {
      res.status(400).send('Bad Request');
    }
  },

  /**
   * Get student daily grade average for specific Grading Period.
   *
   * @param {number}  studentId     The school-provided student identifier.
   * @param {Number}  [query.runId]    Get records for this Grading Period
   * @param {String}  [query.runDate]  Get records for this date within Grading Period
   * @param {Boolean} [query.all]      Get all records
   * @param {Boolean} [query.alerts]   Get comment alerts
   * @param {Number}  [query.alertsScore] Get alerts for grades below lower limit
   */
  getGradeAverages: (req, res) => {
    const { studentId } = req.params;

    if (reStudentId.test(studentId)) {
      const studentRecord = student.getStudentRecord(studentId);
      const gradingPeriod = {
        key: studentRecord.gradingPeriodKey,
        id: sanitizeQuery(req, 'runId'),
        date: sanitizeQuery(req, 'runDate'),
        isAll: req.query.all !== undefined
      };
      // Add alerts if requested
      let alerts;
      const lowerLimit = sanitizeQuery(req, 'alertsScore');
      if (req.query.alerts !== undefined || lowerLimit) {
        alerts = classwork.getClassworkAlerts(studentId, gradingPeriod, lowerLimit);
      }

      const gradeRecord = grade.getGradeAverage(studentId, gradingPeriod);
      const grades = Object.entries(gradeRecord).map(([courseId, courseData]) => {
        return {
          courseId,
          courseName: courseData.courseName,
          average: courseData.average
        };
      });

      res.status(200).json({
        studentId: +studentId,
        studentName: studentRecord === undefined ? '' : studentRecord.name,
        alerts,
        grades
      });
    } else {
      res.status(400).send('Bad Request');
    }
  }
};

module.exports = studentController;
