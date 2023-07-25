const express = require('express');
const router = new express.Router();
const exampleController = require('../../api/controller/exampleController')

router.get('/getExample/:exampleId', exampleController.getExample);

module.exports = router;