import { connectDB, Workflow } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectDB();
    const workflows = await Workflow.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ data: workflows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    
    // Save as a new Workflow document
    const newWorkflow = await Workflow.create({
      workflowId: body.workflowId,
      name: body.name || `Workflow ${new Date().toLocaleTimeString()}`,
      nodes: body.nodes,
      edges: body.edges,
    });

    return NextResponse.json({ success: true, data: newWorkflow });
  } catch (error: any) {
    console.error('Save Workflow Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
