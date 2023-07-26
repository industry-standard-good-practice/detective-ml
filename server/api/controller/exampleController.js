const exampleDataAccess = require('../dataAccess/exampleDataAccess');

module.exports = {
  getExample: async (req, res, next) => {
    const exampleId = req.params && req.params.exampleId;
    if (!exampleId) {
      res.status(404).send('exampleId is missing')
    }
    await exampleDataAccess.getExample(exampleId)
      .then(data => {
        res.status(200).send(data);
        next();
      })
      .catch(error => next(error));
  }
}