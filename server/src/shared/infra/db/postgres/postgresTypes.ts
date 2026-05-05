export interface EndpointMetrics {
   id: number;
   client_id: string;
   service_name: string;
   endpoint: string;
   method: string;
   time_bucket: Date;
   total_hits: number;
   error_hits: number;
   min_latency: number;
   max_latency: number;
   total_latency: number;
   created_at: Date;
   updated_at: Date;
}

export interface DB {
   endpoint_metrics: EndpointMetrics;
}
