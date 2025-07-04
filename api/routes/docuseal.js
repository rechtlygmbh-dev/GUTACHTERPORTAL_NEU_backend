const express = require('express');
const router = express.Router();
const { handleDocusealWebhook } = require('../controllers/docusealController');

router.post('/webhook', handleDocusealWebhook);

module.exports = router; 