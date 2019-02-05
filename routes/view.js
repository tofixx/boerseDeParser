const express = require('express');
const { createSummary } = require('../parser/boerseDeParser');

const router = express.Router();

router.get('/aktien/:name/:isin', async (req, res) => {
	const summary = await createSummary(req.params.name, req.params.isin);
	res.render('aktie', summary);
});

module.exports = router;
