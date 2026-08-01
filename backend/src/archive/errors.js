// Arşiv hata tipleri — servis/route katmanı bunlara göre HTTP kodu seçer.

export class ImmutableError extends Error {
  constructor(message) { super(message); this.name = 'ImmutableError'; this.code = 'IMMUTABLE'; }
}

export class AlreadyExistsError extends Error {
  constructor(message) { super(message); this.name = 'AlreadyExistsError'; this.code = 'ALREADY_EXISTS'; }
}

export class NotFoundError extends Error {
  constructor(message) { super(message); this.name = 'NotFoundError'; this.code = 'NOT_FOUND'; }
}

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; this.code = 'VALIDATION'; }
}
