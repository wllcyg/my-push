import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get content from query parameters with defaults
    const word = searchParams.get('word') || 'Serendipity';
    const phonetic = searchParams.get('phonetic') || '/ˌserənˈdipədē/';
    const meaning = searchParams.get('meaning') || 'n. 意外发现珍奇事物; 机缘巧合';
    const example = searchParams.get('example') || 'We found the restaurant by pure serendipity.';
    
    // New creative parameters
    const emoji = searchParams.get('emoji') || '🍀';
    const root = searchParams.get('root') || 'seren (平静) + dipity';
    const quoteSource = searchParams.get('quoteSource') || 'Everyday life';
    const streak = searchParams.get('streak') || '42';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#09090b', 
            backgroundImage: 'radial-gradient(circle at 50% 10%, #3b0764 0%, #09090b 80%)',
            padding: '40px',
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Main Card (Mobile Portrait Proportions) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(160deg, rgba(39, 39, 42, 0.9) 0%, rgba(24, 24, 27, 0.9) 100%)',
              padding: '60px 50px',
              borderRadius: '40px',
              boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              width: '720px',
              height: '1120px', // Fixed height to make it a perfect tall card
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Dynamic Emoji Watermark */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '20px',
                fontSize: '320px',
                opacity: 0.05,
                transform: 'rotate(15deg)',
                filter: 'grayscale(100%)',
              }}
            >
              {emoji}
            </div>

            {/* Top Bar: Badge & Date */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '50px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  background: 'rgba(139, 92, 246, 0.15)', 
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '18px', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.05em' }}>
                    🔥 DAY {streak}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '20px', color: '#52525b', fontWeight: 500, letterSpacing: '0.1em' }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()}
              </span>
            </div>

            {/* Word Section */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span
                style={{
                  fontSize: '90px', // Slightly smaller to accommodate longer words on mobile
                  fontWeight: 800,
                  color: '#f8fafc', 
                  lineHeight: 1.1,
                  marginBottom: '24px',
                  letterSpacing: '-0.02em',
                }}
              >
                {word}
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                <span style={{ 
                  fontSize: '34px', 
                  color: '#8b5cf6', 
                  fontWeight: 500, 
                  fontStyle: 'italic',
                }}>
                  {phonetic}
                </span>
                
                {/* Etymology Tag */}
                <div style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  alignSelf: 'flex-start',
                }}>
                  <span style={{ fontSize: '20px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {root}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  width: '100%',
                  height: '1px',
                  background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.4) 0%, rgba(255,255,255,0.02) 100%)',
                  marginBottom: '40px',
                }}
              />

              {/* Meaning & Example */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Meaning */}
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '32px', background: '#10b981', borderRadius: '3px', marginRight: '20px', marginTop: '6px' }} />
                  <span style={{ fontSize: '36px', color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
                    {meaning}
                  </span>
                </div>

                {/* Example Quote */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '30px 36px',
                  borderRadius: '20px',
                  borderLeft: '5px solid #8b5cf6',
                  marginTop: '10px'
                }}>
                  <span style={{ fontSize: '32px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '20px' }}>
                    "{example}"
                  </span>
                  <span style={{ fontSize: '20px', color: '#64748b', fontWeight: 500, textAlign: 'right' }}>
                    {quoteSource}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'center', alignItems: 'center' }}>
               <span style={{ fontSize: '18px', color: '#3f3f46', fontWeight: 600, letterSpacing: '2px' }}>
                 ✦ QWEN & SATORI ✦
               </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 800,    // Portrait width
        height: 1200,  // Portrait height
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
}
