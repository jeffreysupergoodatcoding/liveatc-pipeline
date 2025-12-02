import { NextResponse } from 'next/server';
import { CustomRuleBuilder } from '../../../../backend/services/CustomRuleBuilder.js';

const ruleBuilder = new CustomRuleBuilder();

/**
 * GET /api/edge-cases/rules
 * Returns all custom rules
 */
export async function GET() {
  try {
    await ruleBuilder.initialize();
    const rules = await ruleBuilder.getAllRules();

    return NextResponse.json({
      rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Error getting rules:', error);
    return NextResponse.json(
      { error: 'Failed to get rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/edge-cases/rules
 * Creates a new custom rule
 */
export async function POST(request) {
  try {
    await ruleBuilder.initialize();
    const ruleData = await request.json();

    const rule = await ruleBuilder.createRule(ruleData);

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create rule' },
      { status: 400 }
    );
  }
}
