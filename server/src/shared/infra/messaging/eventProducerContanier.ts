import { globalConfig } from "../../config/global.config";
import { AmqpConnection, ConfirmChannelManager } from "./confirmChannelManager";
import { EventProducer } from "./eventProducer";
import amqpConnection from "../amqpConnection";
import { ChannelModel } from "amqplib";
import { ResourceNotInitializedError } from "../../typings/error.typings";
import { RetryStrategyOptions } from "../../typings/retry.typings";
import { CircuitBreakerOptions } from "../../typings/circuitBreaker.typings";
import { CircuitBreaker } from "../resilience/circuitBreaker.infra";
import { RetryStrategy } from "../resilience/retryStrategy.infra";

export const amqpAdapter: AmqpConnection = {
   async connect(): Promise<{ connection: ChannelModel }> {
      await amqpConnection.connect();

      const conn = amqpConnection.Connection;

      if (!conn) {
         throw new ResourceNotInitializedError("AMQP connection not initialized");
      }

      return { connection: conn };
   },

   get connection() {
      return amqpConnection.Connection ?? undefined;
   },
};

export class EventProducerContainer {
   static init(amqp: AmqpConnection): EventProducer {
      const circuitBreakerOptions: CircuitBreakerOptions = {
         failureThreshold: globalConfig.infra.circuitBreakerFailureThreshold || 5,
         cooldownTimeInMs: globalConfig.infra.circuitBreakerCooldownTimeInMs, // 30 seconds
         halfOpenStateMaxAttempts: globalConfig.infra.circuitBreakerHalfOpenStateMaxAttempts || 2,
      };
      const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);

      const retryStrategyOptions: RetryStrategyOptions = {
         maxRetries: globalConfig.infra.retryAttempts || 5,
         baseRetryDelayInMs: globalConfig.infra.retryDelay || 1000, // 1 second
         maxRetryDelayInMs: globalConfig.infra.maxRetryDelay || 30000, // 30 seconds
         jitterFactor: globalConfig.infra.jitterFactor || 0.3, // 30% jitter
      };
      const retryStrategy = new RetryStrategy(retryStrategyOptions);
      const queueName = globalConfig.amqp.queue || "default_queue";

      const channelManager = new ConfirmChannelManager(amqp);
      return new EventProducer(channelManager, circuitBreaker, retryStrategy, queueName);
   }
}
