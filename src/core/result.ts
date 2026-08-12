/**
 * Resultado de una operación que puede fallar.
 *
 * En vez de lanzar un error, las funciones que cruzan de la lógica a la interfaz
 * devuelven este objeto. Así la interfaz siempre recibe algo que puede mostrar,
 * y nunca se rompe por un error inesperado.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
