'use strict';

require('./extensions-common');
require('../ivis-core/server/services/indexer-elasticsearch');


async function initExecutedWorkflowsIndex() {
    try {
        const indexExists = await elasticsearch.indices.exists({ index: 'executed_workflows' });
        if (!indexExists) {
            await elasticsearch.indices.create({
                index: 'executed_workflows',
                body: {
                    mappings: {
                        properties: {
                            executedWorkflows: {
                                type: 'nested',
                                properties: {
                                    id: { type: 'keyword' },
                                    name: { type: 'text' },
                                    deployedWorkflow: { type: 'keyword' },
                                    start: { type: 'date' },
                                    end: { type: 'date' },
                                    characteristics: { type: 'object' },
                                    comment: { type: 'text' },
                                    executedTasks: { type: 'keyword' }
                                }
                            }
                        }
                    }
                }
            });
            log.info('Executed workflows index initialized successfully.');
        } else {
            log.info('Executed workflows index already exists.');
        }
    } catch (error) {
        log.error('Error initializing executed workflows index:', error);
    }
}

async function deleteExecutedWorkflowsIndex() {
    try {
        const indexExists = await elasticsearch.indices.exists({ index: 'executed_workflows' });
        if (indexExists) {
            await elasticsearch.indices.delete({ index: 'executed_workflows' });
            log.info('Executed workflows index deleted successfully.');
        } else {
            log.info('Executed workflows index did not exist.');
        }
    } catch (error) {
        log.error('Error deleting executed workflows index:', error);
    }
}

async function initExecutedTasksIndex() {
    try {
        const indexExists = await elasticsearch.indices.exists({ index: 'executed_tasks' });
        if (!indexExists) {
            await elasticsearch.indices.create({
                index: 'executed_tasks',
                body: {
                    mappings: {
                        properties: {
                            id: { type: 'keyword' },
                            name: { type: 'text' },
                            start: { type: 'date' },
                            end: { type: 'date' },
                            characteristics: { type: 'object' },
                            comment: { type: 'text' },
                            executedWorkflow: { type: 'keyword' },
                            source_code: { type: 'text' },
                            parameters: { type: 'object' },
                            input_datasets: { type: 'object' },
                            metrics: { type: 'object' },
                            output_datasets: { type: 'object' }
                        }
                    }
                }
            });
            log.info('Tasks index initialized successfully.');
        } else {
            log.info('Tasks index already exists.');
        }
    } catch (error) {
        log.error('Error initializing tasks index:', error);
    }
}

async function deleteTasksIndex() {
    try {
        const indexExists = await elasticsearch.indices.exists({ index: 'tasks' });
        if (indexExists) {
            await elasticsearch.indices.delete({ index: 'tasks' });
            log.info('Tasks index deleted successfully.');
        } else {
            log.info('Tasks index did not exist.');
        }
    } catch (error) {
        log.error('Error deleting tasks index:', error);
    }
}
