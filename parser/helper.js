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

module.exports = { childsByAttribute, getLink };
