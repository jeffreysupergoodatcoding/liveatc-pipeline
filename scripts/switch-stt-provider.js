#!/usr/bin/env node

/**
 * Provider switcher utility
 * Helps you quickly switch between STT providers
 * Usage: node scripts/switch-stt-provider.js [provider-name]
 */

import dotenv from 'dotenv';
import { STTFactory } from '../backend/services/transcription/STTFactory.js';

dotenv.config();

function showCurrentProvider() {
    console.log('🔍 Current STT Provider Configuration\n');
    console.log('━'.repeat(60));

    const providers = {
        'Deepgram': process.env.DEEPGRAM_API_KEY,
        'HuggingFace': process.env.HUGGINGFACE_API_KEY
    };

    let hasAny = false;
    for (const [name, key] of Object.entries(providers)) {
        const status = key ? '✅ Configured' : '❌ Not configured';
        console.log(`${name.padEnd(15)} ${status}`);
        if (key) {
            hasAny = true;
            const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
            console.log(`${''.padEnd(15)} Key: ${masked}`);
        }
    }

    if (!hasAny) {
        console.log('\n⚠️  No providers configured!');
        console.log('Add API keys to your .env file to enable providers.');
        return null;
    }

    console.log('━'.repeat(60));

    // Determine which will be used
    const preferred = process.env.PREFERRED_STT_PROVIDER;
    if (preferred) {
        console.log(`\n🎯 Preferred Provider: ${preferred}`);
        if (providers[preferred.charAt(0).toUpperCase() + preferred.slice(1)]) {
            console.log(`✅ ${preferred} will be used`);
        } else {
            console.log(`❌ ${preferred} is not configured - falling back to auto-detect`);
        }
    } else {
        console.log('\n🎯 Auto-detect mode (using first available)');
        if (process.env.DEEPGRAM_API_KEY) {
            console.log('✅ Deepgram will be used (found first)');
        } else if (process.env.HUGGINGFACE_API_KEY) {
            console.log('✅ HuggingFace will be used (Deepgram not available)');
        }
    }

    console.log('━'.repeat(60));
    return true;
}

function showHelp() {
    console.log('📚 STT Provider Switcher\n');
    console.log('Usage:');
    console.log('  node scripts/switch-stt-provider.js [command]\n');
    console.log('Commands:');
    console.log('  status              Show current provider configuration');
    console.log('  list                List all available providers');
    console.log('  help                Show this help message\n');
    console.log('Examples:');
    console.log('  node scripts/switch-stt-provider.js status');
    console.log('  node scripts/switch-stt-provider.js list\n');
    console.log('💡 To switch providers:');
    console.log('  1. Edit your .env file');
    console.log('  2. Comment/uncomment the API keys for the provider you want');
    console.log('  3. Or set PREFERRED_STT_PROVIDER=deepgram (or huggingface)');
}

function listProviders() {
    console.log('📋 Available STT Providers\n');
    console.log('━'.repeat(60));

    const providers = STTFactory.getAvailableProviders();

    providers.forEach(name => {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        console.log(`\n📡 ${displayName}`);
        console.log(`   Name: ${name}`);

        const envVar = `${name.toUpperCase()}_API_KEY`;
        const configured = process.env[envVar] ? '✅' : '❌';
        console.log(`   Environment Variable: ${envVar}`);
        console.log(`   Status: ${configured} ${process.env[envVar] ? 'Configured' : 'Not configured'}`);

        // Provider-specific info
        if (name === 'deepgram') {
            console.log('   Features: Word-level timestamps, speaker diarization, multiple alternatives');
            console.log('   Best for: Production use, high accuracy');
        } else if (name === 'huggingface') {
            const endpoint = process.env.HUGGINGFACE_ENDPOINT || 'Not set';
            console.log(`   Endpoint: ${endpoint}`);
            console.log('   Features: Custom model support, flexible deployment');
            console.log('   Best for: Testing custom models, cost optimization');
        }
    });

    console.log('\n' + '━'.repeat(60));
    console.log('\n💡 To configure a provider, add its API key to .env:');
    console.log('   DEEPGRAM_API_KEY=your_key_here');
    console.log('   HUGGINGFACE_API_KEY=your_key_here');
}

// Main execution
const command = process.argv[2] || 'status';

switch (command.toLowerCase()) {
    case 'status':
        showCurrentProvider();
        break;
    case 'list':
        listProviders();
        break;
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
    default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run with "help" to see available commands');
        process.exit(1);
}
