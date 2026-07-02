const fs = require('fs');
const path = require('path');

const srcDir = 'd:\\self\\my-flutter\\my_flutter_app';
const targetDocsDir = 'd:\\self\\my-push\\my-docs\\docs\\flutter';
const targetImagesDir = 'd:\\self\\my-push\\my-docs\\docs\\public\\images';

// Ensure target directories exist
if (!fs.existsSync(targetDocsDir)) fs.mkdirSync(targetDocsDir, { recursive: true });
if (!fs.existsSync(targetImagesDir)) fs.mkdirSync(targetImagesDir, { recursive: true });

// Helper to pad day numbers
function pad(num) {
  return num.toString().padStart(2, '0');
}

// Helper to create a clean filename
function cleanFileName(originalName, title) {
  // Extract day number and potential suffix (e.g., day10_extra_network.md)
  const dayMatch = originalName.match(/day(\d+)(.*)\.md/i);
  if (dayMatch) {
    const dayNum = pad(dayMatch[1]);
    let suffix = dayMatch[2].toLowerCase().replace(/_/g, '-');
    if (suffix && !suffix.startsWith('-')) {
      suffix = '-' + suffix;
    }
    return `day-${dayNum}${suffix}.md`; 
  }
  // For non-day files like LEARNING_PLAN.md
  return originalName.toLowerCase().replace(/_/g, '-');
}

function processFiles() {
  const files = fs.readdirSync(srcDir);
  let sidebarItems = [];

  const mdFiles = files.filter(f => f.endsWith('.md') && (f.toLowerCase().startsWith('day') || f.toLowerCase().startsWith('learning')));

  // Also handle images
  const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
  imageFiles.forEach(img => {
    fs.copyFileSync(path.join(srcDir, img), path.join(targetImagesDir, img));
  });

  mdFiles.forEach(file => {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
    
    // Extract title (H1)
    let title = file.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Replace image paths in content (e.g. ![alt](day1.png) -> ![alt](/images/day1.png))
    content = content.replace(/!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg))\)/g, (match, alt, imgPath) => {
      // If it's just a filename, point to /images/
      if (!imgPath.includes('/') && !imgPath.includes('\\')) {
        return `![${alt}](/images/${imgPath})`;
      }
      return match;
    });

    const isDay = file.toLowerCase().startsWith('day');
    const newName = isDay ? cleanFileName(file, title) : file.toLowerCase().replace(/_/g, '-');
    
    // Write new file
    fs.writeFileSync(path.join(targetDocsDir, newName), content);

    sidebarItems.push({
      originalName: file,
      text: title,
      link: `/docs/flutter/${newName.replace('.md', '')}`,
      isDay,
      dayNum: isDay ? parseInt(file.match(/day(\d+)/i)[1], 10) : 0
    });
  });

  // Sort sidebar items
  const dayItems = sidebarItems.filter(i => i.isDay).sort((a, b) => a.dayNum - b.dayNum);
  const otherItems = sidebarItems.filter(i => !i.isDay);

  const finalSidebar = [
    {
      text: '学习路线与指南',
      items: otherItems.map(i => ({ text: i.text, link: i.link }))
    },
    {
      text: 'Flutter 每日打卡',
      items: dayItems.map(i => ({ text: i.text, link: i.link }))
    }
  ];

  console.log(JSON.stringify(finalSidebar, null, 2));
}

processFiles();
