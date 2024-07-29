'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();
const { addMetadataToQuery } = require('./util.js');

async function updateWorkflowWithTask(taskId, executedWorkflow) {
    try {
        const workflowResponse = await elasticsearch.get({
            index: 'executed_workflows',
            id: executedWorkflow
        });

        const workflow = workflowResponse._source;

        if (!workflow.tasks) {
            workflow.tasks = [];
        }

        if (!workflow.tasks.includes(taskId)) {
            workflow.tasks.push(taskId);

            await elasticsearch.update({
                index: 'executed_workflows',
                id: executedWorkflow,
                body: { doc: { tasks: workflow.tasks } }
            });
        }
    } catch (error) {
        console.error(`Workflow with ID ${executedWorkflow} not found`);
    }
}

router.postAsync('/executed-tasks', async (req, res) => {
    try {
        const {
            id,
            name,
            start,
            end,
            metadata,
            comment,
            executedWorkflow,
            source_code,
            parameters,
            input_datasets,
            metrics,
            output_datasets
        } = req.body;

        if (!name || !start || !end || !executedWorkflow) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            id,
            name,
            start,
            end,
            metadata,
            comment,
            executedWorkflow,
            source_code,
            parameters,
            input_datasets,
            metrics,
            output_datasets
        };

        const response = await elasticsearch.index({
            index: 'executed_tasks',
            body: document
        });

        if (response.result === 'created') {
            await updateWorkflowWithTask(executedWorkflow);
            return res.status(201).json({ message: 'Executed task added successfully', document: response.body });
        } else {
            console.error('Error adding executed task:', response.body);
            return res.status(400).json({ error: 'Failed to add executed task' });
        }
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/executed-tasks', async (req, res) => {
    try {
        const { id, executedWorkflow, start, end } = req.query;

        const query = {
            bool: {
                must: [],
                filter: []
            }
        };

        if (id) {
            query.bool.must.push({ match: { id } });
        }

        if (executedWorkflow) {
            query.bool.filter.push({ term: { executedWorkflow } });
        }

        if (start || end) {
            const range = {};
            if (start) range.gte = start;
            if (end) range.lte = end;
            query.bool.filter.push({ range: { start: range } });
        }

        const metadataAddedSuccessfully = addMetadataToQuery(req, query);
        if (!metadataAddedSuccessfully) {
            return res.status(400).json({ error: 'Mismatched keys and values' });
        }

        const body = await elasticsearch.search({
            index: 'executed_tasks',
            body: { query }
        });

        const executedTasks = body.hits.hits.map(hit => hit._source);

        res.status(200).json(executedTasks);
    } catch (error) {
        console.error('Error retrieving executed tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;