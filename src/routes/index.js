const router = require('express').Router();
const { finRouter, altRouter } = require('./financeAndAlerts');

router.use('/auth',       require('./auth'));
router.use('/works',      require('./works'));
router.use('/works/:workId/subcontracts',  require('./subcontracts'));
router.use('/works/:workId/schedule',      require('./schedule'));
router.use('/works/:workId/reports',       require('./dailyReports'));
router.use('/works/:workId/certificates',  require('./certificates'));
router.use('/warehouses', require('./warehouses'));
router.use('/projects',   require('./projects'));
router.use('/clients',    require('./clients'));
router.use('/suppliers',  require('./suppliers'));
router.use('/products',   require('./products'));
router.use('/purchases',  require('./purchases'));
router.use('/finance',    finRouter);
router.use('/alerts',     altRouter);
router.use('/pdf',        require('./pdf'));
router.use('/catalog',    require('./catalog'));
router.use('/config',     require('./config'));

module.exports = router;
