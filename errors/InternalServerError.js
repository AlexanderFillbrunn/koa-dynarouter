module.exports = function InternalServerError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message || 'Internal Server Error';
  this.extra = extra;
  this.status = 500;
};

require('util').inherits(module.exports, Error);