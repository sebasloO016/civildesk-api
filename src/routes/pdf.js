const router  = require('express').Router();
const ctrl    = require('../controllers/pdfController');
const { authenticate } = require('../middlewares/auth');

// PDF routes support token via query param (browser window.open can't send headers)
const authenticatePdf = (req, res, next) => {
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
};

router.use(authenticatePdf);

router.get('/proformas/:id',           ctrl.proformaPdf);
router.get('/contracts/:projectId',    ctrl.contractPdf);
router.get('/liquidations/:projectId', ctrl.liquidationPdf);
router.get('/certificates/:id',        ctrl.certificatePdf);
router.get('/purchase-orders/:id',     ctrl.purchaseOrderPdf);

module.exports = router;
