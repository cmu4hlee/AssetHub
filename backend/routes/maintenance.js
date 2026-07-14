const express = require('express');

const logsRouter = require('./maintenance/logs.router');
const plansRouter = require('./maintenance/plans.router');
const requestsRouter = require('./maintenance/requests.router');
const templatesRouter = require('./maintenance/templates.router');
const workordersRouter = require('./maintenance/workorders.router');
const analyticsRouter = require('./maintenance/analytics.router');
const costsRouter = require('./maintenance/costs.router');
const remindersRouter = require('./maintenance/reminders.router');
const usageRouter = require('./maintenance/usage.router');
const evaluationsRouter = require('./maintenance/evaluations.router');
const warrantyRouter = require('./maintenance/warranty.router');

const router = express.Router();

// 维护子域路由已拆分为独立 router + service
router.use('/', logsRouter);
router.use('/', plansRouter);
router.use('/', requestsRouter);
router.use('/', templatesRouter);
router.use('/', workordersRouter);
router.use('/', analyticsRouter);
router.use('/', costsRouter);
router.use('/', remindersRouter);
router.use('/', usageRouter);
router.use('/', evaluationsRouter);
router.use('/', warrantyRouter);

module.exports = router;
