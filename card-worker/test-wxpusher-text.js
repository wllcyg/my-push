// test-wxpusher-text.js
const APP_TOKEN = 'AT_3abdnhvoAvkMN8g9AdZ27caMYi5gsBtb';
const UID = 'UID_yaDGtgEyvhMoKpMpUrqHEXtaxYNa';

async function sendTestMessage() {
  const payload = {
    appToken: APP_TOKEN,
    content: "这是一条纯文本测试消息，测试微信是否拦截了图文消息。",
    summary: "纯文本测试",
    contentType: 1, // 1 means Text
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
    console.log('Text message response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

sendTestMessage();
