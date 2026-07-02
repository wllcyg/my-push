const fs = require('fs');
const path = require('path');

const sourceDir = 'd:\\self\\my-push\\two\\tool-test\\docs';
const targetDir = 'd:\\self\\my-push\\my-docs\\docs\\ai';
const configPath = 'd:\\self\\my-push\\my-docs\\.vitepress\\config.mjs';

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Read files from source
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
const aiItems = [];

for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    // Copy file
    fs.copyFileSync(sourcePath, targetPath);
    
    // Extract title
    const content = fs.readFileSync(sourcePath, 'utf8');
    const firstLine = content.split('\n').find(line => line.startsWith('# '));
    let title = file.replace('.md', '');
    if (firstLine) {
        title = firstLine.replace('# ', '').trim();
    }
    
    // Add to items
    aiItems.push({
        text: title,
        link: `/docs/ai/${file.replace('.md', '')}`
    });
}

// Update config.mjs
let configContent = fs.readFileSync(configPath, 'utf8');

// We will inject the new sidebar section right before "Flutter 每日打卡"
const aiSidebarSection = `
      {
        "text": "AI & Agent 实战",
        "items": ${JSON.stringify(aiItems, null, 10).replace(/}\n\s*]/, '}          \n        ]')}
      },`;

// A bit tricky to regex inject nicely, let's just replace the exact text we know is there
if (configContent.includes('"text": "Flutter 每日打卡"')) {
    configContent = configContent.replace(
        /\{\s*"text": "Flutter 每日打卡"/, 
        aiSidebarSection.trim() + '\n      {\n        "text": "Flutter 每日打卡"'
    );
}

// Also let's add an "AI & Agent" link in the nav bar
if (configContent.includes("nav: [")) {
    configContent = configContent.replace(
        "{ text: 'Flutter', link: '/docs/flutter/learning-guide' },",
        "{ text: 'Flutter', link: '/docs/flutter/learning-guide' },\n      { text: 'AI & Agent', link: '/docs/ai/01-agent-learning' },"
    );
}

fs.writeFileSync(configPath, configContent);
console.log("Copied AI files and updated config.mjs successfully!");
