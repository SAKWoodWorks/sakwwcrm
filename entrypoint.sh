#!/bin/sh
node node_modules/.bin/prisma migrate deploy
exec node server.js
