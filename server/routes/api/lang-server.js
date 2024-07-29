'use strict';

const router = require('../../../ivis-core/server/lib/router-async').create();
const add_ws_method = require('express-ws/lib/add-ws-method').default;
const log = require('../../../ivis-core/server/lib/log');
const child_process = require('child_process');
const config = require('../../../ivis-core/server/lib/config');

const jarName = __dirname + "/../../bin/cz.cuni.mff.fitoptivis.dsl.ide-fatjar.jar";


//makes sure the .ws method is actually on the router, regardless of the loading order in the app setup
add_ws_method(router);

router.ws('/fitlang', async(ws, res) => {
    log.info('LSP', 'connection opened');

    const langServerProcess = child_process.spawn(config.java.path, ['-jar', jarName]);

    // if the underlying java process dies, close the websocket
    langServerProcess.on('close', function(err, data) {
        if (err) {
            log.error('LSP', `Error executing LSP jar: ${err} ${data}`);
        } else {
            log.info('LSP', 'LSP jar closing');
        }
        ws.close();
    });

    // if the websocket dies, kill the java process
    ws.on('close', function() {
        langServerProcess.kill();
    });

    langServerProcess.stderr.on('data', function(error) {
        log.error(`LSP jar error: ${error}`);
    });

    langServerProcess.stdin.setDefaultEncoding('utf-8');

    // forward messages to front end
    langServerProcess.stdout.on('data', function(data) {
        //data will be in format:

        // Content-Length: <number>
        // <empty line>
        // <json-rpc message object>

        const output = data.toString();
        const lines = output.split('\n');
        const response = lines[2];

        log.verbose('LSP', `Server -> Client: ${response}`);
        ws.send(response);
    });

    // forward messages from front end
    ws.on('message', function(msg) {
        // the LSP jar requires Content-Length header
        // it is important not to include any trailing whitespace (not even new-line), otherwise the LSP server throws an error
        const to_forward = `Content-Length: ${msg.length}\n\n${msg}`;

        log.verbose('LSP', `Client -> Server: ${msg}`);
        langServerProcess.stdin.write(to_forward);
    });
});

module.exports = router;