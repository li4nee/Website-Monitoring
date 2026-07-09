import { ApiHitsWithId } from "../../../shared/infra/db/mongo/models/apiHits.model";
import { EndpointMetrics } from "../../../shared/infra/db/postgres/postgresTypes";
import { EventConsumer } from "../consumer";
import { IEventConsumer } from "../contracts/IEventConsumer.contract";
import { IProcessorService } from "../contracts/IProcessorService.contracts";
import { MongoApiHitsRepo } from "../repos/apiHits.repo";
import { ApiHitsBaseRepo } from "../repos/apiHitsBase.repo";
import { PgEndPointMetricsRepo } from "../repos/endpointMetrics.repo";
import { EndPointMetricsBaseRepo } from "../repos/endpointMetricsBase.repo";
import { ProcessorService } from "../services/processor.service";
import mongoConnection from "../../../shared/infra/db/mongo/mongoConnection";
import postgresConnection from "../../../shared/infra/db/postgres/postgresConnection";
import redisConnection from "../../../shared/infra/redisConnection";
import { RedisIdempotencyStore } from "../../../shared/infra/redisIdempotencyStore";
import { CircuitBreakerOptions } from "../../../shared/typings/circuitBreaker.typings";
import { globalConfig } from "../../../shared/config/global.config";
import { CircuitBreaker } from "../../../shared/infra/resilience/circuitBreaker.infra";
import { RetryStrategyOptions } from "../../../shared/typings/retry.typings";
import { RetryStrategy } from "../../../shared/infra/resilience/retryStrategy.infra";
import { ConfirmChannelManager } from "../../../shared/infra/messaging/confirmChannelManager";
import { amqpAdapter } from "../../../shared/infra/messaging/eventProducerContanier";
import logger from "../../../shared/config/logger.config";

export interface ProcessorDependenciesType {
   services: { processorService: IProcessorService };
   repos: {
      apiHitRepo: ApiHitsBaseRepo<ApiHitsWithId>;
      endPointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>;
   };
   consumers: {
      eventConsumer: IEventConsumer;
   };
}

export class ProcessorDependenciesContainer {
   static init(): ProcessorDependenciesType {
      const repos = {
         apiHitRepo: new MongoApiHitsRepo(),
         endPointMetricsRepo: new PgEndPointMetricsRepo(),
      };
      const services = {
         processorService: new ProcessorService(repos.apiHitRepo, repos.endPointMetricsRepo),
      };

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
      const channelManager = new ConfirmChannelManager(amqpAdapter);
      const idempotencyStore = new RedisIdempotencyStore(
         redisConnection.getClient(),
         globalConfig.consumer.idempotencyTtlSeconds,
      );
      const consumers = {
         eventConsumer: new EventConsumer({
            processorService: services.processorService,
            amqpConnection: channelManager,
            retryStrategy,
            circuitBreaker,
            mongoDBConnection: mongoConnection,
            postgresConnection: postgresConnection,
            redisConnection: redisConnection,
            idempotencyStore,
         }),
      };

      return {
         repos,
         services,
         consumers,
      };
   }
}

export default ProcessorDependenciesContainer;
