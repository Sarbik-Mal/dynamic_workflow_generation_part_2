import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Fail fast (5s) if DB is off
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

const NodeSchema = new mongoose.Schema({
  id: String,
  type: String,
  data: {
    label: String,
    description: String,
    color: String,
  },
  position: {
    x: Number,
    y: Number,
  }
});

const EdgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  animated: { type: Boolean, default: true },
});

const WorkflowSchema = new mongoose.Schema({
  workflowId: { type: String, unique: true },
  name: { type: String, default: 'Untitled Workflow' },
  nodes: [NodeSchema],
  edges: [EdgeSchema],
  createdAt: { type: Date, default: Date.now },
}, { collection: 'workflows' });

export { connectDB };
export const Workflow = mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema);
