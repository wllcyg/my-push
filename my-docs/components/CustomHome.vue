<template>
  <div class="custom-home">
    <div class="container">
      <header>
        <a href="/" class="logo">
          <img :src="withBase('/logo.png')" alt="Logo" class="home-logo" />
          <span>Notes</span>
        </a>
        <nav>
          <a href="/docs/flutter/learning-guide">Flutter</a>
          <a href="/docs/ai/01-agent-learning">AI & Agent</a>
          <a href="/docs/why/在忘忧AI的第两百一十九天">随笔杂谈</a>
        </nav>
      </header>

      <main>
        <section class="hero">
          <div class="hero-content">
            <h1>全栈开发与思考笔记</h1>
            <p>一本记录 Flutter 实战、AI & Agent 探索，<br>以及前沿技术深度钻研的开发者笔记。</p>
            <a href="/docs/ai/01-agent-learning" class="btn">开始阅读</a>
          </div>
          <div class="hero-graphics">
            <svg class="graphics-svg" viewBox="0 0 400 300">
              <!-- Window mock -->
              <rect x="20" y="80" width="180" height="120" rx="4" stroke-width="1.5" stroke="#1a3237" fill="#081017"></rect>
              <circle cx="32" cy="92" r="2" fill="#1a3237" stroke="none"></circle>
              <circle cx="40" cy="92" r="2" fill="#1a3237" stroke="none"></circle>
              <circle cx="48" cy="92" r="2" fill="#1a3237" stroke="none"></circle>
              <line x1="20" y1="104" x2="200" y2="104" stroke="#1a3237" stroke-width="1.5"></line>
              
              <line x1="40" y1="125" x2="100" y2="125" stroke="#19584e" stroke-width="2" stroke-linecap="round"></line>
              <line x1="40" y1="140" x2="80" y2="140" stroke="#19584e" stroke-width="2" stroke-linecap="round"></line>
              <line x1="85" y1="140" x2="120" y2="140" stroke="#19584e" stroke-width="2" stroke-linecap="round"></line>
              <line x1="40" y1="155" x2="90" y2="155" stroke="#19584e" stroke-width="2" stroke-linecap="round"></line>
              <line x1="40" y1="170" x2="60" y2="170" stroke="#19584e" stroke-width="2" stroke-linecap="round"></line>

              <rect x="140" y="150" width="60" height="40" rx="2" stroke-width="1.5" fill="#081017" stroke="#23b08e"></rect>
              <text x="170" y="176" fill="#23b08e" stroke="none" font-family="monospace" font-weight="600" font-size="18" text-anchor="middle">&lt;/&gt;</text>

              <polygon points="320,160 290,210 350,210" stroke="#23b08e" stroke-width="1.5" fill="none"></polygon>

              <circle cx="310" cy="80" r="40" stroke="#23b08e" stroke-width="1" fill="none"></circle>
              <circle cx="300" cy="90" r="30" stroke="#1a3237" stroke-width="1.5" fill="none"></circle>
              <path d="M295 80h10m-5-5v10" stroke="#1a3237" stroke-width="1.5"></path>
              
              <path d="M200 120 L300 80" stroke="#23b08e" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"></path>
              
              <g fill="#23b08e" stroke="none" opacity="0.6">
                <circle cx="230" cy="180" r="1.5"></circle>
                <circle cx="245" cy="180" r="1.5"></circle>
                <circle cx="260" cy="180" r="1.5"></circle>
                <circle cx="275" cy="180" r="1.5"></circle>
                <circle cx="230" cy="195" r="1.5"></circle>
                <circle cx="245" cy="195" r="1.5"></circle>
                <circle cx="260" cy="195" r="1.5"></circle>
                <circle cx="275" cy="195" r="1.5"></circle>
                <circle cx="230" cy="210" r="1.5"></circle>
                <circle cx="245" cy="210" r="1.5"></circle>
                <circle cx="260" cy="210" r="1.5"></circle>
                <circle cx="275" cy="210" r="1.5"></circle>
                <circle cx="230" cy="225" r="1.5"></circle>
                <circle cx="245" cy="225" r="1.5"></circle>
                <circle cx="260" cy="225" r="1.5"></circle>
                <circle cx="275" cy="225" r="1.5"></circle>
              </g>
            </svg>
          </div>
        </section>

        <section class="cards">
          <a href="/docs/flutter/learning-guide" class="card">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" class="fill-only">
                <path d="M14.314 0L2.3 12 6 15.7 21.684 0h-7.37z" opacity="0.9"/>
                <path d="M10.7 15.5l-2.4-2.4-3.7 3.7L14.314 24h7.37L10.7 13.01z" opacity="0.6"/>
                <path d="M14.314 24h7.37L10.7 13.01 6 17.7 14.314 24z"/>
              </svg>
            </div>
            <div class="card-content">
              <h2>Flutter 实战笔记</h2>
              <p>记录我从前端转向 Flutter 开发过程中的实战经验、组件封装与性能优化点滴。</p>
            </div>
            <div class="card-arrow">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>
          <a href="/docs/ai/01-agent-learning" class="card">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" class="stroke-only" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div class="card-content">
              <h2>AI & Agent 探砸</h2>
              <p>涵盖大语言模型、智能体框架应用，以及 RAG 检索增强等核心前沿技术沉淀。</p>
            </div>
            <div class="card-arrow">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
            </div>
          </a>
          <a href="/docs/why/在忘忧AI的第两百一十九天" class="card">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" class="stroke-only" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="card-content">
              <h2>随笔杂谈</h2>
              <p>工作之余的一些磞磞念念，关于 AI、职业与生活的随手记录。</p>
            </div>
            <div class="card-arrow">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
            </div>
          </a>
        </section>
      </main>

      <footer>
        <div class="copyright">&copy; 2026 wllcyg</div>

        <div class="socials">
          <a href="https://github.com/wllcyg" target="_blank" aria-label="GitHub">
            <svg viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
          </a>
          <a href="mailto:wllcyg163@gmail.com" aria-label="Email">
            <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </a>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { withBase } from 'vitepress'
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.custom-home {
  --bg-color: #081017;
  --text-main: #ffffff;
  --text-muted: #8b9cad;
  --accent: #23b08e;
  --accent-dark: #19584e;
  --border-color: #1a3237;
  --font-family: 'Inter', sans-serif;
  
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: var(--font-family);
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.custom-home * {
  box-sizing: border-box;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Header */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  text-decoration: none;
}

.logo img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.logo svg {
  width: 24px;
  height: 24px;
  stroke: var(--accent);
  fill: none;
  stroke-width: 2;
}

nav {
  display: flex;
  gap: 32px;
}

nav a {
  color: var(--text-main);
  text-decoration: none;
  font-size: 15px;
  transition: color 0.2s;
}

nav a:hover {
  color: var(--accent);
}

/* Hero */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 60px;
  margin-bottom: 80px;
}

.hero-content {
  max-width: 500px;
}

.hero-content h1 {
  font-size: 56px;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.hero-content p {
  font-size: 18px;
  color: var(--text-muted);
  margin-bottom: 40px;
  line-height: 1.6;
}

.btn {
  display: inline-flex;
  background-color: var(--accent-dark);
  color: #ffffff;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 500;
  transition: background-color 0.2s;
}
.btn:hover {
  background-color: var(--accent);
}

/* Graphics */
.hero-graphics {
  position: relative;
  width: 400px;
  height: 300px;
}

.graphics-svg {
  width: 100%;
  height: 100%;
  stroke: var(--accent);
  fill: none;
}

/* Cards */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 100px;
}

.card {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 40px 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  text-decoration: none;
  color: var(--text-main);
  background: linear-gradient(to right, rgba(25, 88, 78, 0.05), transparent);
  transition: border-color 0.2s, transform 0.2s;
}

.card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.card-icon {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon svg {
  width: 100%;
  height: 100%;
  stroke: var(--accent);
  stroke-width: 1.5;
}

.card-icon svg.fill-only {
  fill: var(--accent);
  stroke: none;
}

.card-icon svg.stroke-only {
  fill: none;
}

.card-content h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.card-content p {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
}

.card-arrow {
  margin-left: auto;
  color: var(--accent);
}

.card-arrow svg {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.5;
}

/* Footer */
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: auto;
}

.copyright {
  color: var(--text-muted);
  font-size: 14px;
}

.footer-nav {
  display: flex;
  gap: 24px;
}

.footer-nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;
}

.footer-nav a:hover {
  color: var(--text-main);
}

.socials {
  display: flex;
  gap: 16px;
}

.socials a {
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.socials a:hover {
  opacity: 0.8;
}

.socials svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

/* 移动端兼容 (Mobile Responsive) */
@media screen and (max-width: 768px) {
  .container {
    padding: 0 24px;
  }

  header {
    flex-direction: column;
    gap: 20px;
    padding: 30px 0;
  }

  nav {
    gap: 24px;
  }

  .hero {
    flex-direction: column;
    text-align: center;
    margin-top: 30px;
    margin-bottom: 50px;
    gap: 40px;
  }

  .hero-content h1 {
    font-size: 40px;
  }

  .hero-content p {
    font-size: 16px;
    margin-bottom: 30px;
  }

  .hero-graphics {
    width: 100%;
    max-width: 320px;
    height: auto;
    aspect-ratio: 4/3;
  }

  .cards {
    grid-template-columns: 1fr;
    gap: 16px;
    margin-bottom: 60px;
  }

  .card {
    padding: 24px 20px;
    gap: 16px;
    flex-direction: column;
    text-align: center;
  }

  .card-arrow {
    margin-left: 0;
    margin-top: 8px;
    transform: rotate(90deg);
  }

  .card:hover .card-arrow {
    transform: rotate(90deg) translateX(4px);
  }

  footer {
    flex-direction: column;
    gap: 16px;
    padding: 30px 0;
    text-align: center;
  }
}
</style>
