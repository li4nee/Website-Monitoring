import { EventDataType } from "../../../shared/typings/messaging.typings";

export interface IProcessorService {
	/**
	 * Process a single event: persist raw event and update endpoint metrics.
	 */
	processEvent(eventData: EventDataType): Promise<void>;
}