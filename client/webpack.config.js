const webpack = require('webpack');
const path = require('path');

const webpackConf = require('../ivis-core/client/webpack.config');

webpackConf.resolve.modules = ['node_modules', '../ivis-core/client/node_modules'];
webpackConf.entry = {
    'index-trusted': ['core-js/stable', 'regenerator-runtime/runtime', './src/root-trusted.js'],
    'index-sandbox': ['core-js/stable', 'regenerator-runtime/runtime', '../ivis-core/client/src/root-sandbox.js']
};

webpackConf.output = {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
};

module.exports = webpackConf;