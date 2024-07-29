'use strict';

const config = require('../../../ivis-core/server/lib/config');
const moment = require('moment');
const knex = require('../../../ivis-core/server/lib/knex');
const router = require('../../../ivis-core/server/lib/router-async').create();
const log = require('../../../ivis-core/server/lib/log');
const signalSets = require('../../../ivis-core/server/models/signal-sets');
const { SignalType } = require('../../../ivis-core/shared/signals');
const contextHelpers = require('../../../ivis-core/server/lib/context-helpers');
const namespaces = require('../../../ivis-core/server/models/namespaces');

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

router.deleteAsync('/signals/:signalSetCid', async (req, res) => {
    await signalSets.removeByCid(req.context, req.params.signalSetCid)
    return res.json();
});

router.postAsync('/signals', async (req, res) => {
    const idField = 'id';

    let batch = req.body;

    if (!Array.isArray(batch)) {
       batch = [batch]
    }

    /*
    {
        "partnerId": "XXXX",
        "signalSetId": "YYYY",
        "schema": {
            "ts": "datetime",
            "sig1": "integer",
            "sig2": "double",
            "sig3": "boolean"
        },
        "data": [
            {
                "id": "0001", "ts" : "2019-02-20T18:25:43.511Z",
                "sig1": 12, "sig2": 34.2, "sig3": true
            },
            {
                "id": "0002", "ts" : "2019-02-20T18:25:44.000Z",
                "sig1": 12, "sig2": 34.2, "sig3": true
            }
        ]
    }

    or

    [ <the above> ]
     */

    for (const batchItem of batch) {
        const partnerId = batchItem.partnerId;
        const sigSetCid = partnerId + ':' + batchItem.signalSetId;

        let partnerNamespace = null;

        await knex.transaction(async tx => {
            const partnerNamespaces = await namespaces.getChildrenTx(tx, contextHelpers.getAdminContext(), config.partners.namespace);
            partnerNamespace = partnerNamespaces.find(entry => entry.name === partnerId);
        });

        if (!partnerNamespace) {
            throw new Error(`Invalid partner id "${partnerId}"`);
        }

        const schema = {};

        for (const cid in batchItem.schema) {
            const type = batchItem.schema[cid];

            if (!(type in typeMapping)) {
                throw new Error(`Unknown type "${type}`);
            }

            schema[cid] = {
                type: typeMapping[type],
                name: cid,
                settings: {},
                indexed: true,
                weight_edit: 0
            };
        }

        const signalSetWithSignalMap = await signalSets.ensure(
            contextHelpers.getAdminContext(),
            sigSetCid,
            schema,
            batchItem.signalSetId,
            '',
            partnerNamespace.id
        );


        const records = [];

        for (const dataEntry of batchItem.data) {
            const record = {
                id: dataEntry[idField],
                signals: {}
            };

            for (const fieldId in dataEntry) {
                if (fieldId !== idField) {
                    if (!(fieldId in signalSetWithSignalMap.signalByCidMap)) {
                        throw new Error(`Unknown data field "${fieldId}`);
                    }

                    let value = dataEntry[fieldId];
                    if (signalSetWithSignalMap.signalByCidMap[fieldId].type === SignalType.DATE_TIME) {
                        value = moment(value);
                    }

                    record.signals[fieldId] = value;
                }
            }

            records.push(record);
        }

        await signalSets.insertRecords(req.context, signalSetWithSignalMap, records);
    }

    return res.json();
});


module.exports = router;
