/**
 * Tracks which message IDs have already been *successfully* processed, so a
 * message redelivered by the broker (e.g. after a nack/requeue or a consumer
 * crash before ack) isn't double-applied. Must be shared across consumer
 * instances (hence Redis-backed rather than an in-process Set) so horizontally
 * scaling the consumer doesn't reintroduce duplicate processing.
 *
 * Deliberately two separate calls rather than one atomic check-and-set: this
 * consumer's own retry path re-publishes a failed message with the SAME
 * messageId (see EventConsumer.retryMessage), and that message must still be
 * processed when it comes back around. Only marking success — not "seen" —
 * keeps that legitimate retry working, at the cost of a narrow, acceptable
 * race window across instances for true duplicate deliveries.
 */
export interface IIdempotencyStore {
   hasProcessed(messageId: string): Promise<boolean>;
   markProcessed(messageId: string): Promise<void>;
}
