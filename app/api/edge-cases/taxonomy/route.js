import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

/**
 * GET /api/edge-cases/taxonomy
 * Returns the built-in edge case taxonomy
 */
export async function GET() {
  try {
    const taxonomyPath = path.join(process.cwd(), 'backend/data/edge_case_taxonomy.json');
    const taxonomyData = await fs.readFile(taxonomyPath, 'utf8');
    const taxonomy = JSON.parse(taxonomyData);

    return NextResponse.json(taxonomy);
  } catch (error) {
    console.error('Error loading taxonomy:', error);
    return NextResponse.json(
      { error: 'Failed to load taxonomy' },
      { status: 500 }
    );
  }
}
