module.exports = function AccessDeniedError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message || 'Access denied';
  this.extra = extra;
  this.status = 403;
};

require('util').inherits(module.exports, Error);