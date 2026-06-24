"use client";

import { useEffect, useState } from 'react';

interface WordData {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleTranslation?: string;
  root: string;
  emoji: string;
  quoteSource: string;
}

export default function CardPage() {
  const [data, setData] = useState<WordData | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    const t = new Date().getTime();
    // 使用你个人的 Supabase URL
    const supabaseUrl = 'https://ynoasdesyhfzcmaoqoqk.supabase.co';
    
    fetch(`${supabaseUrl}/storage/v1/object/public/daily-card/today.json?t=${t}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
      })
      .catch(err => console.error('Failed to load daily word:', err));
  }, []);

  const playAudio = () => {
    if (!data) return;
    // 朗读单词
    const wordUtterance = new SpeechSynthesisUtterance(data.word);
    wordUtterance.lang = 'en-US';
    wordUtterance.rate = 0.9;
    
    // 朗读例句
    const exampleUtterance = new SpeechSynthesisUtterance(data.example);
    exampleUtterance.lang = 'en-US';
    exampleUtterance.rate = 0.9;
    
    window.speechSynthesis.speak(wordUtterance);
    // 停顿一下再读例句
    setTimeout(() => {
      window.speechSynthesis.speak(exampleUtterance);
    }, 1000);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fdfbfb] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfbfb] to-[#ebedee] flex flex-col items-center justify-center py-12 px-6 font-sans text-slate-800">
      
      {/* 核心内容区 */}
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-5xl font-serif font-bold text-[#1c2a38] mb-3 tracking-tight">
          {data.word}
        </h1>
        <p className="text-xl text-slate-500 mb-3 font-medium tracking-wide">
          {data.phonetic}
        </p>
        <p className="text-2xl text-slate-800 font-semibold mb-10 text-center px-4">
          {data.meaning}
        </p>
        
        {/* 胶囊形发音按钮 (珊瑚橙渐变) */}
        <button 
          onClick={playAudio} 
          className="group flex items-center gap-3 bg-gradient-to-r from-[#ff8c78] to-[#ff6b6b] text-white px-10 py-4 rounded-full shadow-[0_10px_20px_-10px_rgba(255,107,107,0.5)] hover:shadow-[0_15px_30px_-10px_rgba(255,107,107,0.6)] transition-all transform hover:-translate-y-1 active:translate-y-0 cursor-pointer"
        >
          {/* Sound Wave Icon */}
          <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-lg font-semibold tracking-wide">Play Audio</span>
        </button>
        
        {/* 下方新拟态卡片解析区 */}
        <div className="w-full mt-14 space-y-6 pb-12">
          
          {/* 例句卡片 */}
          <div className="bg-white/40 backdrop-blur-xl rounded-[1.5rem] p-7 shadow-sm border border-white/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[#ff8c78] uppercase tracking-widest flex items-center gap-2">
                <span className="bg-[#ff8c78]/20 p-1.5 rounded-md">💬</span> Example
              </h3>
              {data.exampleTranslation && (
                <button 
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="text-xs font-semibold text-slate-500 hover:text-[#ff8c78] bg-white/50 px-3 py-1 rounded-full shadow-sm transition-colors cursor-pointer"
                >
                  {showTranslation ? '显示英文' : '翻译中文'}
                </button>
              )}
            </div>
            <p className="text-slate-700 leading-relaxed text-lg font-medium transition-all duration-300">
              {showTranslation && data.exampleTranslation ? data.exampleTranslation : data.example}
            </p>
          </div>

          {/* 词根卡片 */}
          <div className="bg-white/40 backdrop-blur-xl rounded-[1.5rem] p-7 shadow-sm border border-white/60">
            <h3 className="text-xs font-bold text-[#4caf50] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="bg-[#4caf50]/20 p-1.5 rounded-md">🌱</span> Root Analysis
            </h3>
            <p className="text-slate-700 leading-relaxed text-base">
              {data.root}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
