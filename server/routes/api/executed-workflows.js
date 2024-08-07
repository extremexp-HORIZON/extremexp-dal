'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();

const { addMetadataToQuery, validateSchema } = require('./util.js');

const REQUIRED_FIELDS = ['name', 'start', 'end'];
function validateRequiredFields(body) {
    return REQUIRED_FIELDS.every(field => body.hasOwnProperty(field));
}

const SCHEMA = {
    name: 'string',
    experimentId: 'string',
    start: 'string',
    end: 'string',
    order: 'int',
    metadata: 'object',
    comment: 'string',
    parameters: [{
        name: 'string',
        value: 'string',
        type: 'string',
        usedByExecutedTasks: 'string'
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
        metadata: 'object'
    }],
    output_datasets: [{
        uri: 'string',
        type: 'string',
        producedByTask: 'string',
        name: 'string',
        date: 'string',
        checksum: 'string',
        description: 'string'
    }],
    executedTasks: [{
        id: 'string',
        name: 'string',
        start: 'string',
        end: 'string',
        metadata: 'object',
        comment: 'string',
        executedWorkflow: 'string',
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
    return validateSchema(body, SCHEMA);
}

/**
 * Endpoint for uploading new executed workflow, body may contain experimentId
 */
router.putAsync('/executed-workflows', async (req, res) => {
    try {
        const body = req.body;

        const validationError = validatePayload(body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const response = await elasticsearch.index({
            index: 'executed_workflows',
            body
        });

        if (response.result === 'created') {
            if (body.hasOwnProperty("experimentId")){
                try {
                    const executedExperiment = await elasticsearch.get({
                        index: 'executed_experiments',
                        id: body.experimentId,
                    });
                    executedExperiment._source.workflowIds.push(response._id);
                    console.log(executedExperiment._source.workflowIds);

                    const updateResponse = await elasticsearch.update({
                        index: 'executed_experiments',
                        id: body.experimentId,
                        body: {
                            doc: {
                                workflowIds: executedExperiment._source.workflowIds
                            }
                        }
                    });
                    if (updateResponse.result !== 'updated') {
                        console.error('Error updating executed experiment:', response.body);
                        return res.status(400).json({ error: 'Failed to update executed experiment' });
                    }
                } catch (error){
                    console.error('Error adding executed workflow:', error);
                    return res.status(404).json({ error: 'Executed experiment not found' });
                }
            }
            return res.status(201).json({ workflowId: response._id});
        } else {
            console.error('Error adding executed workflow:', response);
            return res.status(400).json({ error: 'Failed to add executed workflow' });
        }
    } catch (error) {
        console.error('Error adding executed workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/executed-workflows/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const body = req.body;

        try{
            const existingWorkflow = await elasticsearch.get({
                index: 'executed_workflows',
                id: workflowId
            });
            if (!existingWorkflow) {
                return res.status(404).json({ error: 'Executed workflow not found' });
            }
        }
        catch(error)
        {
            return res.status(404).json({ error: "Executed workflow not found" });
        }

        const validationError = validatePayload(body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const response = await elasticsearch.update({
            index: 'executed_workflows',
            id: workflowId,
            body: { doc: body }
        });

        if (response.result === 'noop') {
            return res.status(200).json({ message: 'No updates needed', document: response.body });
        }
        if (response.result === 'updated') {
            return res.status(200).json({ message: 'Executed workflow updated successfully', document: response.body });
        } else {
            console.error('Error updating executed workflow:', response.body);
            return res.status(400).json({ error: 'Failed to update executed workflow' });
        }
    } catch (error) {
        console.error('Error updating executed workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/executed-workflows/:workflowId', async (req, res) => {
        const { workflowId } = req.params;

        var workflowResponse;
        try {
            workflowResponse = await elasticsearch.get({
                index: 'executed_workflows',
                id: workflowId
            });
        } catch(error){
            return res.status(404).json({ error: 'Executed workflow not found' });
        }

        try{
            if (!workflowResponse.found) {
                return res.status(404).json({ error: 'Executed workflow not found' });
            }

            const workflow = workflowResponse._source;
            res.status(200).json({ workflow});
        } catch (error) {
        console.error('Error retrieving executed workflow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.postAsync('/executed-workflows-query', async (req, res) => {
    try {
        const { id, experimentId, startTime, endTime, startId, endId, metadata } = req.body;

        const query = {
            bool: {
                must: [],
                filter: []
            }
        };

        if (id) {
            query.bool.must.push({ match: { id } });
        }

        if(experimentId){
            query.bool.must.push({match: {experimentId}});
        }

        if (startTime || endTime) {
            const rangeQuery = {};
            if (startTime) rangeQuery.gte = startTime;
            if (endTime) rangeQuery.lte = endTime;
            query.bool.filter.push({ range: { start: rangeQuery } });
        }

        if (startId || endId) {
            const rangeQuery = {};
            if (startId) rangeQuery.gte = startId;
            if (endId) rangeQuery.lte = endId;
            query.bool.filter.push({ range: { id: rangeQuery } });
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
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
            index: 'executed_workflows',
            body: { query }
        });

        const executedWorkflows = await Promise.all(body.hits.hits.map(
            async hit => hit._source));

        res.status(200).json(executedWorkflows);
    } catch (error) {
        console.error('Error retrieving executed workflows:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
