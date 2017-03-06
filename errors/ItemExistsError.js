module.exports = function ItemExistsError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message || 'The item already exists and cannot be overwritten';
  this.extra = extra;
  this.status = 409;
};

require('util').inherits(module.exports, Error);