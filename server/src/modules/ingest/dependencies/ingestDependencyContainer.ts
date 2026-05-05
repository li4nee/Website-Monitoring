import { IEventProducer } from "../../../shared/contracts/infra/messaging/IEventProducer.contract";
import { amqpAdapter, EventProducerContainer } from "../../../shared/infra/messaging/eventProducerContanier";
import { IIngestService } from "../contracts/IIngestService.contract";
import { IngestController } from "../controllers/ingest.controller";
import { IngestService } from "../services/ingest.service";

export interface IngestDependenciesType {
   controllers: { ingestController: IngestController };
   services: { ingestService: IIngestService };
   providers: { eventProducer: IEventProducer };
}

export class IngestDependencyContainer {
   static init(): IngestDependenciesType {
      const providers = {
         eventProducer: EventProducerContainer.init(amqpAdapter),
      };
      const services = {
         ingestService: new IngestService(providers.eventProducer),
      };
      const controllers = {
         ingestController: new IngestController(services.ingestService),
      };
      return { controllers, services, providers };
   }
}

export const IngestDependencies = IngestDependencyContainer.init();
