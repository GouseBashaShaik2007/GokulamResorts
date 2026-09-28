const { Router } = require('express');
const { getRooms, getRoomById } = require('../controllers/rooms.controller');

const router = Router();

router.get('/', getRooms);
router.get('/:id', getRoomById);

module.exports = router;
