import { CircuitBreakerStatsType } from "../../typings/circuitBreaker.typings";
import { EventProducerMetricsType, PublishingEventDataType, PublishOptions } from "../../typings/messaging.typings";

export interface IEventProducer {
   publishApiHits(eventData: PublishingEventDataType, publishOptions: PublishOptions): Promise<boolean>;
   getMetrics(): { metrics: EventProducerMetricsType; circuitBreakerStats: CircuitBreakerStatsType };
   shutDown(): Promise<void>;
}
