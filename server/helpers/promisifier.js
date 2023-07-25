const generateNewPromise = () => {
  let res;
  let rej;
  const promise = new Promise((resolve, reject) => { res = resolve; rej = reject; });

  return [promise, res, rej];
}

module.exports = { generateNewPromise }