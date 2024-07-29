'use strict';

require('./extensions-common');
const em = require('../ivis-core/server/lib/extension-manager');
const express_ws = require('express-ws');
const languageServer = require('./routes/api/lang-server');

const path = require('path');

em.set('app.clientDist', path.join(__dirname, '..', 'client', 'dist'));

// DB migrations
em.on('knex.migrate', async () => {
    const knex = require('../ivis-core/server/lib/knex');
    await knex.migrateExtension('expvis', './knex/migrations').latest();
    console.log("migrate");
});

// Entity setup
/*em.on('entitySettings.updateEntities', entityTypes => {
    console.log("update");
    entityTypes.model = {
        entitiesTable: 'models',
        sharesTable: 'shares_model',
        permissionsTable: 'permissions_model',
        clientLink: ({id}) => `/settings/models/${id}`
    }
    console.log("update");
});*/

// Normal routes
em.on('app.installRoutes', app => {
    /*const modelsRest = require('./routes/rest/models');
    app.use('/rest', modelsRest);
    app.use('/dsl', languageServer);*/

    console.log("install");
});

// API routes
em.on('app.installAPIRoutes', app => {
    console.log("install api");
    const signalsApi = require('./routes/api/signals');
    const executedExperimentsApi = require('./routes/api/executed-experiments');
    const executedWorkflowsApi = require('./routes/api/executed-workflows');
    const executedTasksApi = require('./routes/api/executed-tasks');
    const metricsApi = require('./routes/api/metrics');
    const parametersApi = require('./routes/api/parameters');
    const inputDatasetsApi = require('./routes/api/input-datasets');
    const outputDatasetsApi = require('./routes/api/output-datasets');

    console.log("install api");
    app.use('/api', signalsApi);
    app.use('/api', executedWorkflowsApi);
    app.use('/api', executedExperimentsApi);
    app.use('/api', executedTasksApi);
    app.use('/api', metricsApi);
    app.use('/api', parametersApi);
    app.use('/api', inputDatasetsApi);
    app.use('/api', outputDatasetsApi);
    console.log("install api");
});

// Enable websocket upgrade
em.on('server.setup', (server, app) => {
    console.log("setup");
    express_ws(app, server, {
        leaveRouterUntouched : true
    });
    console.log("setup");
});

console.log("set");
// denote which tables reference namespace - in order to make migration 202004110000_change_namesapce_id_type work.
/*em.set('knex.table.namespaceReferences', [{
    tableName: 'models',
    columnName: 'namespace'
}]);*/
console.log("set");

require('../ivis-core/server/index');
const executedWorkflowsApi = require("./routes/api/executed-workflows");

