import { NextResponse } from 'next/server';
import { CustomRuleBuilder } from '../../../../../backend/services/CustomRuleBuilder.js';

const ruleBuilder = new CustomRuleBuilder();

/**
 * GET /api/edge-cases/rules/[id]
 * Get a specific rule by ID
 */
export async function GET(request, { params }) {
  try {
    await ruleBuilder.initialize();
    // Await params in Next.js 14+
    const { id } = await params;
    const rule = await ruleBuilder.getRuleById(id);

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error getting rule:', error);
    return NextResponse.json(
      { error: 'Failed to get rule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/edge-cases/rules/[id]
 * Update a custom rule
 */
export async function PUT(request, { params }) {
  try {
    await ruleBuilder.initialize();
    // Await params in Next.js 14+
    const { id } = await params;
    const updates = await request.json();

    const rule = await ruleBuilder.updateRule(id, updates);

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error updating rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update rule' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/edge-cases/rules/[id]
 * Delete a custom rule
 */
export async function DELETE(request, { params }) {
  try {
    await ruleBuilder.initialize();
    // Await params in Next.js 14+
    const { id } = await params;
    const deleted = await ruleBuilder.deleteRule(id);

    return NextResponse.json({
      message: 'Rule deleted successfully',
      rule: deleted
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete rule' },
      { status: 400 }
    );
  }
}
