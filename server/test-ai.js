// Simple AI test without Supabase dependency
require('dotenv').config();

// Mock the bot system for testing
const { createBot } = require('./dist/bots/TalFischerBots');

async function testAIBots() {
  console.log('🤖 Testing AI Bots with API Keys...\n');

  try {
    // Test Tal Bot
    console.log('🧪 Testing Tal Bot (Aggressive)...');
    const talBot = createBot('tal', process.env.GEMINI_API_KEY, 'gemini');
    
    const talResult = await talBot.getBestMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [],
      'w'
    );
    
    console.log(`✅ Tal Bot Result:`);
    console.log(`   Move: ${talResult.move}`);
    console.log(`   Source: ${talResult.source}`);
    console.log(`   Reason: ${talResult.reason || 'N/A'}`);
    console.log(`   Ready: ${talBot.isReady()}`);
    console.log(`   LLM Available: ${talBot.llmAdapter.isAvailable()}\n`);

    // Test Fischer Bot
    console.log('🧪 Testing Fischer Bot (Precise)...');
    const fischerBot = createBot('fischer', process.env.OPENROUTER_API_KEY, 'openrouter');
    
    const fischerResult = await fischerBot.getBestMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [],
      'w'
    );
    
    console.log(`✅ Fischer Bot Result:`);
    console.log(`   Move: ${fischerResult.move}`);
    console.log(`   Source: ${fischerResult.source}`);
    console.log(`   Reason: ${fischerResult.reason || 'N/A'}`);
    console.log(`   Ready: ${fischerBot.isReady()}`);
    console.log(`   LLM Available: ${fischerBot.llmAdapter.isAvailable()}\n`);

    // Test with API keys
    console.log('🔑 API Key Status:');
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not Set'}`);
    console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not Set'}\n`);

    // Test mid-game position
    console.log('🧪 Testing Mid-game Position...');
    const midGameFEN = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const moveHistory = ['e2e4', 'e7e5', 'g1f3', 'g8f6'];
    
    const midGameResult = await talBot.getBestMove(midGameFEN, moveHistory, 'w');
    
    console.log(`✅ Mid-game Result:`);
    console.log(`   Move: ${midGameResult.move}`);
    console.log(`   Source: ${midGameResult.source}`);
    console.log(`   Reason: ${midGameResult.reason || 'N/A'}\n`);

    // Cleanup
    talBot.destroy();
    fischerBot.destroy();

    console.log('🎉 AI Bot Testing Completed!');
    console.log('\n📋 Summary:');
    console.log(`- Tal Bot: ${talResult.move} (${talResult.source})`);
    console.log(`- Fischer Bot: ${fischerResult.move} (${fischerResult.source})`);
    console.log(`- Mid-game: ${midGameResult.move} (${midGameResult.source})`);

    if (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY) {
      console.log('\n🚀 LLM Integration Working!');
    } else {
      console.log('\n⚠️  No API Keys - Using Stockfish Fallback Mode');
      console.log('   Add API keys to .env for full LLM personality!');
    }

  } catch (error) {
    console.error('❌ AI Bot test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure the server is compiled: npm run build');
    console.error('2. Check environment variables in .env file');
    console.error('3. Verify API keys are valid');
    process.exit(1);
  }
}

// Run the test
testAIBots();


