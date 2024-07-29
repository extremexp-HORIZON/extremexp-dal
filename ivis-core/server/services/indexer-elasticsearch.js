'use strict';

const elasticsearch = require('../lib/elasticsearch');
const knex = require('../lib/knex');
const {getIndexName, getFieldName, createIndex} = require('../lib/indexers/elasticsearch-common');
const {getTableName, getColumnName} = require('../models/signal-storage');
const {IndexingStatus, deserializeFromDb, SignalSource, getTypesBySource, IndexMethod } = require('../../shared/signals');
const log = require('../lib/log');
const signalSets = require('../models/signal-sets');

// Elasticsearch indexer process
// Handles reindex requests
// Message 'index' starts reindexing. If reindexing is currently in progress,
// it is aborted and started again.
// Message 'cancel' aborts reindexing if it is in progress.

// Indexer state
const State = {
    IDLE: 0,      // waiting for command
    INTERRUPT: 1, // current indexing will be aborted
    INDEXING: 2   // currently indexing
}
let state = State.IDLE;

// Number of elements fetched from the database in one query.
const batchSize = 1000;

async function index(cid, method, from) {
    let sigSet;
    let signalByCidMap;

    async function fetchSigSetAndChangeIndexingStatus(status) {
        await knex.transaction(async tx => {
            sigSet = await tx('signal_sets').where('cid', cid).first();
            sigSet.state= JSON.parse(sigSet.state);
            sigSet.state.indexing.status = status;
            await tx('signal_sets').where('cid', cid).update('state', JSON.stringify(sigSet.state));
            signalByCidMap = await signalSets.getSignalByCidMapTx(tx, sigSet);
        });
    }

    log.info('Indexer', 'Reindexing ' + cid);

    await fetchSigSetAndChangeIndexingStatus(IndexingStatus.RUNNING);

    try {
        const indexName = getIndexName(sigSet);

        let last = null;

        if (method === IndexMethod.INCREMENTAL) {
            // Check if index exists
            const exists = await elasticsearch.indices.exists({
                index: indexName
            });

            if (exists) {
                // This counts on id field existing, which is true for values stored in DB, in case of future changes
                // this needs to be updated accordingly
                if (from == null) {
                    const response = await elasticsearch.search({
                        index: indexName,
                        body: {
                            _source: ['id'],
                            sort: {
                                id: {
                                    order: 'desc'
                                }
                            },
                            size: 1
                        }
                    });

                    if (response.hits.hits.length > 0) {
                        last = response.hits.hits[0]._source.id;
                    }
                } else {
                    await elasticsearch.deleteByQuery({
                        index: indexName,
                        body: {
                            "range" : {
                                "id" : {
                                    "gte" : from
                                }
                            }
                        }
                    });
                }
            } else {
                method = IndexMethod.FULL;
            }
        }

        if (method === IndexMethod.FULL) {
            // Delete the old index
            await elasticsearch.indices.delete({
                index: indexName,
                ignore_unavailable: true
            });

            await createIndex(sigSet, signalByCidMap);
        }

        const tableName = getTableName(sigSet);

        while (state === State.INDEXING) {
            // Select items from the signal set

            let query = knex(tableName).orderBy('id', 'asc').limit(batchSize);

            if (last !== null) {
                query = query.where('id', '>', last);
            }

            if (from != null) {
                query = query.where('id', '>=', from);
            }

            const rows = await query.select();

            if (rows.length === 0)
                break;

            log.info('Indexer', `Indexing ${rows.length} records in id interval ${rows[0].id}..${rows[rows.length - 1].id}`);

            const bulk = [];

            for (const row of rows) {
                bulk.push({
                    index: {
                        _index: indexName,
                        _id: row.id
                    }
                });

                const esDoc = {};
                esDoc['id'] = row.id;
                for (const fieldCid in signalByCidMap) {
                    const field = signalByCidMap[fieldCid];
                    if (getTypesBySource(SignalSource.RAW).includes(field.type)) {
                        esDoc[getFieldName(field.id)] = deserializeFromDb[field.type](row[getColumnName(field.id)]);
                    }
                }

                bulk.push(esDoc);
            }

            await elasticsearch.bulk({body: bulk});

            last = rows[rows.length - 1].id;
        }
    }
    catch (err) {
        // In case of error, require reindexing
        await fetchSigSetAndChangeIndexingStatus(IndexingStatus.REQUIRED);
        log.info('Indexer', 'Failed ' + cid);
        throw err;
    }

    const success = (state === State.INDEXING);
    await fetchSigSetAndChangeIndexingStatus(success ? IndexingStatus.READY : IndexingStatus.REQUIRED);
    log.info('Indexer', (success ? 'Indexed ' : 'Interrupted ') + cid);
}

const workQueue = [];
let currentWork = null;

async function perform() {
    log.info('Indexer', 'Indexing started');

    while (workQueue.length > 0) {
        state = State.INDEXING;
        currentWork = workQueue.pop();
        try {
            await index(currentWork.cid, currentWork.method, currentWork.from);
            process.send({
                type: 'index',
                cid: currentWork.cid
            });
        }
        catch (err) {
            log.error('Indexer', err);
        }
        currentWork = null;
    }
    log.info('Indexer', 'Indexing finished');
    state = State.IDLE;
}

process.on('message', msg => {
    if (msg) {
        const type = msg.type;
        if (type === 'index') {
            const cid = msg.cid;
            const method = msg.method;
            const from = msg.from;

            let existsInQueue = false;
            for (const wqEntry of workQueue) {
                if (wqEntry.cid === cid) {
                    log.info('Indexer', 'Rescheduled indexing of ' + cid);

                    if (wqEntry.method === IndexMethod.INCREMENTAL && method === IndexMethod.FULL) {
                        wqEntry.method = IndexMethod.FULL;
                    }

                    if (from === undefined || (wqEntry.from !== undefined && from < wqEntry.from)) {
                        wqEntry.from = from;
                    }

                    existsInQueue = true;
                }
            }

            if (!existsInQueue) {
                log.info('Indexer', 'Scheduled indexing of ' + cid);
                workQueue.push({cid, method});

                if (currentWork && currentWork.cid === cid && currentWork.method === IndexMethod.FULL && method === IndexMethod.FULL) {
                    state = State.INTERRUPT;
                    log.info('Indexer', 'Restarting current indexing');
                }
                else if (state === State.IDLE) {
                    state = 'start';

                    // noinspection JSIgnoredPromiseFromCall
                    perform();
                }
            }

        }
        else if (type === 'cancel-index') {
            const cid = msg.cid;

            let j = 0;
            workQueue.forEach((v,i) => {
                if (v.cid === cid){
                    log.info('Indexer', 'Unscheduled indexing of ' + cid);
                } else {
                    if (i!==j){
                        workQueue[j] = v;
                    }
                    j++;
                }
            });
            workQueue.length = j;

            if (currentWork === cid) {
                state = State.INTERRUPT;
                log.info('Indexer', 'Cancelling current indexing');
            }
        }

        else if (type === 'cancel-all') {
            // Cancel current operation, empty queue
            log.info('Indexer', 'Cancelling all indexing');
            workQueue.length = 0;
            if (currentWork !== null) {
                state = State.INTERRUPT;
            }
        }

    }
});

process.send({
    type: 'started'
});
