'use strict';

module.exports = {
  ok: (data) => {
    return {
      status: 'success',
      data,
    };
  },
  err: (message, code = 500) => {
    return {
      status: 'error',
      message,
      code,
    };
  },
};