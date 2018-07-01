const express = require('express');
const HousingController = require('../controllers/HousingController');

const router = express.Router();

router.route('/housing')
	.get(HousingController.index);
router.route('/housing/scroll')
	.get(HousingController.scroll);
router.route('/housing/:id')
	.get(HousingController.get);

module.exports = router;
