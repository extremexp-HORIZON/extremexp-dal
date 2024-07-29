'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const {validateSchema} = require("./util");
const router = require('../../../ivis-core/server/lib/router-async').create();

const REQUIRED_FIELDS = ['name', 'intent'];

function validateRequiredFields(body) {
    return REQUIRED_FIELDS.every(field => body.hasOwnProperty(field));
}

const EXECUTED_EXPERIMENTS_SCHEMA = {
    name: 'string',
    start: 'string',
    end: 'string',
    intent: 'string',
    metadata: 'object',
    // RUNNING, STOPPED, PAUSED, NEW, COMPLETED
    status: 'string',
    comment: 'string',
    workflowIds: [ 'string' ]
};

router.putAsync('/executed-experiments', async (req, res) => {
    try {
        const body = req.body;

        const validationResult = validateSchema(body, EXECUTED_EXPERIMENTS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        const response = await elasticsearch.index({
            index: 'executed_experiments',
            id: body.id,
            body
        });

        if (response.result === 'created') {
            return res.status(201).json({ message: {experimentId: response._id} });
        } else {
            console.error('Error adding executed experiment:', response);
            return res.status(400).json({ error: 'Failed to add executed experiment' });
        }
    } catch (error) {
        console.error('Error adding executed experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/executed-experiments/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        const body = req.body;

        try{
            const existingWorkflow = await elasticsearch.get({
                index: 'executed_experiments',
                id: experimentId
            });
            if (!existingWorkflow) {
                return res.status(404).json({ error: 'Executed experiment not found' });
            }
        }
        catch(error)
        {
            return res.status(404).json({ error: "Executed experiment not found" });
        }

        const validationResult = validateSchema(body, EXECUTED_EXPERIMENTS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        const response = await elasticsearch.update({
            index: 'executed_experiments',
            id: experimentId,
            body: { doc: body }
        });

        if (response.result === 'updated') {
            return res.status(200).json({ message: 'Executed experiment updated successfully', document: response.body });
        } else {
            console.error('Error updating executed experiment:', response.body);
            return res.status(400).json({ error: 'Failed to update executed experiment' });
        }
    } catch (error) {
        console.error('Error updating executed experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/executed-experiments/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        let experimentResponse;
        try {
             experimentResponse = await elasticsearch.get({
                index: 'executed_experiments',
                id: experimentId
            });
        } catch (error){
            return res.status(404).json({ error: 'Executed experiment not found' });
        }

        if (!experimentResponse.found) {
            return res.status(404).json({ error: 'Executed experiment not found' });
        }


        const experiment = experimentResponse._source;
        res.status(200).json({ experiment });
    } catch (error) {
        console.error('Error retrieving executed experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const EXPERIMENTS_QUERY_SCHEMA = {
    intent: 'string',
    metadata: 'object',
};

router.postAsync('/executed-experiments-query', async (req, res) => {
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

        if (req.body.intent) {
            query.bool.must.push({ match: { intent: req.body.intent } });
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
            index: 'executed_experiments',
            body: { query }
        });

        const executedExperiments = await Promise.all(body.hits.hits.map(async hit => {
            return hit;
        }));

        res.status(200).json(executedExperiments);
    } catch (error) {
        console.error('Error retrieving executed experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
