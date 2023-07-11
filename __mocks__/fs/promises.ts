const { fs } = require('memfs');

module.exports = {
  ...fs.promises,
  open: jest.fn()
    .mockImplementation((...args) => fs.promises.open(...args)),
};
