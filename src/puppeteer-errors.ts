export class ElementNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElementNotFoundError';
  }
}
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access - login required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
