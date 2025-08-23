class ElementNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ElementNotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access - login required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

module.exports = {
  ElementNotFoundError,
  UnauthorizedError
};
