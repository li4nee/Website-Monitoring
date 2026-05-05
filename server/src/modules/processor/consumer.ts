import { ICircuitBreaker } from "../../shared/contracts/infra/resilience/ICircuitBreaker.contract";
import { IRetryStrategy } from "../../shared/contracts/infra/resilience/IRetryStrategy.contract";
import { MongoConnection } from "../../shared/infra/db/mongo/mongoConnection";
import { PostgresConnection } from "../../shared/infra/db/postgres/postgresConnection";
import { AmqpConnection } from "../../shared/infra/messaging/confirmChannelManager";
import { IProcessorService } from "./contracts/IProcessorService.contracts";
import amqp from "amqplib";

export class EventConsumer {
   private processorService: IProcessorService;
   private amqpConnection: AmqpConnection;
   private retryStrategy: IRetryStrategy;
   private circuitBreaker: ICircuitBreaker;
   private mongoDBConnection: MongoConnection;
   private postgresConnection: PostgresConnection;


   private isRunning: boolean = false;
   private channel: amqp.Channel | null = null;
   constructor({
      processorService,
      amqpConnection,
      retryStrategy,
      circuitBreaker,
      mongoDBConnection,
      postgresConnection,
   }: {
      processorService: IProcessorService;
      amqpConnection: AmqpConnection;
      retryStrategy: IRetryStrategy;
      circuitBreaker: ICircuitBreaker;
      mongoDBConnection: MongoConnection;
      postgresConnection: PostgresConnection;
   }) {
      this.processorService = processorService;
      this.amqpConnection = amqpConnection;
      this.retryStrategy = retryStrategy;
      this.circuitBreaker = circuitBreaker;
      this.mongoDBConnection = mongoDBConnection;
      this.postgresConnection = postgresConnection;
   }
}
