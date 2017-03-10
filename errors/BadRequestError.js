module.exports = function BadRequestError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message || 'Bad request';
  this.extra = extra;
  this.status = 400;
};

require('util').inherits(module.exports, Error);