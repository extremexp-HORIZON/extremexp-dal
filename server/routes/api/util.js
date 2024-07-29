function addMetadataToQuery(req, query) {
    const keys = req.query.key ? [].concat(req.query.key) : [];
    const values = req.query.value ? [].concat(req.query.value) : [];

    if (keys.length !== values.length) {
        return false;
    }

    for (let i = 0; i < keys.length; i++) {
        query.bool.filter.push({
            nested: {
                path: 'metadata',
                query: {
                    bool: {
                        must: [
                            {match: {'metadata.key': keys[i]}},
                            {match: {'metadata.value': values[i]}}
                        ]
                    }
                }
            }
        });
    }

    return true;
}

function validateSchema(body, schema, parentKey = '') {
    if(schema === 'string'){
        if(typeof body === 'string'){
            return null;
        }

        return `${body} Should be an string. Path: ${parentKey}`;
    }

    for (const key in body) {
        if (!schema.hasOwnProperty(key)) {
            const parentInfo = parentKey ? ` in ${parentKey}` : '';
            return `Unexpected field: ${key}${parentInfo}`;
        }

        const newParentKey = parentKey ? `${parentKey}.${key}` : key;

        if (typeof schema[key] === 'object' && !Array.isArray(schema[key])) {
            if (typeof body[key] !== 'object' || Array.isArray(body[key])) {
                return `Field ${key} should be an object. Path: ${parentKey}`;
            }
            const error = validateSchema(body[key], schema[key], newParentKey);
            if (error) {
                return error;
            }
        } else if (Array.isArray(schema[key])) {
            if (!Array.isArray(body[key])) {
                return `Field ${key} should be an array. Path: ${parentKey}`;
            }

            for (const item of body[key]) {
                const error = validateSchema(item, schema[key][0], newParentKey);
                if (error) {
                    return error;
                }
            }
        } else if (typeof body[key] !== schema[key]) {
            return `Field ${key} should be of type ${schema[key]}. Path: ${parentKey}`;
        }
    }
    return null;
}

module.exports = { addMetadataToQuery, validateSchema };
