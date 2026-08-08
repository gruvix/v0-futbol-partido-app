/** Thrown when outbound email fails. No internal/provider details in message. */
export class EmailSendError extends Error {
  constructor() {
    super('EMAIL_SEND_FAILED')
    this.name = 'EmailSendError'
  }
}
