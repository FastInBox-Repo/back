import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainError extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(code: string, message = 'Resource not found') {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictDomainError extends DomainError {
  constructor(code: string, message = 'Conflict on current resource state') {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(code: string, message = 'Action not allowed for current actor') {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class UnauthorizedDomainError extends DomainError {
  constructor(code: string, message = 'Authentication required or invalid') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ValidationDomainError extends DomainError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class TooManyRequestsDomainError extends DomainError {
  constructor(
    code = 'RATE_LIMITED',
    message = 'Too many requests. Please slow down.',
    details?: unknown,
  ) {
    super(code, message, HttpStatus.TOO_MANY_REQUESTS, details);
  }
}
