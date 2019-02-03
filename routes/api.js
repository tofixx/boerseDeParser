const express = require('express');

const router = express.Router();
const request = require('request-promise');

const baseUrl = 'https://www.boerse.de/';

/* GET users listing. */
router.get('/:type/:name/:isin', (req, res) => {
	const uri = new URL(`${req.params.type}/${req.params.name}/${req.params.isin}`, baseUrl);
	request({ uri })
		.then((response) => {
			const html = response;
			res.send(html);
		})
		.catch(err => res.status(500).send(err));
});

module.exports = router;
