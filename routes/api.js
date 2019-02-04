const express = require('express');

const router = express.Router();
const request = require('request-promise');
const parser = require('node-html-parser');

const baseUrl = 'https://www.boerse.de/';

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
	function getLink(cell) {
		const link = cell.querySelector('a');
		if (link && link.attributes && 'href' in link.attributes) {
			return link.attributes.href;
		}
		return null;
	}
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

router.get('/:type/:name/:isin', (req, res) => {
	const uri = new URL(`${req.params.type}/${req.params.name}/${req.params.isin}`, baseUrl);
	request({ uri })
		.then((response) => {
			const document = parser.parse(response);
			const name = getName(document);
			const eigenschaften = getEigenschaften(document);
			const kurszeile = document.querySelector('.kurszeile');
			const price = getCurrentPrice(kurszeile);
			const currency = getPriceCurrency(kurszeile);
			const intrayAbsoluteValue = getIntrayAbsoluteValue(kurszeile);
			const timestamp = getIntrayAbsoluteTimestamp(kurszeile);
			const date = getDate(kurszeile);
			const intrayRelative = getIntrayRelativeValue(kurszeile);
			const result = {
				info: {
					name,
					properties: eigenschaften,
				},
				price: {
					value: price,
					currency,
					timestamp,
					date,
				},
				intrayAbsolute: {
					value: intrayAbsoluteValue,
					currency,
				},
				intrayRelative: {
					value: intrayRelative,
					currency: '%',
				},
			};
			res.send(200, result);
		})
		.catch((err) => {
			res.send(500, err);
		});
});

module.exports = router;
