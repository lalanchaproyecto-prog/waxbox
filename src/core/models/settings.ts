/**
 * Estado de la configuración personal, tal como lo ve la interfaz.
 *
 * Ojo: aquí nunca viaja la clave de YouTube. La interfaz solo necesita saber
 * si hay una configurada; la clave en sí se queda en el proceso principal.
 */
export interface SettingsStatus {
  /** Si hay una clave de YouTube guardada. */
  youtubeConfigured: boolean
  /** false si el sistema no pudo cifrar la clave, para poder avisarlo. */
  youtubeKeyEncrypted: boolean
}
