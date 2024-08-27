'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const {validateSchema} = require("./util");
const router = require('../../../ivis-core/server/lib/router-async').create();
const { exec, execSync } = require('child_process');
const {toJSON} = require("express-session/session/cookie");

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
    status: 'string',
    comment: 'string',
    model: 'string'
};

router.putAsync('/executed-experiments', async (req, res) => {
    try {
        const body = req.body;

        const validationResult = validateSchema(body, EXECUTED_EXPERIMENTS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        // add new to the newly created executed experiment
        body.status = "new";
        if (!body.hasOwnProperty("workflow_ids")){
            body.workflow_ids = [];
        }

        const response = await elasticsearch.index({
            index: 'executed_experiments',
            id: body.id,
            body,
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
            const existingExperiment = await elasticsearch.get({
                index: 'executed_experiments',
                id: experimentId
            });
            if (!existingExperiment) {
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

router.getAsync('/executed-experiments', async (req, res) => {
    try {
        let experimentsResponse;
        try {
            experimentsResponse = await elasticsearch.search({
                index: 'executed_experiments',
                size: 1000,
                scroll: '1m', // Keep the search context alive for 1 minute
                body: {
                    query: {
                        match_all: {}
                    }
                }
            });
        } catch (error) {
            return res.status(404).json({ error: 'Executed experiments not found' });
        }

        if (!experimentsResponse.hits || experimentsResponse.hits.total.value === 0) {
            return res.status(404).json({ error: 'Executed experiments not found' });
        }

        const executed_experiments = experimentsResponse.hits.hits.map(hit => ({
            [hit._id]: {
                id: hit._id,
                ...hit._source
            }

        }));
        res.status(200).json({ executed_experiments });
    } catch (error) {
        console.error('Error retrieving executed experiments:', error);
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


        const experiment = experimentResponse;
        let modelJSON;
        if (experiment._source.model && process.env.DMS_PATH) {
            const shellout = execSync(`bash ${process.env.DMS_PATH}/run.sh \'${experiment._source.model}\'`)
            try{
                modelJSON = JSON.parse(shellout.toString("utf8"),null, 2);

            }
            catch (error){
                modelJSON = `error: ${error}`;            }
        }
        return res.status(200).json({
            experiment: {
                id:experiment._id,
                ...experiment._source,
                modelJSON:modelJSON
            }
        });
    } catch (error) {
        console.error('Error retrieving executed experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const EXPERIMENTS_WORKFLOW_SORT_SCHEMA = {
    precedence: 'object',
};

// MA: use the following function to sort the workflow list
function moveElementBeforeAnother(array, a, b) {

    // Find the indices of elements a and b
    const indexA = array.indexOf(a);
    const indexB = array.indexOf(b);
    console.log("done here");

    // If either element is not found, return the array as is
    if (indexA === -1 || indexB === -1) {
        return array;
    }

    // Remove element b from its original position
    array.splice(indexB, 1);

    // Recalculate index of a in case indexB was before it
    const newIndexA = array.indexOf(a);

    // Insert element b before element a
    array.splice(newIndexA+1, 0, b);
    return array;
}


router.postAsync('/executed-experiments-sort-workflows/:experimentId', async (req, res) => {
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

        const validationResult = validateSchema(req.body, EXPERIMENTS_WORKFLOW_SORT_SCHEMA);
        if (validationResult || !req.body.precedence) {
            return res.status(400).json({ error: `Validation error: ${validationResult}, expected precedence` });
        }

        const precedence = req.body.precedence;
        let workflowIdList = experimentResponse._source.workflow_ids;
        Object.keys(precedence).forEach((key) => {
            workflowIdList = moveElementBeforeAnother(workflowIdList, key, precedence[key]);
        });

        const response = await elasticsearch.update({
            index: 'executed_experiments',
            id: experimentId,
            body: { doc:
                    {
                        "workflow_ids": workflowIdList,
                    }
            }
        });
        console.log(response);
        if (response.result === "updated" || response.result === "noop" ){
            return res.status(200).json(workflowIdList);
        }
        else{
            return res.status(500).json({ error: 'Internal server error' });
        }


    } catch (error) {
        console.error('Error ordering workflows of executed experiments:', error);
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

        const executedExperiments = await Promise.all(body.hits.hits.map(async hit => ({
            [hit._id]: {
                id: hit._id,
                ...hit._source
            }
        })));

        res.status(200).json(executedExperiments);
    } catch (error) {
        console.error('Error retrieving executed experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
