const { Router } = require('express');
const { getSiteInfo, getOffers } = require('../controllers/site.controller');

const router = Router();

router.get('/site-info', getSiteInfo);
router.get('/offers', getOffers);

module.exports = router;
