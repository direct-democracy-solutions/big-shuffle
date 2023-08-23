const { fs } = require('memfs');

module.exports = {
  ...fs.promises,
  open: jest.fn()
    .mockImplementation((...args) => fs.promises.open(...args)),
  readFile: jest.fn()
    .mockImplementation((...args) => fs.promises.readFile(...args)),
  unlink: jest.fn()
    .mockImplementation((...args) => fs.promises.unlink(...args)),
  rm: jest.fn()
    .mockImplementation((...args) => fs.promises.rm(...args)),
};
