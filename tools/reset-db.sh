#!/bin/sh

sudo mysql -e 'drop database expvis; create database expvis; connect expvis; \. tools/expvis-XXXX-XX-XX-dump.sql'
