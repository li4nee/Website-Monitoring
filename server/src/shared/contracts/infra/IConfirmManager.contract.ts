import { ConfirmChannel } from "amqplib";

export interface IConfirmChannelManager {
   getChannel(): Promise<ConfirmChannel>;
   close(): Promise<void>;
}