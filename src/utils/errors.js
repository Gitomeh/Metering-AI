class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class QuotaExceededError extends AppError {
  constructor(message, details = {}) {
    super(message, 429, 'QUOTA_EXCEEDED');
    this.details = details;
  }
}

class PaymentRequiredError extends AppError {
  constructor(message, details = {}) {
    super(message, 402, 'PAYMENT_REQUIRED');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403, 'FORBIDDEN');
  }
}

module.exports = {
  AppError,
  ValidationError,
  QuotaExceededError,
  PaymentRequiredError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
};
