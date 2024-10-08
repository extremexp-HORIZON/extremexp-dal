'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();
const { addMetadataToQuery } = require('./util.js');

async function updateWorkflowWithTask(taskId, workflow) {
    try {
        const workflowResponse = await elasticsearch.get({
            index: 'workflows',
            id: workflow
        });

        const workflow = workflowResponse._source;

        if (!workflow.tasks) {
            workflow.tasks = [];
        }

        if (!workflow.tasks.includes(taskId)) {
            workflow.tasks.push(taskId);

            await elasticsearch.update({
                index: 'workflows',
                id: workflow,
                body: { doc: { tasks: workflow.tasks } }
            });
        }
    } catch (error) {
        console.error(`Workflow with ID ${workflow} not found`);
    }
}

router.postAsync('/tasks', async (req, res) => {
    try {
        const {
            id,
            name,
            start,
            end,
            metadata,
            comment,
            workflow,
            source_code,
            parameters,
            input_datasets,
            metrics,
            output_datasets
        } = req.body;

        if (!name || !start || !end || !workflow) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            id,
            name,
            start,
            end,
            metadata,
            comment,
            workflow,
            source_code,
            parameters,
            input_datasets,
            metrics,
            output_datasets
        };

        const response = await elasticsearch.index({
            index: 'tasks',
            body: document
        });

        if (response.result === 'created') {
            await updateWorkflowWithTask(workflow);
            return res.status(201).json({ message: 'Task added successfully', document: response.body });
        } else {
            console.error('Error adding task:', response.body);
            return res.status(400).json({ error: 'Failed to add task' });
        }
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/tasks', async (req, res) => {
    try {
        const { id, workflow, start, end } = req.query;

        const query = {
            bool: {
                must: [],
                filter: []
            }
        };

        if (id) {
            query.bool.must.push({ match: { id } });
        }

        if (workflow) {
            query.bool.filter.push({ term: { workflow } });
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
            index: 'tasks',
            body: { query }
        });

        const tasks = body.hits.hits.map(hit => hit._source);

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error retrieving tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;