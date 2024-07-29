'use strict';

const em = require('../ivis-core/server/lib/extension-manager');
const slugify = require('slugify');

// Add expvis template extensions
em.on('builder.registerLibs', externals => {
    const id = 'ivisExports_' + slugify("expvis", '_');
    externals['expvis'] = id;
});


require('./extensions-common');
require('../ivis-core/server/services/builder');

