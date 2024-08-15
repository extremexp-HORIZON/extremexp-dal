#! /bin/bash
export DMS_PATH=$(pwd)/services/dms
cd server

NODE_ENV=development node index.js
