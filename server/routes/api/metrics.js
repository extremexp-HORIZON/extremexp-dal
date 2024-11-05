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
const {validateSchema, aggregatieMetric} = require("./util");

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
    semantic_type: 'string',
    kind: 'string',
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
            return res.status(404).json({error: "Please add parent_type and parent_id; for example and its id which the metric belongs to."});
        }
        const parentResponse = await elasticsearch.get({
            index: `${body.parent_type}s`,
            id: body.parent_id
        });
        if (!parentResponse.found) {
            return res.status(404).json({error: `${body.parent_type} with id ${body.parent_id}  not found`});
        }

        body.experimentId = parentResponse._source.experimentId;
        //const otherMetrics = (parentResponse._source.metrics) ? parentResponse._source.metrics : [];
        const otherMetricIds = (parentResponse._source.metric_ids) ? parentResponse._source.metric_ids : [];

        const response = await elasticsearch.index({
            index: 'metrics',
            body
        });
        if (response.result === 'created') {
            //otherMetrics.push({[response._id]: body});
            otherMetricIds.push(response._id);
            await elasticsearch.update({
                index: `${body.parent_type}s`,
                id: body.parent_id,
                body: {
                    doc: {
                        //metrics: otherMetrics,
                        metric_ids: otherMetricIds
                    }
                }
            });
            return res.status(201).json({metric_id: response._id});
        } else {
            console.error('Error adding metric:', response);
            return res.status(400).json({error: 'Failed to add metric'});
        }

    } catch (error) {
        console.error('Error adding metric:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});


router.getAsync('/metrics/:metricId', async (req, res) => {
    const { metricId } = req.params;

    var metricResponse;
    try {
        metricResponse = await elasticsearch.get({
            index: 'metrics',
            id: metricId
        });
        const aggregation = aggregatieMetric(metricResponse);
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

router.getAsync('/metrics', async (req, res) => {
    try {
        let metricsResponse;
        try {
            metricsResponse = await elasticsearch.search({
                index: 'metrics',
                size: 1000,
                scroll: '1m', // Keep the search context alive for 1 minute
                body: {
                    query: {
                        match_all: {}
                    }
                }
            });
        } catch (error) {
            return res.status(404).json({ error: 'Metrics not found' });
        }

        if (!metricsResponse.hits || metricsResponse.hits.total.value === 0) {
            return res.status(404).json({ error: 'Metrics not found' });
        }

        const metrics = metricsResponse.hits.hits.map(hit => ({
            [hit._id]: {
                id: hit._id,
                ...hit._source
            }

        }));
        res.status(200).json({ metrics });
    } catch (error) {
        console.error('Error retrieving metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
const METRIC_QUERY_SCHEMA = {
    experimentId: 'string',
    kind: 'string',
    type: 'string',
    semantic_type: 'string',
    parent_id: 'string',
    parent_type: 'string',
};


router.postAsync('/metrics-query', async (req, res) => {
    try {
        const validationResult = validateSchema(req.body, METRIC_QUERY_SCHEMA);
        if (validationResult) {
            return res.status(400).json({
                error: `Validation error: ${validationResult}`,
                expected: Object.keys(METRIC_QUERY_SCHEMA)
            });
        }

        const query = {
            bool: {
                must: [],
                filter: []
            }
        };

        // Query for experimentId
        if (req.body.experimentId) {
            query.bool.must.push({ match: { experimentId: req.body.experimentId } });
        }

        // Query for kind
        if (req.body.kind) {
            query.bool.must.push({ term: { kind: req.body.kind } });
        }

        // Query for type
        if (req.body.type) {
            query.bool.must.push({ term: { type: req.body.type } });
        }

        // Query for semantic_type
        if (req.body.semantic_type) {
            query.bool.must.push({ term: { semantic_type: req.body.semantic_type } });
        }

        // Query for parent_id
        if (req.body.parent_id) {
            query.bool.must.push({match: {parent_id: req.body.parent_id}});
        }

        // Query for parent_type
        if (req.body.parent_type) {
            query.bool.must.push({ term: { parent_type: req.body.parent_type } });
        }

        // Perform the search
        const body = await elasticsearch.search({
            index: 'metrics',
            body: { query }
        });

        console.log(query.bool.must);

        // Map results
        const metrics = body.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source
        }));

        res.status(200).json(metrics);

    } catch (error) {
        console.error('Error retrieving metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
