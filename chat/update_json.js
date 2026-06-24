const fs = require('fs');
const path = require('path');

const locales = ['en', 'zh', 'ja', 'ko'];
const dir = path.join(__dirname, 'frontend/messages');

const metadataTranslations = {
  en: {
    title: "ChineseMate - AI Chinese Learning Platform",
    description: "Learn Chinese with your personal AI mate. Scenario dialogue, Pinyin guide, and interactive conversation practice."
  },
  zh: {
    title: "ChineseMate - AI 中文学习平台",
    description: "与你的私人 AI 伙伴一起学习中文。情景对话、拼音指南、互动练习。"
  },
  ja: {
    title: "ChineseMate - AI中国語学習プラットフォーム",
    description: "AIパートナーと一緒に中国語を学びましょう。シチュエーション会話、ピンインガイド、インタラクティブな練習。"
  },
  ko: {
    title: "ChineseMate - AI 중국어 학습 플랫폼",
    description: "개인 AI 파트너와 함께 중국어를 배우세요. 상황별 대화, 병음 가이드, 대화형 연습."
  }
};

locales.forEach(locale => {
  const filePath = path.join(dir, `${locale}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.Metadata = metadataTranslations[locale];
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${locale}.json`);
  }
});
