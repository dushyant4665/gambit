#!/usr/bin/env node

/**
 * Simple test script to verify the bot system is working
 * Run with: node scripts/test-bots.js
 */

require('dotenv').config();

// Import the bot system (this will be compiled TypeScript)
const { createBot } = require('../dist/bots/TalFischerBots');

async function testBotSystem() {
  console.log('🧪 Testing Chess Bot System...\n');

  try {
    // Test Tal Bot
    console.log('🤖 Testing Tal Bot (Aggressive)...');
    const talBot = createBot('tal', process.env.GEMINI_API_KEY, 'gemini');
    
    const talResult = await talBot.getBestMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [],
      'w'
    );
    
    console.log(`✅ Tal Bot chose: ${talResult.move}`);
    console.log(`   Source: ${talResult.source}`);
    console.log(`   Reason: ${talResult.reason || 'N/A'}`);
    console.log(`   Ready: ${talBot.isReady()}\n`);

    // Test Fischer Bot
    console.log('🤖 Testing Fischer Bot (Precise)...');
    const fischerBot = createBot('fischer', process.env.OPENROUTER_API_KEY, 'openrouter');
    
    const fischerResult = await fischerBot.getBestMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [],
      'w'
    );
    
    console.log(`✅ Fischer Bot chose: ${fischerResult.move}`);
    console.log(`   Source: ${fischerResult.source}`);
    console.log(`   Reason: ${fischerResult.reason || 'N/A'}`);
    console.log(`   Ready: ${fischerBot.isReady()}\n`);

    // Test mid-game position
    console.log('🤖 Testing mid-game position...');
    const midGameFEN = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const moveHistory = ['e2e4', 'e7e5', 'g1f3', 'g8f6'];
    
    const midGameResult = await talBot.getBestMove(midGameFEN, moveHistory, 'w');
    
    console.log(`✅ Mid-game move: ${midGameResult.move}`);
    console.log(`   Source: ${midGameResult.source}`);
    console.log(`   Reason: ${midGameResult.reason || 'N/A'}\n`);

    // Cleanup
    talBot.destroy();
    fischerBot.destroy();

    console.log('🎉 All bot tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Tal Bot: ${talResult.move} (${talResult.source})`);
    console.log(`- Fischer Bot: ${fischerResult.move} (${fischerResult.source})`);
    console.log(`- Mid-game: ${midGameResult.move} (${midGameResult.source})`);

  } catch (error) {
    console.error('❌ Bot system test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure the server is compiled: npm run build');
    console.error('2. Check environment variables in .env file');
    console.error('3. Ensure Stockfish is installed or fallback mode is working');
    console.error('4. Verify API keys are valid (optional - system works without them)');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testBotSystem();
}

module.exports = { testBotSystem };


