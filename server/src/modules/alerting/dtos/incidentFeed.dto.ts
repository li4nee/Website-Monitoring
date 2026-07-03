export interface IncidentFeedItem {
   _id: string;
   alertId: string;
   alertName: string;
   clientId: string;
   firedAt: Date;
   reasons: string[];
   stats: Record<string, unknown>;
   channelsNotified: string[];
}
