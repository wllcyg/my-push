// test-wxpusher.js
// Run this script using: node test-wxpusher.js

const APP_TOKEN = 'AT_3abdnhvoAvkMN8g9AdZ27caMYi5gsBtb';
const UID = 'UID_yaDGtgEyvhMoKpMpUrqHEXtaxYNa';

async function sendTestMessage() {
  console.log('Sending test message to WxPusher...');

  // Note: Since our Next.js API runs on localhost, WeChat cannot download the image directly.
  // For this test, we use a placeholder public image or a simple text message.
  // In production, the Cloudflare R2 URL will be used here.
  
  const payload = {
    appToken: APP_TOKEN,
    content: "## 这是你的专属每日卡片！\n\n![Satori Card](https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=800&auto=format&fit=crop)",
    summary: "今日单词：Serendipity", // Message summary in chat list
    contentType: 3, // 3 means Markdown
    uids: [UID],
  };

  try {
    const response = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.code === 1000) {
      console.log('✅ Push successful! Please check your WeChat.');
      console.log('Response:', data);
    } else {
      console.error('❌ Push failed:', data);
    }
  } catch (error) {
    console.error('Error calling WxPusher API:', error);
  }
}

sendTestMessage();
