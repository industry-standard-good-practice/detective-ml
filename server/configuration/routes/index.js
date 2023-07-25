const express = require('express');
const exampleRoutes = require('./apiRoutes');

async function initRoutes({ app }) {
    app.use('/api', exampleRoutes);
}

module.exports = { initRoutes }