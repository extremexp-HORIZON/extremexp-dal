'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const {validateSchema, getWorkflowById, aggregatieMetric} = require("./util");
const router = require('../../../ivis-core/server/lib/router-async').create();
const { exec, execSync } = require('child_process');
const {toJSON} = require("express-session/session/cookie");
const REQUIRED_FIELDS = ['name', 'intent'];

function validateRequiredFields(body) {
    return REQUIRED_FIELDS.every(field => body.hasOwnProperty(field));
}

const EXPERIMENTS_SCHEMA = {
    name: 'string',
    start: 'string',
    end: 'string',
    intent: 'string',
    metadata: 'object',
    creator: 'object',
    status: 'string',
    comment: 'string',
    model: 'string'
};

router.putAsync('/experiments', async (req, res) => {
    try {
        const body = req.body;

        const validationResult = validateSchema(body, EXPERIMENTS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        // add new to the newly created experiment
        body.status = "new";
        if (!body.hasOwnProperty("workflow_ids")){
            body.workflow_ids = [];
        }

        const response = await elasticsearch.index({
            index: 'experiments',
            id: body.id,
            body,
        });

        if (response.result === 'created') {
            return res.status(201).json({ message: {experimentId: response._id} });
        } else {
            console.error('Error adding experiment:', response);
            return res.status(400).json({ error: 'Failed to add experiment' });
        }
    } catch (error) {
        console.error('Error adding experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/experiments/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        const body = req.body;

        try{
            const existingExperiment = await elasticsearch.get({
                index: 'experiments',
                id: experimentId
            });
            if (!existingExperiment) {
                return res.status(404).json({ error: 'experiment not found' });
            }
        }
        catch(error)
        {
            return res.status(404).json({ error: "experiment not found" });
        }

        const validationResult = validateSchema(body, EXPERIMENTS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        const response = await elasticsearch.update({
            index: 'experiments',
            id: experimentId,
            body: { doc: body }
        });

        if (response.result === 'updated') {
            return res.status(200).json({ message: 'Experiment updated successfully', document: response.body });
        } else {
            console.error('Error updating experiment:', response.body);
            return res.status(400).json({ error: 'Failed to update experiment' });
        }
    } catch (error) {
        console.error('Error updating experiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/experiments', async (req, res) => {
    try {
        let experimentsResponse;
        try {
            experimentsResponse = await elasticsearch.search({
                index: 'experiments',
                size: 1000,
                scroll: '1m', // Keep the search context alive for 1 minute
                body: {
                    query: {
                        match_all: {}
                    }
                }
            });
        } catch (error) {
            return res.status(404).json({ error: 'Experiments not found' });
        }

        if (!experimentsResponse.hits || experimentsResponse.hits.total.value === 0) {
            return res.status(404).json({ error: 'Experiments not found' });
        }

        const experiments = experimentsResponse.hits.hits.map(hit => ({
            [hit._id]: {
                id: hit._id,
                ...hit._source
            }

        }));
        res.status(200).json({ experiments });
    } catch (error) {
        console.error('Error retrieving experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.getAsync('/experiments/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        let experimentResponse;
        try {
             experimentResponse = await elasticsearch.get({
                index: 'experiments',
                id: experimentId
            });
        } catch (error){
            return res.status(404).json({ error: 'experiment not found' });
        }

        if (!experimentResponse.found) {
            return res.status(404).json({ error: 'experiment not found' });
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
        console.error('Error retrieving experiment:', error);
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


router.postAsync('/experiments-sort-workflows/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        let experimentResponse;
        try {
            experimentResponse = await elasticsearch.get({
                index: 'experiments',
                id: experimentId
            });
        } catch (error){
            return res.status(404).json({ error: 'Experiment not found' });
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
            index: 'experiments',
            id: experimentId,
            body: { doc:
                    {
                        "workflows": workflowIdList,
                    }
            }
        });
        if (response.result === "updated" || response.result === "noop" ){
            const workflows = await Promise.all(
                workflowIdList.map(async hit => (
                    await getWorkflowById(hit)
                ))
            );
            return res.status(200).json(workflows);
        }
        else{
            return res.status(500).json({ error: 'Internal server error' });
        }


    } catch (error) {
        console.error('Error ordering workflows of experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const EXPERIMENTS_QUERY_SCHEMA = {
    intent: 'string',
    metadata: 'object',
    creator: 'object',
    page: 'number',
    pageSize: 'number',
    sortOrder: 'string'
};

router.postAsync('/experiments-query', async (req, res) => {
    try {
        const validationResult = validateSchema(req.body, EXPERIMENTS_QUERY_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        // Pagination parameters with defaults
        const page = req.body.page || 1;
        const pageSize = req.body.pageSize || 10;
        const from = (page - 1) * pageSize;

        // Sort order parameter (optional): 'asc' or 'desc'
        const sortOrder = req.body.sortOrder && ['asc', 'desc'].includes(req.body.sortOrder.toLowerCase()) 
            ? req.body.sortOrder.toLowerCase() 
            : 'desc';

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
        if (req.body.creator) {
            for (const [key, value] of Object.entries(req.body.creator)) {
                query.bool.must.push({ match: { [`creator.${key}`]: value  } });
            }
        }

        const body = await elasticsearch.search({
            index: 'experiments',
            from: from,
            size: pageSize,
            body: { 
                query,
                sort: [
                    { _id: { order: sortOrder } }
                ]
            }
        });

        const experiments = await Promise.all(body.hits.hits.map(async hit => ({
            [hit._id]: {
                id: hit._id,
                ...hit._source
            }
        })));

        const total = body.hits.total.value;
        const totalPages = Math.ceil(total / pageSize);

        res.status(200).json({
            results: experiments,
            next_page: page < totalPages ? page + 1 : null,
            prev_page: page > 1 ? page - 1 : null
        });
    } catch (error) {
        console.error('Error retrieving experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const EXPERIMENTS_METRICS_SCHEMA = {
    experiment_ids: 'object'
};

router.postAsync('/experiments-metrics', async (req, res) => {
    try {
        const validationResult = validateSchema(req.body, EXPERIMENTS_METRICS_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }

        try {
            if (!req.body.experiment_ids || !Array.isArray(req.body.experiment_ids)) {
                return res.status(400).json({ error: "Invalid schema: 'experiments' field is missing or not an array"});
            }

            try {
                let results = {};
                for (let i=0; i<req.body.experiment_ids.length; i++){
                    let experimentId = req.body.experiment_ids[i];

                    const response = await elasticsearch.search({
                        index: 'metrics',
                        body: {
                            query: {
                                match: {experimentId: experimentId}
                            }
                        }
                    });
                    if (response.hits.hits.length > 0){
                        response.hits.hits.forEach(hit => {
                            let aggregation = aggregatieMetric(hit);
                            if (Object.keys(aggregation).length > 0) {
                                results[hit._id] = {...hit._source, aggregation: aggregation};
                            }
                            else {
                                results[hit._id] = hit._source;
                            }
                        })
                    }
                }


                res.status(200).json({metrics: results});
            }
            catch (error) {
                console.log(error);
                return res.status(400).json({ error: `Error querying metrics for experiment ID: ${experiment.id}: ${error}`});
            }
        }
        catch (error) {
            return res.status(400).json({ error: error});
        }

    } catch (error) {
        console.error('Error retrieving experiments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
