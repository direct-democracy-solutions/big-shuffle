const promises = require('memfs').promises;

module.exports = {
  ...promises,
  open: jest.fn()
    .mockImplementation((...args) => promises.open(...args)),
  readFile: jest.fn()
    .mockImplementation((...args) => promises.readFile(...args)),
  unlink: jest.fn()
    .mockImplementation((...args) => promises.unlink(...args)),
  rm: jest.fn()
    .mockImplementation((...args) => promises.rm(...args)),
};
