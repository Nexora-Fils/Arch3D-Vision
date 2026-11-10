export class UnauthorizedError extends Error {
  constructor() {
    super("Connexion requise");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Accès refusé : ce projet n'appartient pas à votre compte");
    this.name = "ForbiddenError";
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("Un compte existe déjà avec cette adresse e-mail");
    this.name = "EmailTakenError";
  }
}
