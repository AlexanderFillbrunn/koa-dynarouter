module.exports = function NotFoundError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message || 'Resource not found';
  this.extra = extra;
  this.status = 404;
};

require('util').inherits(module.exports, Error);