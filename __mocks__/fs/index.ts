const { fs } = require('memfs');

module.exports = {
  ...fs,
  createWriteStream: jest.fn()
    .mockImplementation(fs.createWriteStream),
};
