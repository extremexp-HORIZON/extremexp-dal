'use strict';

const em = require('../ivis-core/server/lib/extension-manager');
const path = require('path');

em.set('config.extraDirs', [ path.join(__dirname, 'config') ]);
em.set('builder.exec', path.join(__dirname, 'builder.js'));
em.set('task-handler.exec', path.join(__dirname, 'task-handler.js'));
em.set('indexer.elasticsearch.exec', path.join(__dirname, 'indexer-elasticsearch.js'));
em.set('app.title', 'Ivis for ExtremeXP');
