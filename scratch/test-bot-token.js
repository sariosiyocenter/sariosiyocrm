import 'dotenv/config';

async function testToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log('Testing token:', token ? `${token.substring(0, 10)}...` : 'undefined');
  if (!token) {
    console.error('No token found in process.env.TELEGRAM_BOT_TOKEN');
    return;
  }
  
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    console.log('Telegram response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

testToken();
