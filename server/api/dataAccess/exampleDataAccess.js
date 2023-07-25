const { generateNewPromise } = require('../../helpers/promisifier')

// This is where we actually reach out to the different APIs and compose the data.

module.exports ={
  getExample: async (exampleId) => {
    const [promise, resolve, reject] = generateNewPromise();
    if (!exampleId) {
      reject('exampleId is missing');
      return promise;
    }
    resolve(`Here is the example from the Node/Express endpoint GET /getExample. exampleId: ${exampleId}`); // resolve(result)
    return promise;
  }
}