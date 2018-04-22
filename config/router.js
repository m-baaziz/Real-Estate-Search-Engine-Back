import express from 'express';
import HousingController from '../controllers/HousingController';

const router = express.Router();

router.route('/housing')
	.get(HousingController.index);
router.route('/housing/scroll')
	.get(HousingController.scroll);
router.route('/housing/:id')
	.get(HousingController.get);

export default router;