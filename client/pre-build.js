'use strict';

const slugify = require('slugify');
const webpackShared = require('../ivis-core/shared/webpack');
const fs = require('fs');
const path = require('path');

let content = '';

const libTypePathMapping = {
    'internal' : '../src/',
    'external' : '',
    'extension' : '../../../client/src/'
};

// make sure additional elements are exported too
let libs = webpackShared.libs;
const id = 'ivisExports_' + slugify('expvis', '_');
libs.push({
    id,
    lib: 'expvis',
    path: 'expvis/expvis',
    type: 'extension'
});

for (const lib of libs) {
    const pathPrefix = libTypePathMapping[lib.type];
    content += `global.${lib.id} = require('${pathPrefix + lib.path}');\n`;
}

fs.writeFileSync(path.join(__dirname, '..', 'ivis-core', 'client', 'generated', 'ivis-exports.js'), content);