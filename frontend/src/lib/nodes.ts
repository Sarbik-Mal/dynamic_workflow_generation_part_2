export const NODE_TYPES = {
  csv_reader: { label: 'CSV Reader', icon: 'FileText', color: 'red', desc: 'Primary Source. Entry point for raw file streams. Use as the start of a processing chain.' },
  json_transformer: { label: 'JSON Transformer', icon: 'Code', color: 'orange', desc: 'Data Processor. Consolidates multiple sources (SQL/REST) into JSON. Central hub for merging data.' },
  data_filter: { label: 'Data Filter', icon: 'Filter', color: 'yellow', desc: 'Logical Gate. Filters streams based on criteria. Place between Sources and Sinks to ensure data quality.' },
  sql_source: { label: 'SQL Source', icon: 'Database', color: 'green', desc: 'Primary Source. Fetches live records from relational databases. Starting node for transaction flows.' },
  mongodb_sink: { label: 'MongoDB Sink', icon: 'Database', color: 'blue', desc: 'Terminal Node. Final destination for processed data. Usually at the end of a successful chain.' },
  postgres_sink: { label: 'Postgres Sink', icon: 'Database', color: 'indigo', desc: 'Terminal Node. Stores structured relational data. Use as a final step for persistence.' },
  s3_storage: { label: 'S3 Storage', icon: 'Cloud', color: 'violet', desc: 'Terminal/Backup Node. Archiving point for files. Typically terminal or a branch of a successful processing step.' },
  rest_api: { label: 'REST API', icon: 'Globe', color: 'slate-400', desc: 'Primary Source/Extractor. Fetches data from external APIs. Often used for enrichment alongside DB sources.' },
  slack_alert: { label: 'Slack Alert', icon: 'MessageSquare', color: 'slate-600', desc: 'Notification Terminal. Broadcasts status. IMPORTANT: For errors, this MUST downstream from an Error Handler node.' },
  error_handler: { label: 'Error Handler', icon: 'AlertTriangle', color: 'slate-800', desc: 'Topology Guard. Catch-all for upstream failures. All error notifications (Slack/Email) should flow FROM this node.' },
};
