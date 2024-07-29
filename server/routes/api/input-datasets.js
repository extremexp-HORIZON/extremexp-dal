'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();

router.postAsync('/input-datasets', async (req, res) => {
    try {
        const {
            executedWorkflowId,
            executedTaskId,
            title,
            uri,
            date,
            checksum
        } = req.body;

        if (!executedWorkflowId || !executedTaskId || !title || !uri || !date || !checksum) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            executedWorkflowId,
            executedTaskId,
            title,
            uri,
            date,
            checksum
        };

        const response = await elasticsearch.index({
            index: 'input_datasets',
            body: document
        });

        if(response.result === 'created') {
            res.status(201).json({message: 'Input dataset added successfully', document});
        }
        else{
            res.status(400).json({message: 'Operation failed', response});
        }
    } catch (error) {
        console.error('Error adding input dataset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/input-datasets', async (req, res) => {
    try {
        const { executedWorkflowId, executedTaskId } = req.query;

        const query = {
            bool: {
                must: []
            }
        };

        if (executedWorkflowId) {
            query.bool.must.push({ match: { executedWorkflowId } });
        }

        if (executedTaskId) {
            query.bool.must.push({ match: { executedTaskId } });
        }

        const body = await elasticsearch.search({
            index: 'input_datasets',
            body: { query }
        });

        const inputDatasets = body.hits.hits.map(hit => hit._source);

        res.status(200).json(inputDatasets);
    } catch (error) {
        console.error('Error retrieving input datasets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.putAsync('/input-datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            executedWorkflowId,
            executedTaskId,
            title,
            uri,
            date,
            checksum
        } = req.body;

        if (!executedWorkflowId || !executedTaskId || !title || !uri || !date || !checksum) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            executedWorkflowId,
            executedTaskId,
            title,
            uri,
            date,
            checksum
        };


        const response = await elasticsearch.update({
            index: 'input_datasets',
            id,
            body: {
                doc: document
            }
        });
        if(response.result === 'updated') {
            res.status(201).json({message: 'Input dataset updated successfully', document});
        }
        else{
            res.status(400).json({message: 'Operation failed', response});
        }
    } catch (error) {
        console.error('Error updating input dataset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
