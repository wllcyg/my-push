const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../.vitepress/config.mjs');
let configContent = fs.readFileSync(configPath, 'utf8');

function simplifyTitle(title) {
  let cleaned = title;
  
  // Try to match "Day X"
  let dayMatch = title.match(/Day\s*(\d+(?:\.\d+)?|番外(?: \d+)?|上|下)\s*[)）]?\s*[:：]\s*(.*)/i);
  if (dayMatch) {
    let dayNum = dayMatch[1];
    let topic = dayMatch[2].trim();
    // remove subtitles starting with - or ——
    topic = topic.replace(/\s*[-——].*$/, '').trim();
    // remove emojis
    topic = topic.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim();
    return `Day ${dayNum}: ${topic}`;
  }
  
  // if no day match but it is something else
  cleaned = cleaned.replace(/^前端转\s*Flutter\s*(笔记|实战)?\s*[：:\s]*/i, '');
  cleaned = cleaned.replace(/^Flutter\s*(实战|笔记)\s*[：:\s]*/i, '');
  cleaned = cleaned.replace(/\s*[-——].*$/, ''); 
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim();
  
  return cleaned || title;
}

const lines = configContent.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"text":')) {
    const match = lines[i].match(/"text":\s*"([^"]+)"/);
    if (match) {
      const original = match[1];
      if (original === '学习路线与指南' || original === 'Flutter 每日打卡') continue;
      
      const newTitle = simplifyTitle(original);
      lines[i] = lines[i].replace(`"text": "${original}"`, `"text": "${newTitle}"`);
    }
  }
}

fs.writeFileSync(configPath, lines.join('\n'));
console.log("Simplified titles successfully!");
