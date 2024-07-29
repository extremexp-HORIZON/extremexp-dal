'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();

router.postAsync('/output-datasets', async (req, res) => {
    try {
        const {
            executedWorkflowId,
            executedTaskId,
            title,
            url,
            date,
            checksum,
            description
        } = req.body;

        if (!executedWorkflowId || !executedTaskId || !title || !url || !date || !checksum) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            executedWorkflowId,
            executedTaskId,
            title,
            url,
            date,
            checksum,
            description
        };

        const response = await elasticsearch.index({
            index: 'output_datasets',
            body: document
        });

        if(response.result === 'created') {
            res.status(201).json({message: 'Output dataset added successfully', document});
        }
        else{
            res.status(400).json({message: 'Operation failed', response});
        }
    } catch (error) {
        console.error('Error adding output dataset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.getAsync('/output-datasets', async (req, res) => {
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
            index: 'output_datasets',
            body: { query }
        });

        const outputDatasets = body.hits.hits.map(hit => hit._source);

        res.status(200).json(outputDatasets);
    } catch (error) {
        console.error('Error retrieving output datasets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.putAsync('/output-datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            executedWorkflowId,
            executedTaskId,
            title,
            url,
            date,
            checksum,
            description
        } = req.body;

        if (!executedWorkflowId || !executedTaskId || !title || !url || !date || !checksum) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const document = {
            executedWorkflowId,
            executedTaskId,
            title,
            url,
            date,
            checksum,
            description
        };

        const response = await elasticsearch.update({
            index: 'output_datasets',
            id,
            body: {
                doc: document
            }
        });

        if(response.result === 'updated') {
            res.status(201).json({message: 'Output dataset added successfully', document});
        }
        else{
            res.status(400).json({message: 'Operation failed', response});
        }    } catch (error) {
        console.error('Error updating output dataset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
