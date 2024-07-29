'use strict';

const elasticsearch = require('../../../ivis-core/server/lib/elasticsearch');
const router = require('../../../ivis-core/server/lib/router-async').create();
const signalSets = require('../../../ivis-core/server/models/signal-sets');

const config = require('../../../ivis-core/server/lib/config');
const moment = require('moment');
const knex = require('../../../ivis-core/server/lib/knex');
const log = require('../../../ivis-core/server/lib/log');
const { SignalType } = require('../../../ivis-core/shared/signals');
const contextHelpers = require('../../../ivis-core/server/lib/context-helpers');
const namespaces = require('../../../ivis-core/server/models/namespaces');
const {validateSchema} = require("./util");

const typeMapping = {
    datetime: SignalType.DATE_TIME,
    integer: SignalType.INTEGER,
    long: SignalType.LONG,
    float: SignalType.FLOAT,
    double: SignalType.DOUBLE,
    string: SignalType.KEYWORD,
    text: SignalType.TEXT,
    boolean: SignalType.BOOLEAN
};

const METRIC_DEFINITION_SCHEMA = {
    schema: 'object',
    name: 'string'
};

router.putAsync('/metrics', async (req, res) => {
    const batchItem = req.body;

    if (Array.isArray(batchItem)) {
        return res.status(400).json("Only a single metric is allowed");
    }

    const validationResult = validateSchema(batchItem, METRIC_DEFINITION_SCHEMA);
    if (validationResult) {
        return res.status(400).json({ error: `Validation error: ${validationResult}` });
    }

    if (batchItem.name === undefined) {
        return res.status(400).json("Please specify metricId");
    }

    const sigSetCid = batchItem.name;
    console.log("sigSetCid " + sigSetCid);

    if (batchItem.data !== undefined) {
        return res.status(400).json("This endpoint does not support data addition");
    }

    const schema = {};

    for (const cid in batchItem.schema) {
        const type = batchItem.schema[cid];

        if (!(type in typeMapping)) {
            return res.status(400).json("Unknown type " + type);
        }

        schema[cid] = {
            type: typeMapping[type],
            name: cid,
            settings: {},
            indexed: true,
            weight_edit: 0
        };
    }

    try {
        if (await signalSets.getByCid(req.context, batchItem.name) !== undefined) {
            return res.status(400).json({error: 'Metric already exists'});
        }
    } catch(error){

    }

    try {
        await signalSets.ensure(
            contextHelpers.getAdminContext(),
            {
                cid: sigSetCid,
                //FIXME, MA: what is the purpose of the below line?
                name: batchItem.hasOwnProperty('name') ? batchItem.name : batchItem.name,
                description: batchItem.hasOwnProperty('description') ? batchItem.description : '',
                namespace: 1,
            },
            schema
        );
    } catch (error) {
        console.error('Error creating metric:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

    return res.json("Metric created successfully!");
});

router.getAsync('/metrics/:metricId', async (req, res) => {
    try {
        const { metricId } = req.params;

        const signalSet = await signalSets.getByCid(req.context, metricId,true,true);
        if (!signalSet) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const result = {
            name: signalSet.name,
            schema: Object.keys(signalSet.signalByCidMap).reduce((acc, cid) => {
                acc[cid] = signalSet.signalByCidMap[cid].type;
                return acc;
            }, {})
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving metric:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const METRIC_DATA_SCHEMA = {
    schema: 'object',
    data: 'object',
};

router.putAsync('/metrics/:metricId', async (req, res) => {
    const idField = 'id';
    const metricId = req.params.metricId;

    let batch = req.body;

    if (!Array.isArray(batch)) {
        batch = [batch];
    }

    for (const batchItem of batch) {
        const validationResult = validateSchema(batchItem, METRIC_DATA_SCHEMA);
        if (validationResult) {
            return res.status(400).json({ error: `Validation error: ${validationResult}` });
        }
    }

    try{
        const signalSetWithSignalMap = await signalSets.getByCid(req.context, metricId,true,true);
        console.log(signalSetWithSignalMap);
        if (!signalSetWithSignalMap) {
            console.error('Metric not found for metricId:', metricId);
            return res.status(404).json({ error: 'Metric not found' });
        }

        if (!signalSetWithSignalMap.signalByCidMap) {
            console.error('signalByCidMap is undefined for metricId:', metricId);
            return res.status(500).json({ error: 'signalByCidMap is undefined' });
        }

        for (const batchItem of batch) {
            const records = [];

            if (batchItem.schema !== undefined) {
                return res.status(400).json("This endpoint does not support schema definition");
            }

            if (batchItem.data === undefined) {
                return res.status(400).json("Please provide data");
            }

            for (const dataEntry of batchItem.data) {
                const record = {
                    id: dataEntry.id,
                    signals: {}
                };

                const missingAttributes = [];
                for (const fieldId in dataEntry) {
                    if (fieldId !== idField) {
                        if (!(fieldId in signalSetWithSignalMap.signalByCidMap)) {
                            missingAttributes.push(fieldId);
                        }
                    }
                }

                if (missingAttributes.length > 0) {
                    return res.status(400).json("Attributes " + missingAttributes + " not specified in schema!");
                }

                for (const fieldId in dataEntry) {
                    if (fieldId !== idField) {
                        let value = dataEntry[fieldId];
                        if (signalSetWithSignalMap.signalByCidMap[fieldId].type === SignalType.DATE_TIME) {
                            value = moment(value);
                        }

                        record.signals[fieldId] = value;
                    }
                }

                records.push(record);
            }

            try {
                await signalSets.insertRecords(req.context, signalSetWithSignalMap, records);
            } catch (error) {
                console.error('Error adding records:', error);

                if (error.message.includes('ER_DUP_ENTRY')) {
                    return res.status(400).json({ error: 'Duplicate entry detected', details: error.message });
                }

                return res.status(500).json({ error: 'Internal server error' });
            }
        }

        return res.json("Records added successfully!");
    } catch (error) {
        console.error('Error fetching metric:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/metrics-query/:metricId', async (req, res) => {
    try {
        const { metricId } = req.params;
        const { startDate, count, timeAttribute, attribute } = req.body;
        const numSamples = count ? parseInt(count) : 100;

        if (!attribute || (Array.isArray(attribute) && attribute.length === 0)) {
            return res.status(400).json({ error: 'Please provide at least one attribute' });
        }

        const signalsArray = Array.isArray(attribute) ? attribute : [attribute];

        const signalSet = await signalSets.getByCid(req.context, metricId);
        if (!signalSet) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        const query = {
            params: {
                withId: true
            },
            sigSetCid: metricId,
            filter: {
                type: "and",
                children: []
            },
            docs: {
                signals: signalsArray,
                limit: numSamples,
                sort: []
            }
        };

        if (startDate && timeAttribute) {
            query.filter.children.push({
                type: "range",
                sigCid: timeAttribute,
                gte: startDate
            });
        }

        const records = await signalSets.query(req.context, [query]);
        return res.status(200).json(records[0].docs);
    } catch (error) {
        if (error.message.includes('Permission denied')) {
            return res.status(400).json({ error: 'Permission denied', details: error.message });
        }

        console.error('Error retrieving metrics:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.postAsync('/metrics-query', async (req, res) => {
    try {
        const { experimentId, workflowId , metadata} = req.body;

        const mustConditions = [];

        if (experimentId) {
            mustConditions.push({ match: { 'experimentId': experimentId } });
        }

        if (workflowId) {
            mustConditions.push({ match: { 'workflowId': workflowId } });
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                mustConditions.push({
                    nested: {
                        path: 'metrics.metadata',
                        query: {
                            bool: {
                                must: [
                                    { match: { [`metrics.metadata.${key}`]: value } }
                                ]
                            }
                        }
                    }
                });
            }
        }

        const query = {
            bool: {
                must: mustConditions
            }
        };

        const response = await elasticsearch.search({
            index: 'executed_workflows',
            body: {
                query
            }
        });

        const metrics = response.hits.hits.flatMap(hit => {
            const source = hit._source;
            if (source.metrics) {
                return source.metrics.filter(metric => {
                    if (metadata) {
                        return Object.entries(metadata).every(([key, value]) => {
                            return metric.metadata && metric.metadata[key] === value;
                        });
                    }
                    return true;
                }).map(metric => {
                    if (metric.type === 'scalar') {
                        return {
                            ...metric,
                            value: metric.value
                        };
                    }
                    return metric;
                });
            }
            return [];
        });

        res.status(200).json(metrics);
    } catch (error) {
        if (error.message.includes('Permission denied')) {
            return res.status(400).json({ error: 'Permission denied', details: error.message });
        }

        console.error('Error retrieving metrics:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


/*router.postAsync('/metrics-query', async (req, res) => {
    try {
        const { experimentId, workflowId, startDate, count, timeAttribute, attribute } = req.body;
        const numSamples = count ? parseInt(count) : 100;

        const mustConditions = [];

        if (experimentId) {
            mustConditions.push({ match: { 'metadata.experimentId': experimentId } });
        }

        if (workflowId) {
            mustConditions.push({ match: { 'metadata.workflowId': workflowId } });
        }

        if (mustConditions.length === 0) {
            return res.status(400).json({ error: 'Please provide at least experimentId, workflowId, or metricId' });
        }

        if (metricId) {
            if (!attribute || (Array.isArray(attribute) && attribute.length === 0)) {
                return res.status(400).json({ error: 'Please provide at least one attribute' });
            }

            const signalsArray = Array.isArray(attribute) ? attribute : [attribute];

            const signalSet = await signalSets.getByCid(req.context, metricId);
            if (!signalSet) {
                return res.status(404).json({ error: 'Metric not found' });
            }

            const query = {
                params: {
                    withId: true
                },
                sigSetCid: metricId,
                filter: {
                    type: "and",
                    children: mustConditions
                },
                docs: {
                    signals: signalsArray,
                    limit: numSamples,
                    sort: []
                }
            };

            if (startDate && timeAttribute) {
                query.filter.children.push({
                    type: "range",
                    sigCid: timeAttribute,
                    gte: startDate
                });
            }

            const records = await signalSets.query(req.context, [query]);
            return res.status(200).json(records[0].docs);
        } else {
            // Perform general metadata query
            const client = await elasticsearch.getClientAsync();

            const searchParams = {
                index: 'metrics',
                body: {
                    query: {
                        bool: {
                            must: mustConditions
                        }
                    }
                }
            };

            const { body: { hits } } = await client.search(searchParams);
            const results = hits.hits.map(hit => hit._source);
            return res.status(200).json(results);
        }
    } catch (error) {
        if (error.message.includes('Permission denied')) {
            return res.status(400).json({ error: 'Permission denied', details: error.message });
        }

        console.error('Error retrieving metrics:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});*/

module.exports = router;
