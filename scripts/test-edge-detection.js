#!/usr/bin/env node

/**
 * Edge Case Detection System Test Script
 *
 * This script verifies that the edge case detection system is properly configured
 * and can perform basic operations.
 *
 * Usage:
 *   node scripts/test-edge-detection.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TESTS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(message, type = 'info') {
  const symbols = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  console.log(`${symbols[type]} ${message}`);
}

async function testFileExists(filePath, description) {
  try {
    await fs.access(filePath);
    log(`${description} exists`, 'success');
    TESTS.passed++;
    return true;
  } catch {
    log(`${description} NOT FOUND: ${filePath}`, 'error');
    TESTS.failed++;
    return false;
  }
}

async function testEnvVariable(varName, required = true) {
  const value = process.env[varName];
  if (value && value.trim() !== '') {
    log(`Environment variable ${varName} is set`, 'success');
    TESTS.passed++;
    return true;
  } else {
    if (required) {
      log(`Environment variable ${varName} is missing or empty`, 'error');
      TESTS.failed++;
    } else {
      log(`Environment variable ${varName} is not set (optional)`, 'warning');
      TESTS.warnings++;
    }
    return false;
  }
}

async function testTaxonomy() {
  try {
    const taxonomyPath = path.join(__dirname, '..', 'backend/data/edge_case_taxonomy.json');
    const data = await fs.readFile(taxonomyPath, 'utf8');
    const taxonomy = JSON.parse(data);

    if (taxonomy.metadata && taxonomy.metadata.total_cases === 57) {
      log(`Taxonomy loaded successfully (${taxonomy.metadata.total_cases} cases)`, 'success');
      TESTS.passed++;
      return true;
    } else {
      log('Taxonomy structure invalid', 'error');
      TESTS.failed++;
      return false;
    }
  } catch (error) {
    log(`Failed to load taxonomy: ${error.message}`, 'error');
    TESTS.failed++;
    return false;
  }
}

async function testSTTProvider() {
  try {
    const { getSTTProvider } = await import('../backend/services/transcription/index.js');

    if (!process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY.trim() === '') {
      log('STT Provider check skipped (no API key)', 'warning');
      TESTS.warnings++;
      return false;
    }

    const provider = getSTTProvider('deepgram');

    if (provider.isConfigured()) {
      log('STT Provider (Deepgram) configured successfully', 'success');
      TESTS.passed++;
      return true;
    } else {
      log('STT Provider not properly configured', 'error');
      TESTS.failed++;
      return false;
    }
  } catch (error) {
    log(`STT Provider test failed: ${error.message}`, 'error');
    TESTS.failed++;
    return false;
  }
}

async function testDetector() {
  try {
    const { EdgeCaseDetector } = await import('../backend/services/detection/EdgeCaseDetector.js');

    const detector = new EdgeCaseDetector({ mode: 'built-in' });
    await detector.initialize();

    const taxonomy = detector.getTaxonomy();
    if (taxonomy && taxonomy.metadata) {
      log('Edge Case Detector initialized successfully', 'success');
      TESTS.passed++;
      return true;
    } else {
      log('Edge Case Detector initialization failed', 'error');
      TESTS.failed++;
      return false;
    }
  } catch (error) {
    log(`Detector test failed: ${error.message}`, 'error');
    TESTS.failed++;
    return false;
  }
}

async function testCustomRuleBuilder() {
  try {
    const { CustomRuleBuilder } = await import('../backend/services/CustomRuleBuilder.js');

    const builder = new CustomRuleBuilder();
    const templates = builder.getRuleTemplates();

    if (templates && templates.length > 0) {
      log(`Custom Rule Builder working (${templates.length} templates available)`, 'success');
      TESTS.passed++;
      return true;
    } else {
      log('Custom Rule Builder has no templates', 'warning');
      TESTS.warnings++;
      return false;
    }
  } catch (error) {
    log(`Custom Rule Builder test failed: ${error.message}`, 'error');
    TESTS.failed++;
    return false;
  }
}

async function runTests() {
  console.log('\n🔍 Edge Case Detection System - Verification Test\n');
  console.log('═'.repeat(60));
  console.log('\n📁 Testing File Structure...\n');

  // Test backend files
  await testFileExists(
    path.join(__dirname, '..', 'backend/data/edge_case_taxonomy.json'),
    'Edge Case Taxonomy'
  );
  await testFileExists(
    path.join(__dirname, '..', 'backend/services/transcription/DeepgramProvider.js'),
    'Deepgram STT Provider'
  );
  await testFileExists(
    path.join(__dirname, '..', 'backend/services/detection/EdgeCaseDetector.js'),
    'Edge Case Detector'
  );
  await testFileExists(
    path.join(__dirname, '..', 'backend/services/CustomRuleBuilder.js'),
    'Custom Rule Builder'
  );

  // Test API routes
  await testFileExists(
    path.join(__dirname, '..', 'app/api/edge-cases/taxonomy/route.js'),
    'Taxonomy API Route'
  );
  await testFileExists(
    path.join(__dirname, '..', 'app/api/segments/detect/route.js'),
    'Detection API Route'
  );

  // Test database migration
  await testFileExists(
    path.join(__dirname, '..', 'supabase/migrations/002_edge_case_detection.sql'),
    'Database Migration'
  );

  console.log('\n⚙️  Testing Environment Configuration...\n');

  // Test environment variables
  await testEnvVariable('DEEPGRAM_API_KEY', true);
  await testEnvVariable('EDGE_CASE_DETECTION_ENABLED', false);
  await testEnvVariable('DETECTION_MODE', false);
  await testEnvVariable('SUPABASE_URL', true);
  await testEnvVariable('SUPABASE_KEY', true);

  console.log('\n🔧 Testing System Components...\n');

  // Test components
  await testTaxonomy();
  await testSTTProvider();
  await testDetector();
  await testCustomRuleBuilder();

  // Summary
  console.log('\n═'.repeat(60));
  console.log('\n📊 Test Results Summary\n');
  console.log(`  ✅ Passed:   ${TESTS.passed}`);
  console.log(`  ❌ Failed:   ${TESTS.failed}`);
  console.log(`  ⚠️  Warnings: ${TESTS.warnings}`);
  console.log('\n═'.repeat(60));

  if (TESTS.failed === 0) {
    console.log('\n🎉 All critical tests passed!\n');

    if (TESTS.warnings > 0) {
      console.log('⚠️  There are some warnings:');
      if (!process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY.trim() === '') {
        console.log('   - Add DEEPGRAM_API_KEY to .env to enable transcription');
      }
      console.log('');
    }

    console.log('📝 Next Steps:');
    console.log('   1. Add your DEEPGRAM_API_KEY to .env');
    console.log('   2. Apply database migration: supabase/migrations/002_edge_case_detection.sql');
    console.log('   3. Test detection with: curl -X POST http://localhost:3001/api/segments/detect -F "audio=@sample.mp3"');
    console.log('');

    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
