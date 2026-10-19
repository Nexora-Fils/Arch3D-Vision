/** Generates ids on both the browser and the server (Node ≥ 19). */
export const createId = (): string => crypto.randomUUID();
