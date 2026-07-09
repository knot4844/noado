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

  // Background animation (mesh blobs moving slowly)
  const blob1X = interpolate(frame, [0, 450], [-100, 150], { extrapolateRight: "clamp" });
  const blob2Y = interpolate(frame, [0, 450], [150, -100], { extrapolateRight: "clamp" });

  // 1. Title segment (0s - 3s: frames 0 - 90)
  const titleOpacity = interpolate(frame, [0, 15, 75, 90], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleScale = interpolate(frame, [0, 15, 75, 90], [0.85, 1.05, 1, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 2. Highlight 1 segment (3s - 6s: frames 90 - 180)
  const h1Opacity = interpolate(frame, [85, 100, 165, 180], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const h1Scale = interpolate(frame, [85, 100, 165, 180], [0.85, 1.05, 1, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 3. Highlight 2 segment (6s - 9s: frames 180 - 270)
  const h2Opacity = interpolate(frame, [175, 190, 255, 270], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const h2Scale = interpolate(frame, [175, 190, 255, 270], [0.85, 1.05, 1, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 4. Highlight 3 segment (9s - 12s: frames 270 - 360)
  const h3Opacity = interpolate(frame, [265, 280, 345, 360], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const h3Scale = interpolate(frame, [265, 280, 345, 360], [0.85, 1.05, 1, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 5. Outro CTA segment (12s - 15s: frames 360 - 450)
  const ctaOpacity = interpolate(frame, [355, 370], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaScale = interpolate(frame, [355, 370], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Pulsating glow loop for CTA button
  const pulse = Math.sin(frame * 0.15) * 0.06 + 1.0;

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
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(37,99,235,0) 70%)',
        filter: 'blur(90px)',
        top: '-150px',
        left: `${blob1X}px`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(147,51,234,0.35) 0%, rgba(147,51,234,0) 70%)',
        filter: 'blur(80px)',
        bottom: '-100px',
        right: '50px',
        transform: `translateY(${blob2Y}px)`,
        pointerEvents: 'none',
      }} />

      {/* Main Container */}
      <div style={{
        padding: '80px 40px 60px',
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
          gap: '14px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 0 12px rgba(59,130,246,0.6)'
          }} />
          <span style={{
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '1.5px',
            background: 'linear-gradient(90deg, #60a5fa, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>NOADO 정보광장</span>
        </div>

        {/* Center Caption Box */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 10px',
        }}>
          {/* Title Scene (0s - 3s) */}
          {frame < 90 && (
            <div style={{
              opacity: titleOpacity,
              transform: `scale(${titleScale})`,
              textAlign: 'center',
              position: 'absolute',
              width: '100%',
            }}>
              <span style={{
                color: '#3b82f6',
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '3px',
                display: 'block',
                marginBottom: '20px'
              }}>오늘의 실시간 정보</span>
              <h1 style={{
                fontSize: '54px',
                fontWeight: 900,
                lineHeight: 1.35,
                margin: 0,
                color: '#ffffff',
                wordBreak: 'keep-all',
                textShadow: '0 4px 16px rgba(0,0,0,0.6)',
                background: 'linear-gradient(90deg, #ffffff, #93c5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>{title}</h1>
            </div>
          )}

          {/* Highlight 1 Scene (3s - 6s) */}
          {frame >= 85 && frame < 180 && (
            <div style={{
              opacity: h1Opacity,
              transform: `scale(${h1Scale})`,
              textAlign: 'center',
              position: 'absolute',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '32px',
              padding: '50px 30px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{
                color: '#3b82f6',
                fontSize: '22px',
                fontWeight: 900,
                display: 'block',
                marginBottom: '20px',
                letterSpacing: '1.5px'
              }}>체크 포인트 01</span>
              <p style={{
                fontSize: '44px',
                fontWeight: 800,
                lineHeight: 1.45,
                margin: 0,
                color: '#ffffff',
                wordBreak: 'keep-all',
              }}>{highlights[0]}</p>
            </div>
          )}

          {/* Highlight 2 Scene (6s - 9s) */}
          {frame >= 175 && frame < 270 && (
            <div style={{
              opacity: h2Opacity,
              transform: `scale(${h2Scale})`,
              textAlign: 'center',
              position: 'absolute',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '32px',
              padding: '50px 30px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{
                color: '#a855f7',
                fontSize: '22px',
                fontWeight: 900,
                display: 'block',
                marginBottom: '20px',
                letterSpacing: '1.5px'
              }}>체크 포인트 02</span>
              <p style={{
                fontSize: '44px',
                fontWeight: 800,
                lineHeight: 1.45,
                margin: 0,
                color: '#ffffff',
                wordBreak: 'keep-all',
              }}>{highlights[1]}</p>
            </div>
          )}

          {/* Highlight 3 Scene (9s - 12s) */}
          {frame >= 265 && frame < 360 && (
            <div style={{
              opacity: h3Opacity,
              transform: `scale(${h3Scale})`,
              textAlign: 'center',
              position: 'absolute',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '32px',
              padding: '50px 30px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{
                color: '#22c55e',
                fontSize: '22px',
                fontWeight: 900,
                display: 'block',
                marginBottom: '20px',
                letterSpacing: '1.5px'
              }}>체크 포인트 03</span>
              <p style={{
                fontSize: '44px',
                fontWeight: 800,
                lineHeight: 1.45,
                margin: 0,
                color: '#ffffff',
                wordBreak: 'keep-all',
              }}>{highlights[2]}</p>
            </div>
          )}

          {/* Outro CTA Scene (12s - 15s) */}
          {frame >= 355 && (
            <div style={{
              opacity: ctaOpacity,
              transform: `scale(${ctaScale})`,
              textAlign: 'center',
              position: 'absolute',
              width: '100%',
            }}>
              <div style={{
                display: 'inline-block',
                padding: '24px 48px',
                borderRadius: '50px',
                background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                color: '#ffffff',
                fontSize: '36px',
                fontWeight: 900,
                boxShadow: '0 15px 35px rgba(37,99,235,0.5)',
                border: '1px solid rgba(255,255,255,0.25)',
                transform: `scale(${pulse})`,
                marginBottom: '28px'
              }}>
                noado.kr 에서 확인!
              </div>
              <p style={{
                fontSize: '24px',
                color: '#94a3b8',
                margin: '10px 0 0',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}>네이버에 '노아도 정보광장' 검색</p>
            </div>
          )}
        </div>

        {/* Footer info (keeps stable at bottom) */}
        <div style={{
          textAlign: 'center',
          fontSize: '16px',
          color: '#475569',
          letterSpacing: '1px'
        }}>
          ⓒ NOADO INFORMATION PORTAL
        </div>
      </div>
    </AbsoluteFill>
  );
};
