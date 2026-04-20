export const NODE_TYPES = {
  csv_reader: { label: 'CSV Reader', icon: 'FileText', color: 'red', desc: 'Reads data from CSV files' },
  json_transformer: { label: 'JSON Transformer', icon: 'Code', color: 'orange', desc: 'Converts data formats to JSON' },
  data_filter: { label: 'Data Filter', icon: 'Filter', color: 'yellow', desc: 'Filters incoming data streams' },
  sql_source: { label: 'SQL Source', icon: 'Database', color: 'green', desc: 'Queries relational databases' },
  mongodb_sink: { label: 'MongoDB Sink', icon: 'Database', color: 'blue', desc: 'Persists data to MongoDB' },
  postgres_sink: { label: 'Postgres Sink', icon: 'Database', color: 'indigo', desc: 'Persists data to PostgreSQL' },
  s3_storage: { label: 'S3 Storage', icon: 'Cloud', color: 'violet', desc: 'Uploads files to Amazon S3' },
  rest_api: { label: 'REST API', icon: 'Globe', color: 'slate-400', desc: 'Interacts with external Web APIs' },
  slack_alert: { label: 'Slack Alert', icon: 'MessageSquare', color: 'slate-600', desc: 'Sends notifications to Slack' },
  error_handler: { label: 'Error Handler', icon: 'AlertTriangle', color: 'slate-800', desc: 'Manages workflow errors' },
};
