'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();

router.postAsync('/parameters', async (req, res) => {
    try {
        const { workflowId, taskId, name, value, date } = req.body;

        if (!workflowId || !taskId || !name || !value || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            workflowId,
            taskId,
            name,
            value,
            date
        };

        const response = await elasticsearch.index({
            index: 'parameters',
            body: document
        });

        if (response.result === 'created') {
            res.status(201).json({ message: 'Parameter added successfully', document });
        } else {
            console.error('Error adding task:', response.body);
            return res.status(400).json({ error: 'Failed to add parameter' });
        }
    } catch (error) {
        console.error('Error adding parameter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/parameters', async (req, res) => {
    try {
        const { workflowId, taskId, name } = req.query;

        const query = {
            bool: {
                must: []
            }
        };

        if (workflowId) {
            query.bool.must.push({ match: { workflowId } });
        }

        if (taskId) {
            query.bool.must.push({ match: { taskId } });
        }

        if (name) {
            query.bool.must.push({ match: { name } });
        }

        const body = await elasticsearch.search({
            index: 'parameters',
            body: { query }
        });

        const parameters = body.hits.hits.map(hit => hit._source);

        res.status(200).json(parameters);
    } catch (error) {
        console.error('Error retrieving parameters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.putAsync('/parameters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { workflowId, taskId, name, value, date } = req.body;

        if (!workflowId || !taskId || !name || !value || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            workflowId,
            taskId,
            name,
            value,
            date
        };

        const response = await elasticsearch.update({
            index: 'parameters',
            id,
            body: {
                doc: document
            }
        });

        if (response.result === 'created') {
            res.status(200).json({ message: 'Parameter updated successfully', document });
        } else {
            console.error('Error adding task:', response.body);
            return res.status(400).json({error: 'Failed to add parameter'});
        }
    } catch (error) {
        console.error('Error updating parameter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
