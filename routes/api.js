const express = require('express');

const router = express.Router();
const request = require('request-promise');
const parser = require('node-html-parser');

const baseUrl = 'https://www.boerse.de/';

/** Helpers */
function childsByAttribute(document, attributeName, attributeValue, depth = 0) {
	let nodes = [];
	Object.keys(document)
		.forEach((i) => {
			const key = document[i];
			if (key.attributes
        && attributeName in key.attributes
        && key.attributes[attributeName] === attributeValue) {
				nodes.push(key);
			}
			if (key.childNodes && key.childNodes.length !== 0) {
				nodes = nodes.concat(
					childsByAttribute(key.childNodes, attributeName, attributeValue, depth + 1),
				);
			}
		});
	return nodes;
}

function getLink(cell) {
	const link = cell.querySelector('a');
	if (link && link.attributes && 'href' in link.attributes) {
		return link.attributes.href;
	}
	return null;
}

/** Page data fetcher */
function getCurrentPrice(kurszeile) {
	const nodes = childsByAttribute(kurszeile.childNodes, 'itemprop', 'price');
	return parseFloat(nodes[0].attributes.content);
}

function getPriceCurrency(kurszeile) {
	const nodes = childsByAttribute(kurszeile, 'itemprop', 'priceCurrency');
	return nodes[0].text;
}
function getIntrayAbsoluteValue(kurszeile) {
	const nodes = childsByAttribute(kurszeile, 'data-push-attribute', 'perfInstAbs');
	return parseFloat(nodes[0].structuredText.replace(',', '.'));
}
function getIntrayAbsoluteTimestamp(kurszeile) {
	const nodes = childsByAttribute(kurszeile, 'data-push-attribute', 'timestamp');
	return nodes[0].structuredText;
}
function getDate(kurszeile) {
	const nodes = childsByAttribute(kurszeile, 'data-push-attribute', 'date');
	return nodes[0].structuredText;
}
function getIntrayRelativeValue(kurszeile) {
	const nodes = childsByAttribute(kurszeile, 'data-push-attribute', 'perfInstRel');
	return parseFloat(nodes[0].structuredText.replace(',', '.'));
}
function getEigenschaften(document) {
	const div = document.querySelectorAll('.unternehmensTeaser')[0];
	const rows = div.querySelector('table').querySelectorAll('tr');
	function getCells(row) {
		const cells = row.querySelectorAll('td');
		const props = {
			name: cells[0].structuredText,
			value: cells[1].structuredText,
		};
		const url = getLink(cells[1]);
		if (url) {
			Object.assign(props, { url });
		}
		return props;
	}
	return rows.map(row => getCells(row));
}

function getName(document) {
	const node = document.querySelector('.nameGross');
	return node.structuredText;
}

/** indicator in range [-2, -1, 0, 1, 2] for current distance */
function getTrendIndicator(icon) {
	const classes = icon.attributes.class.split(' ');
	if (classes.includes('fa-arrow-down')) return -2;
	if (classes.includes('fa-arrow-right-down')) return -1;
	if (classes.includes('fa-arrow-right')) return 0;
	if (classes.includes('fa-arrow-right-up')) return 1;
	if (classes.includes('fa-arrow-up')) return 2;
	return null;
}

function getTrends(document) {
	const rows = document.querySelector('.trendAnalyseTeaser').querySelector('table').querySelectorAll('tr');
	rows.shift(1); // removes header
	return rows.map((row) => {
		const cells = row.querySelectorAll('td');
		return {
			name: cells[0].structuredText,
			trend: getTrendIndicator(cells[1].querySelector('i')),
			value: parseFloat(cells[2].structuredText.replace(',', '.')),
			distance: parseFloat(cells[3].structuredText.replace(',', '.')),
		};
	});
}

function getPerformance(document) {
	const rows = document.querySelector('.perfoTeaser').querySelectorAll('tr');
	rows.shift(1); // removes header
	return rows.map((row) => {
		const cells = row.querySelectorAll('td');
		return {
			name: cells[0].structuredText,
			value: parseFloat(cells[1].structuredText.replace(',', '.')),
			distance: parseFloat(cells[2].structuredText.replace(',', '.')),
		};
	});
}


function getChartUrl(isin, zeitraum, currency) {
	const uri = new URL('ajax/chart.php', baseUrl);
	const data = {
		typ: '',
		zeitraum: zeitraum || '1 J',
		ChartTemplate: 'ToolLeftChartAktieSmall',
		ISIN: isin,
		currency: currency || 'eur',
		stockId: 1,
		main_boerse_fallback: 1,
	};
	return request({
		uri,
		method: 'POST',
		form: data,
	}).then(response => response);
}

async function createSampleChartUrls(isin, currency) {
	const zeitraeume = ['1 T',	'1 W',	'1 M',	'3 M',	'6 M',	'1 J',	'3 J',	'5 J',	'10 J',	'15 J',	'20 J',	'Max'];
	const result = zeitraeume.map(async (zeitraum) => {
		const url = await getChartUrl(isin, zeitraum, currency);
		return { range: zeitraum, url };
	});
	return Promise.all(result).then(urls => urls);
}

router.get('/charts/:isin', async (req, res) => {
	const urls = await createSampleChartUrls(req.params.isin);
	res.send(urls);
});

router.get('/aktien/:name/:isin', async (req, res) => {
	const uri = new URL(`/aktien/${req.params.name}/${req.params.isin}`, baseUrl);
	request({ uri })
		.then(async (response) => {
			const document = parser.parse(response);
			const name = getName(document);
			const eigenschaften = getEigenschaften(document);
			const kurszeile = document.querySelector('.kurszeile');
			const price = getCurrentPrice(kurszeile);
			const currency = getPriceCurrency(kurszeile);
			const intrayAbsoluteValue = getIntrayAbsoluteValue(kurszeile);
			const time = getIntrayAbsoluteTimestamp(kurszeile);
			const date = getDate(kurszeile);
			const intrayRelative = getIntrayRelativeValue(kurszeile);
			const trends = getTrends(document);
			const performance = getPerformance(document);
			const charts = await createSampleChartUrls(req.params.isin, currency.toLowerCase());
			const result = {
				summary: {
					name,
					properties: eigenschaften,
					price: {
						value: price,
						currency,
						time,
						date,
						intrayAbsolute: {
							value: intrayAbsoluteValue,
							currency,
						},
						intrayRelative: {
							value: intrayRelative,
							currency: '%',
						},
					},
				},
				analysis: {
					trends,
					performance,
					charts,
				},

			};
			res.send(result);
		});
});

module.exports = router;
