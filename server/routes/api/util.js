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
// Function to calculate the median value
function calculateMedian(data) {
    const values = data.map(item => item.value).sort((a, b) => a - b);
    const length = values.length;
    if (length === 0) return 0;
    const middle = Math.floor(length / 2);
    if (length % 2 === 0) {
        return (values[middle - 1] + values[middle]) / 2;
    } else {
        return values[middle];
    }
}
// Function to calculate the sum value
function calculateSum(data) {
    return data.reduce((acc, item) => acc + item.value, 0);
}

// Function to calculate the minimum value
function calculateMin(data) {
    return Math.min(...data.map(item => item.value));
}

// Function to calculate the maximum value
function calculateMax(data) {
    return Math.max(...data.map(item => item.value));
}

// Function to calculate the average value
function calculateAverage(data) {
    const sum = calculateSum(data);
    const count = data.length;
    return count > 0 ? sum / count : 0;
}

// Function to calculate the count of values
function calculateCount(data) {
    return data.length;
}


function aggregatieMetric(metricResponse){
    let aggregation = {};
    if (metricResponse._source.hasOwnProperty("records")){

        try{
            aggregation = {
                "count": calculateCount(metricResponse._source.records),
                "average": calculateAverage(metricResponse._source.records),
                "sum": calculateSum(metricResponse._source.records),
                "min": calculateMin(metricResponse._source.records),
                "max": calculateMax(metricResponse._source.records),
                "median": calculateMedian(metricResponse._source.records),
            }
        }
        catch (error){
            aggregation = {};
        }
    }
    return aggregation;
}

module.exports = { addMetadataToQuery, validateSchema, aggregatieMetric };
