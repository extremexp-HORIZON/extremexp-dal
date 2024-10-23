'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();

const { addMetadataToQuery, validateSchema } = require('./util.js');
const {aggregatieMetric} = require("./util");

const REQUIRED_FIELDS = ['name', 'start', 'end'];
function validateRequiredFields(body) {
    return REQUIRED_FIELDS.every(field => body.hasOwnProperty(field));
}

const WORKFLOW_SCHEMA = {
    name: 'string',
    experimentId: 'string',
    start: 'string',
    end: 'string',
    // scheduled, running, completed, failed
    status: 'string',
    metadata: 'object',
    comment: 'string',
    parameters: [{

        name: 'string',
        type: 'string',
        value: 'string',
        usedByTasks: 'string'

    }],
    input_datasets: [{
        name: 'string',
        uri: 'string',
        usedByTasks: 'string',
        date: 'string',
        checksum: 'string'
    }],
    metrics: [{
        name: 'string',
        semanticType: 'string',
        type: 'string',
        value: 'string',
        producedByTask: 'string',
        date: 'string',
    }],
    output_datasets: [{
        name: 'string',
        uri: 'string',
        type: 'string',
        producedByTask: 'string',
        date: 'string',
        checksum: 'string',
        description: 'string',
    }],
    tasks: [{
        id: 'string',
        name: 'string',
        start: 'string',
        end: 'string',
        metadata: 'object',
        comment: 'string',
        workflow: 'string',
        source_code: 'string',
        parameters: [{
            name: 'string',
            type: 'string',
            value: 'string'
        }],
        input_datasets: [{
            name: 'string',
            uri: 'string',
            date: 'string',
            checksum: 'string'
        }],
        metrics: [{
            name: 'string',
            type: 'string',
            semanticType: 'string',
            value: 'string',
            date: 'string'
        }],
        output_datasets: [{
            type: 'string',
            uri: 'string',
            name: 'string',
            date: 'string',
            checksum: 'string',
            description: 'string'
        }]
    }]
};


function validatePayload(body) {
    return validateSchema(body, WORKFLOW_SCHEMA);
}

async function createSubIndex(subBody, indexText,  parentType, parentID, experimentID) {
    const subIndex = await elasticsearch.index({
        index: indexText,
        body: {
            ...subBody,
            parent_type: parentType,
            parent_id: parentID,
            experiment_id: experimentID
        }
    });
   if (subIndex.result === "created"){
        return subIndex;
    }
    else {
        return  null;
    }
}


/**
 * Endpoint for uploading new workflow, body may contain experimentId
 */
router.putAsync('/workflows', async (req, res) => {
    try {
        const body = req.body;

        const validationError = validatePayload(body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }
        body.status = "scheduled";
        const response = await elasticsearch.index({
            index: 'workflows',
            body
        });

        if (response.result === 'created') {
            if (body.hasOwnProperty("experimentId")){
                try {
                    const experiment = await elasticsearch.get({
                        index: 'experiments',
                        id: body.experimentId,
                    });
                    experiment._source.workflow_ids.push(response._id);

                    const updateResponse = await elasticsearch.update({
                        index: 'experiments',
                        id: body.experimentId,
                        body: {
                            doc: {
                                workflow_ids: experiment._source.workflow_ids
                            }
                        }
                    });
                    if (updateResponse.result !== 'updated') {
                        console.error('Error updating experiment:', response.body);
                        return res.status(400).json({ error: 'Failed to update experiment' });
                    }
                } catch (error){
                    console.error('Error adding workflow:', error);
                    return res.status(404).json({ error: 'Experiment not found' });
                }
            }
            if (body.hasOwnProperty("metrics")) {
                try{
                    var metrics = [];
                    var metricIDs = (body.metric_ids )? body.metric_ids : [];
                    for (const metric of body.metrics){
                        const metricObject = await createSubIndex(
                            metric,
                            'metrics',
                            'workflow',
                            response._id,
                            body.experimentId );

                        if (metricObject !== null) {
                            const metricResponse = await elasticsearch.get({
                                index: 'metrics',
                                id: metricObject._id
                            });
                            metrics.push({
                                [metricObject._id] : metricResponse._source
                            })
                            metricIDs.push(metricObject._id);
                        }
                    }

                    const updateResponse = await elasticsearch.update({
                        index: 'workflows',
                        id: response._id,
                        body: {
                            doc: {
                                metric_ids: metricIDs,
                                metrics: metrics
                            }
                        }
                    });

                } catch (error){
                    console.error('Error adding metric', error);
                    return res.status(404).json({ error: 'Experiment not found' });
                }
            }
            return res.status(201).json({ workflow_id: response._id});
        } else {
            console.error('Error adding workflow:', response);
            return res.status(400).json({ error: 'Failed to add workflow' });
        }
    } catch (error) {
        console.error('Error adding workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/workflows/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const body = req.body;

        try{
            const existingWorkflow = await elasticsearch.get({
                index: 'workflows',
                id: workflowId
            });
            if (!existingWorkflow) {
                return res.status(404).json({ error: 'Workflow not found' });
            }
        }
        catch(error)
        {
            return res.status(404).json({ error: "Workflow not found" });
        }

        const validationError = validatePayload(body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const response = await elasticsearch.update({
            index: 'workflows',
            id: workflowId,
            body: { doc: body }
        });

        if (response.result === 'noop') {
            return res.status(200).json({ message: 'No updates needed', document: response.body });
        }
        if (response.result === 'updated') {
            return res.status(200).json({ message: 'Workflow updated successfully', document: response.body });
        } else {
            console.error('Error updating workflow:', response.body);
            return res.status(400).json({ error: 'Failed to update workflow' });
        }
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/workflows/:workflowId', async (req, res) => {
        const { workflowId } = req.params;

        var workflowResponse;
        try {
            workflowResponse = await elasticsearch.get({
                index: 'workflows',
                id: workflowId
            });
        } catch(error){
            return res.status(404).json({ error: 'Workflow not found' });
        }

        try{
            if (!workflowResponse.found) {
                return res.status(404).json({ error: 'Workflow not found' });
            }

            const workflow = workflowResponse._source;
            // convert the metrics source to actual metrics (with values)
            if (workflow.hasOwnProperty("metric_ids")){
                const metricUpdates = [];
                for (const metric of workflow.metric_ids){
                    const metricResponse = await elasticsearch.get({
                        index: 'metrics',
                        id: metric
                    });
                    const aggregation = aggregatieMetric(metricResponse);
                    if (metricResponse.found){
                        metricUpdates.push({
                            [metric]: {
                                ...metricResponse._source, aggregation:aggregation
                            }
                        });
                    }
                }
                workflow.metrics = metricUpdates;
            }
            res.status(200).json({ workflow });
        } catch (error) {
        console.error('Error retrieving workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
const EXPERIMENTS_QUERY_SCHEMA = {
    experimentId: 'string',
    status: 'string',
    startTime: 'string',
    endTime: 'string',
    metadata: 'object',
};


router.postAsync('/workflows-query', async (req, res) => {
    try {
        const validationResult = validateSchema(req.body, EXPERIMENTS_QUERY_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        const query = {
            bool: {
                must: [],
                filter: []
            }
        };

        if (req.body.experimentId) {
            query.bool.must.push({ term: { experimentId:req.body.experimentId } });
        }

        if (req.body.startTime || req.body.endTime) {
            const rangeQuery = {};
            if (req.body.startTime) rangeQuery.gte = req.body.startTime;
            if (req.body.endTime) rangeQuery.lte = req.body.endTime;
            query.bool.filter.push({ range: { start: rangeQuery } });
        }

        if (req.body.metadata) {
            for (const [key, value] of Object.entries(req.body.metadata)) {
                query.bool.filter.push({
                    nested: {
                        path: 'metadata',
                        query: {
                            bool: {
                                must: [
                                    { match: { [`metadata.${key}`]: value } }
                                ]
                            }
                        }
                    }
                });
            }
        }

        const body = await elasticsearch.search({
            index: 'workflows',
            body: { query }
        });

        const workflows = body.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source
        }));

        res.status(200).json(workflows);

    } catch (error) {
        console.error('Error retrieving workflows:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;
