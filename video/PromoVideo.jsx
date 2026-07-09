import React from 'react';
import { 
  useVideoConfig, 
  useCurrentFrame, 
  interpolate, 
  spring, 
  AbsoluteFill 
} from 'remotion';

export const PromoVideo = ({ title = "새로운 소식 알림", highlights = ["핵심 내용 1", "핵심 내용 2", "핵심 내용 3"] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background animation (moving fluid glowing blobs for premium mesh gradient feel)
  const blob1X = interpolate(frame, [0, 450], [-100, 100], { extrapolateRight: "clamp" });
  const blob2Y = interpolate(frame, [0, 450], [100, -100], { extrapolateRight: "clamp" });

  // Title springs
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12 },
    delay: 10,
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.85, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Highlights animations (staggered entries at 2s, 4s, 6s)
  const h1Spring = spring({ frame, fps, config: { damping: 14 }, delay: 60 });
  const h2Spring = spring({ frame, fps, config: { damping: 14 }, delay: 120 });
  const h3Spring = spring({ frame, fps, config: { damping: 14 }, delay: 180 });

  const h1Slide = interpolate(h1Spring, [0, 1], [-100, 0]);
  const h1Opacity = interpolate(h1Spring, [0, 1], [0, 1]);
  
  const h2Slide = interpolate(h2Spring, [0, 1], [-100, 0]);
  const h2Opacity = interpolate(h2Spring, [0, 1], [0, 1]);
  
  const h3Slide = interpolate(h3Spring, [0, 1], [-100, 0]);
  const h3Opacity = interpolate(h3Spring, [0, 1], [0, 1]);

  // End Card CTA animation (starts at 9s, frame 270)
  const ctaSpring = spring({ frame, fps, config: { damping: 11 }, delay: 270 });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.5, 1]);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);

  // Pulsating glow loop for CTA button
  const pulse = Math.sin(frame * 0.15) * 0.08 + 1.0;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#070a13',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Mesh Gradient Background Blobs */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.4) 0%, rgba(37,99,235,0) 70%)',
        filter: 'blur(80px)',
        top: '-100px',
        left: `${blob1X}px`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(147,51,234,0) 70%)',
        filter: 'blur(70px)',
        bottom: '-50px',
        right: '100px',
        transform: `translateY(${blob2Y}px)`,
        pointerEvents: 'none',
      }} />

      {/* Main Container */}
      <div style={{
        padding: '60px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
        zIndex: 10
      }}>
        {/* Header Branding */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 0 10px rgba(59,130,246,0.5)'
          }} />
          <span style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '1px',
            background: 'linear-gradient(90deg, #60a5fa, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>NOADO 노아도</span>
        </div>

        {/* Middle Article Card & Highlights */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          margin: 'auto 0'
        }}>
          {/* Post Title Card */}
          <div style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '30px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{
              color: '#3b82f6',
              fontSize: '18px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              display: 'block',
              marginBottom: '12px'
            }}>TODAY'S TOPIC</span>
            <h1 style={{
              fontSize: '36px',
              fontWeight: 800,
              lineHeight: 1.3,
              margin: 0,
              color: '#ffffff',
              wordBreak: 'keep-all'
            }}>{title}</h1>
          </div>

          {/* Highlights Bullets */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            paddingLeft: '10px'
          }}>
            {/* Highlight 1 */}
            <div style={{
              opacity: h1Opacity,
              transform: `translateX(${h1Slide}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                boxShadow: '0 0 8px #3b82f6'
              }} />
              <span style={{ fontSize: '22px', fontWeight: 600, color: '#e2e8f0' }}>{highlights[0]}</span>
            </div>

            {/* Highlight 2 */}
            <div style={{
              opacity: h2Opacity,
              transform: `translateX(${h2Slide}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#a855f7',
                boxShadow: '0 0 8px #a855f7'
              }} />
              <span style={{ fontSize: '22px', fontWeight: 600, color: '#e2e8f0' }}>{highlights[1]}</span>
            </div>

            {/* Highlight 3 */}
            <div style={{
              opacity: h3Opacity,
              transform: `translateX(${h3Slide}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 8px #22c55e'
              }} />
              <span style={{ fontSize: '22px', fontWeight: 600, color: '#e2e8f0' }}>{highlights[2]}</span>
            </div>
          </div>
        </div>

        {/* End Card CTA Button */}
        <div style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          textAlign: 'center',
          width: '100%',
          marginTop: '30px'
        }}>
          <div style={{
            display: 'inline-block',
            padding: '18px 36px',
            borderRadius: '50px',
            background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
            color: '#ffffff',
            fontSize: '22px',
            fontWeight: 800,
            boxShadow: '0 10px 25px rgba(37,99,235,0.4)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: `scale(${pulse})`,
            transition: 'transform 0.1s linear'
          }}>
            자세한 내용은 noado.kr에서!
          </div>
          <p style={{
            fontSize: '14px',
            color: '#94a3b8',
            marginTop: '16px',
            letterSpacing: '0.5px'
          }}>네이버/구글 검색창에 '노아도 정보광장'을 검색하세요</p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
