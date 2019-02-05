const express = require('express');
const { createSampleChartUrls, createSummary } = require('../parser/boerseDeParser');

const router = express.Router();


router.get('/charts/:isin', async (req, res) => {
	const urls = await createSampleChartUrls(req.params.isin);
	res.send(urls);
});

router.get('/aktien/:name/:isin', async (req, res) => {
	const summary = await createSummary(req.params.name, req.params.isin);
	res.send(summary);
});

module.exports = router;
