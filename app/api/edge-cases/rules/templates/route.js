import { NextResponse } from 'next/server';
import { CustomRuleBuilder } from '../../../../../backend/services/CustomRuleBuilder.js';

/**
 * GET /api/edge-cases/rules/templates
 * Get rule templates for easier rule creation
 */
export async function GET() {
  try {
    const ruleBuilder = new CustomRuleBuilder();
    const templates = ruleBuilder.getRuleTemplates();

    return NextResponse.json({
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    );
  }
}
