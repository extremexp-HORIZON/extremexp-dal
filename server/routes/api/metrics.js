'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();
const signalSets = require('../../../ivis-core/server/models/signal-sets');

const config = require('../../../ivis-core/server/lib/config');
const moment = require('moment');
const knex = require('../../../ivis-core/server/lib/knex');
const log = require('../../../ivis-core/server/lib/log');
const { SignalType } = require('../../../ivis-core/shared/signals');
const contextHelpers = require('../../../ivis-core/server/lib/context-helpers');
const namespaces = require('../../../ivis-core/server/models/namespaces');
const {validateSchema} = require("./util");

const typeMapping = {
    datetime: SignalType.DATE_TIME,
    integer: SignalType.INTEGER,
    long: SignalType.LONG,
    float: SignalType.FLOAT,
    double: SignalType.DOUBLE,
    string: SignalType.KEYWORD,
    text: SignalType.TEXT,
    boolean: SignalType.BOOLEAN
};

const METRIC_DEFINITION_SCHEMA = {
    schema: 'object',
    name: 'string'
};
const METRIC_SCHEMA = {
    name: 'string',
    semanticType: 'string',
    type: 'string',
    value: 'string',
    producedByTask: 'string',
    date: 'string',
    parent_type: 'string',
    parent_id:'string'
}
router.putAsync('/metrics', async (req, res) => {
    try {
        const body = req.body;

        const validationError = validateSchema(body, METRIC_SCHEMA);
        if (validationError) {
            return res.status(400).json({error: validationError});
        }

        if (!body.hasOwnProperty("parent_type") || !body.hasOwnProperty("parent_id")) {
            return res.status(404).json({error: "Please add parent_type and parent_id; for example executed_workflow and its id which the metric belongs to."});
        }
        const parentResponse = await elasticsearch.get({
            index: `${body.parent_type}s`,
            id: body.parent_id
        });
        if (!parentResponse.found) {
            return res.status(404).json({error: `${body.parent_type} with id ${body.parent_id}  not found`});
        }

        body.experimentId = parentResponse._source.experimentId;
        const otherMetrics = (parentResponse._source.metrics) ? parentResponse._source.metrics : [];
        const otherMetricIds = (parentResponse._source.metric_ids) ? parentResponse._source.metric_ids : [];

        const response = await elasticsearch.index({
            index: 'metrics',
            body
        });
        if (response.result === 'created') {
            otherMetrics.push({[response._id]: body});
            otherMetricIds.push(response._id);
            await elasticsearch.update({
                index: `${body.parent_type}s`,
                id: body.parent_id,
                body: {
                    doc: {
                        metrics: otherMetrics,
                        metric_ids: otherMetricIds
                    }
                }
            });
            return res.status(201).json({metric_id: response._id});
        } else {
            console.error('Error adding metric:', response);
            return res.status(400).json({error: 'Failed to add executed metric'});
        }

    } catch (error) {
        console.error('Error adding metric:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});
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

router.getAsync('/metrics/:metricId', async (req, res) => {
    const { metricId } = req.params;

    var metricResponse;
    try {
        metricResponse = await elasticsearch.get({
            index: 'metrics',
            id: metricId
        });
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
        res.status(200).json({
            ...metricResponse._source,
            aggregation: aggregation
        });
    } catch(error){
        return res.status(404).json({ error: 'Metric not found' });
    }

});

router.postAsync('/metrics/:metricId', async (req, res) => {
    const {metricId} = req.params;
    const body = req.body;

    const validationError = validateSchema(body, METRIC_SCHEMA);
    if (validationError) {
        return res.status(400).json({error: validationError});
    }

    // remove the relation attributes
    if (body.hasOwnProperty("parent_type")) {
        delete body.parent_type;
    }
    if (body.hasOwnProperty("parent_id")) {
        delete body.parent_id;
    }
    if (body.hasOwnProperty("experiment_id")) {
        delete body.experiment_id;
    }

    try {
        const existingMetric = await elasticsearch.get({
            index: 'metrics',
            id: metricId
        });
        if (!existingMetric.found) {
            return res.status(404).json({error: 'Metric not found'});
        }

        const response = await elasticsearch.update({
            index: 'metrics',
            id: metricId,
            body: {doc: body}
        });

        if (response.result === 'noop') {
            return res.status(200).json({message: 'No updates needed', document: response.body});
        }
        if (response.result === 'updated') {
            return res.status(200).json({message: 'Metric updated successfully', document: response.body});
        } else {
            console.error('Error updating metric', response.body);
            return res.status(400).json({error: 'Failed to update metric'});
        }
    } catch (error) {
        console.error('Error updating metric:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

const METRIC_DATA_SCHEMA = {
    records: 'object',
};

router.putAsync('/metrics-data/:metricId', async (req, res) => {
    const {metricId} = req.params;
    const body = req.body;

    const validationError = validateSchema(body, METRIC_DATA_SCHEMA);
    if (validationError) {
        return res.status(400).json({error: validationError});
    }
    try {
        const existingMetric = await elasticsearch.get({
            index: 'metrics',
            id: metricId
        });
        if (!existingMetric.found) {
            return res.status(404).json({error: 'Metric not found'});
        }

        const data = (existingMetric._source.hasOwnProperty("records"))?  existingMetric._source.records : [];
        for (let dataObject of body.records){
            data.push(dataObject);
        }

        const response = await elasticsearch.update({
            index: 'metrics',
            id: metricId,
            body: {doc : {records: data}}
        });

        if (response.result === 'noop') {
            return res.status(200).json({message: 'No updates needed', document: response.body});
        }
        if (response.result === 'updated') {
            return res.status(200).json({message: 'Metric updated successfully', document: response.body});
        } else {
            console.error('Error updating metric', response.body);
            return res.status(400).json({error: 'Failed to update metric'});
        }
    } catch (error) {
        console.error('Error updating metric:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

router.postAsync('/metrics-data/:metricId', async (req, res) => {

});

router.postAsync('/metrics-query', async (req, res) => {
    try {
        const { experimentId, workflowId , metadata} = req.body;

        const mustConditions = [];

        if (experimentId) {
            mustConditions.push({ match: { 'experimentId': experimentId } });
        }

        if (workflowId) {
            mustConditions.push({ match: { 'workflowId': workflowId } });
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                mustConditions.push({
                    nested: {
                        path: 'metrics.metadata',
                        query: {
                            bool: {
                                must: [
                                    { match: { [`metrics.metadata.${key}`]: value } }
                                ]
                            }
                        }
                    }
                });
            }
        }

        const query = {
            bool: {
                must: mustConditions
            }
        };

        const response = await elasticsearch.search({
            index: 'executed_workflows',
            body: {
                query
            }
        });

        const metrics = response.hits.hits.flatMap(hit => {
            const source = hit._source;
            if (source.metrics) {
                return source.metrics.filter(metric => {
                    if (metadata) {
                        return Object.entries(metadata).every(([key, value]) => {
                            return metric.metadata && metric.metadata[key] === value;
                        });
                    }
                    return true;
                }).map(metric => {
                    if (metric.type === 'scalar') {
                        return {
                            ...metric,
                            value: metric.value
                        };
                    }
                    return metric;
                });
            }
            return [];
        });

        res.status(200).json(metrics);
    } catch (error) {
        if (error.message.includes('Permission denied')) {
            return res.status(400).json({ error: 'Permission denied', details: error.message });
        }

        console.error('Error retrieving metrics:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// Aggregation
// const sum = calculateSum(metric.data);
// const min = calculateMin(metric.data);
// const max = calculateMax(metric.data);
// const average = calculateAverage(metric.data);
// const count = calculateCount(metric.data);
// const range = calculateRange(metric.data);
// const median = calculateMedian(metric.data);

module.exports = router;
