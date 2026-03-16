
import React, { useState, useRef, useLayoutEffect } from 'react';
import styled, { css, keyframes } from 'styled-components';
import Atropos from 'atropos/react';
import { Suspect, Emotion } from '../types';
import { getPixelArtUrl, getSuspectColor, getSuspectBackingColor } from '../services/gameHelpers';
import SuspectPortrait from './SuspectPortrait';

interface CardWrapperProps {
  $width: string;
  $height: string;
  $variant: 'default' | 'compact' | 'peek';
}

const CardWrapper = styled.div<CardWrapperProps>`
  width: ${props => props.$width};
  height: ${props => props.$height};
  min-height: ${props => props.$height};
  flex-shrink: 0;
  perspective: 1000px;
  cursor: pointer;
  position: relative;
  
  /* 
     Reset typography scale locally. 
     This prevents global font scaling from breaking the layout inside the fixed-size card container.
     The entire card is scaled via CSS transform on the parent, so internal fonts should stay static relative to the card size.
  */
  --type-h2: 2rem;
  --type-h3: 1.5rem;
  --type-body-lg: 1.2rem;
  --type-body: 1rem;
  --type-small: 0.85rem;
  
  /* CRITICAL OVERRIDES FOR ATROPOS INTERACTIVITY */
  .my-atropos {
    width: 100%;
    height: 100%;
    background: transparent;
    display: block; 
  }
  
  /* Ensure 3D context is preserved all the way down */
  .atropos-scale, 
  .atropos-rotate, 
  .atropos-inner,
  .atropos-content {
    width: 100%;
    height: 100%;
    transform-style: preserve-3d !important; 
    overflow: visible !important; 
    /* 
       Atropos layers often catch all pointer events. 
       We set them to none and re-enable only on the content we want.
    */
    pointer-events: none;
  }

  .atropos-content {
    pointer-events: auto;
  }
`;

const FlipContainer = styled.div<{ $flipped: boolean }>`
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  transform-style: preserve-3d;
  transform: ${props => props.$flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'};
`;

/* 
   The container for the visual card content (borders, background, overflow).
   This clips the images/text but allows the button (sibling) to float outside.
*/
const ContentClipper = styled.div<{ $bgColor: string }>`
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  border-radius: 16px;
  border: 4px solid #fff;
  background: ${props => props.$bgColor};
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 20px rgba(0,0,0,0.5);
  z-index: 1; 
  pointer-events: auto; /* Enable clicks on the card body */

  /* Inner Border Line */
  &::after {
    content: '';
    position: absolute;
    top: 6px; left: 6px; right: 6px; bottom: 6px;
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 10px;
    pointer-events: none;
    z-index: 5; /* Ensure border sits on top of image */
  }
`;

/* The 3D Face Container - Transparent */
const CardFace = styled.div<{ $active: boolean }>`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 16px;
  transform-style: preserve-3d;
  pointer-events: ${props => props.$active ? 'auto' : 'none'};
  z-index: ${props => props.$active ? 2 : 1};
`;

const CardBackFace = styled(CardFace)`
  transform: rotateY(180deg);
`;

// --- FRONT STYLES ---

const Header = styled.div<{ $compact?: boolean }>`
  padding: ${props => props.$compact ? '10px' : '20px 20px 10px 20px'};
  text-align: center;
  z-index: 2;
  transform: translateZ(20px); 
`;

// --- MARQUEE & SCALING NAME SYSTEM ---

const scrollAnimation = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const NameContainer = styled.div<{ $compact?: boolean }>`
  position: relative;
  height: ${props => props.$compact ? '1.8rem' : '2.2rem'};
  margin-bottom: 5px;
  width: 100%;
  overflow: hidden;
  
  /* Flex centering helps when scaling results in slightly smaller text */
  display: flex;
  align-items: center;
  justify-content: center;

  /* Marquee Logic: On hover, hide static, show track */
  &:hover .hide-on-hover {
    opacity: 0;
  }
  &:hover .show-on-hover {
    opacity: 1;
    animation-play-state: running; 
  }
`;

const nameBaseStyles = css<{ $compact?: boolean }>`
  margin: 0;
  /* Base font size, will be overridden by inline style for scaling */
  font-size: ${props => props.$compact ? 'var(--type-h3)' : 'var(--type-h2)'};
  letter-spacing: 1px;
  text-transform: uppercase;
  text-shadow: 2px 2px 0px #000;
  white-space: nowrap;
  font-family: 'VT323', monospace;
  font-weight: bold;
  line-height: 1;
`;

const StaticName = styled.h2<{ $compact?: boolean }>`
  ${nameBaseStyles}
  overflow: hidden;
  /* Removed text-overflow: ellipsis to prevent the "little line" artifact on truncation */
  width: 100%;
  transition: opacity 0.2s;
  text-align: center;
`;

const MarqueeTrack = styled.div<{ $compact?: boolean; $duration: number }>`
  display: flex;
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  align-items: center;
  width: max-content; /* Allow track to be wider than container */
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  animation: ${scrollAnimation} ${props => props.$duration}s linear infinite;
  animation-play-state: paused;

  h2 {
    ${nameBaseStyles}
    margin-right: 30px; /* Spacer for the loop */
  }
`;

const ResponsiveName: React.FC<{ text: string; compact?: boolean }> = ({ text, compact }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scale: 1, isMarquee: false, duration: 5 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      const container = containerRef.current;
      if (!container || container.clientWidth === 0) return;

      const containerWidth = container.clientWidth;
      
      // Use a temporary span in the DOM to measure accurate width including webfonts
      const span = document.createElement('span');
      span.style.fontFamily = "'VT323', monospace";
      span.style.fontSize = compact ? '1.5rem' : '2rem'; // Match h3 / h2 vars
      span.style.fontWeight = 'bold';
      span.style.letterSpacing = '1px';
      span.style.textTransform = 'uppercase';
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'nowrap';
      span.textContent = text;
      document.body.appendChild(span);
      
      const textWidth = span.offsetWidth;
      document.body.removeChild(span);

      if (textWidth <= containerWidth) {
        setState({ scale: 1, isMarquee: false, duration: 0 });
      } else {
        const ratio = containerWidth / textWidth;
        // Use 90% of the ratio as a safety buffer to ensure it strictly fits without touching edges
        const safeScale = ratio * 0.90;
        
        // Allow scaling down to 40%
        if (safeScale >= 0.4) {
           setState({ scale: safeScale, isMarquee: false, duration: 0 });
        } else {
           // Too big: Enable marquee, but keep static text scaled reasonably (clipped without ellipsis)
           const marqueeScale = 0.75;
           const scaledTextWidth = textWidth * marqueeScale;
           // Speed: ~50px/sec
           const duration = (scaledTextWidth + 30) / 40;
           setState({ scale: marqueeScale, isMarquee: true, duration });
        }
      }
    };

    // Measure immediately
    measure();
    
    // Also wait for fonts if they aren't ready (mostly for first load)
    document.fonts.ready.then(measure);

    // Watch for resize events
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);

    return () => {
        observer.disconnect();
    };
  }, [text, compact]);

  // Base size matches the CSS vars: h3 (1.5) or h2 (2.0)
  const baseSize = compact ? 1.5 : 2.0;

  return (
    <NameContainer ref={containerRef} $compact={compact} title={text}>
      {state.isMarquee ? (
        <>
          {/* Static state: Scaled down + Clipped (no ellipsis) */}
          <StaticName 
            $compact={compact} 
            className="hide-on-hover"
            style={{ fontSize: `${baseSize * state.scale}rem` }}
          >
            {text}
          </StaticName>
          
          {/* Hover state: Marquee */}
          <MarqueeTrack $compact={compact} $duration={state.duration} className="show-on-hover">
             <h2 style={{ fontSize: `${baseSize * state.scale}rem` }}>{text}</h2>
             <h2 style={{ fontSize: `${baseSize * state.scale}rem` }}>{text}</h2>
          </MarqueeTrack>
        </>
      ) : (
        // Fit mode: Just render static text with calculated scale
        <StaticName 
          $compact={compact} 
          style={{ 
            fontSize: `${baseSize * state.scale}rem`
          }}
        >
          {text}
        </StaticName>
      )}
    </NameContainer>
  );
};

// --- END NAME SYSTEM ---

const Subtitle = styled.div`
  font-size: var(--type-body);
  opacity: 0.9;
  margin-top: 5px;
`;

/* 
   Button sits OUTSIDE the ContentClipper.
   High Z-Index and TranslateZ are crucial.
   Pointer Events AUTO is crucial.
*/
const FlipButton = styled.button<{ $isBack?: boolean }>`
  position: absolute;
  bottom: 15px;
  ${props => props.$isBack ? 'left: 15px;' : 'right: 15px;'}
  font-family: inherit;
  font-size: var(--type-small);
  font-weight: bold;
  color: #fff;
  background: rgba(0,0,0,0.85);
  padding: 8px 14px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 9999 !important; /* Force to top */
  border: 1px solid rgba(255,255,255,0.6);
  transform: translateZ(100px); /* Move significantly towards camera */
  pointer-events: auto !important; /* Force enable events */
  transition: all 0.1s ease-in-out;
  box-shadow: 0 5px 15px rgba(0,0,0,0.6);

  &:hover {
    background: #fff;
    color: #000;
    transform: translateZ(105px) scale(1.1);
    box-shadow: 0 0 10px #fff;
    border-color: #fff;
  }

  &:active {
    background: #f00;
    border-color: #f00;
    color: #fff;
    transform: translateZ(95px) scale(0.95);
  }
`;

// --- BACK STYLES ---

const BackContent = styled.div<{ $allowHorizontalScroll?: boolean }>`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  touch-action: ${props => props.$allowHorizontalScroll ? 'pan-x pan-y' : 'pan-y'} !important;
  margin-top: 0;
  margin-bottom: 30px; 
  padding: 0 20px 20px 20px;
  z-index: 20; 
  position: relative;
  pointer-events: auto !important;
  isolation: isolate; /* Create new stacking context */

  &::-webkit-scrollbar { 
    width: 10px; /* Wider for easier interaction */
    display: block !important;
  }
  &::-webkit-scrollbar-track { 
    background: rgba(0,0,0,0.3); 
    border-radius: 5px;
  }
  &::-webkit-scrollbar-thumb { 
    background: rgba(255, 255, 255, 0.8); 
    border-radius: 5px;
    border: 2px solid rgba(0,0,0,0.2);
    &:hover {
      background: #fff;
    }
  }
`;

const InfoList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const InfoItem = styled.li`
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  font-size: var(--type-body);
  line-height: 1.3;
  
  strong {
    color: #aaa;
    font-size: var(--type-small);
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  
  span {
    color: #fff;
  }
`;

interface SuspectCardProps {
  suspect: Suspect;
  emotion?: Emotion;
  aggravation?: number;
  width?: string;
  height?: string;
  onAction?: () => void;
  actionLabel?: string;
  variant?: 'default' | 'compact' | 'peek';
  style?: React.CSSProperties; 
  className?: string;
  turnId?: string;
  onFlip?: (isFlipped: boolean) => void;
  id?: string;
  disableTouchRotation?: boolean;
}

const SuspectCard: React.FC<SuspectCardProps> = ({ 
  suspect, 
  emotion = Emotion.NEUTRAL, 
  aggravation = 0,
  width = "300px", 
  height = "450px",
  onAction,
  actionLabel = "INTERROGATE",
  variant = 'default',
  style,
  className,
  turnId,
  onFlip,
  id,
  disableTouchRotation = false
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Determine Dimensions
  let finalWidth = width;
  let finalHeight = height;

  if (variant === 'compact') {
    if (width === "300px") finalWidth = "100%";
    if (height === "450px") finalHeight = "180px";
  } else if (variant === 'peek') {
    if (width === "300px") finalWidth = "200px";
    if (height === "450px") finalHeight = "300px";
  }

  const handleFlip = (e: React.MouseEvent | React.TouchEvent) => {
    console.log("[DEBUG] handleFlip triggered by:", e.type);
    e.stopPropagation(); 
    if ('preventDefault' in e) e.preventDefault();
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (onFlip) onFlip(nextFlipped);
  };

  const handleMainClick = (e: React.MouseEvent) => {
    // Navigate only if not clicking buttons (handled by bubbling check usually, but safe to keep)
    if (onAction) {
      onAction();
    }
  };

  const bgColor = getSuspectColor(suspect.avatarSeed);
  const backColor = getSuspectBackingColor(suspect.avatarSeed);

  return (
    <CardWrapper 
      id={id}
      $width={finalWidth} 
      $height={finalHeight} 
      $variant={variant}
      onClick={handleMainClick}
      title={variant === 'peek' ? `Switch to ${suspect.name}` : undefined}
      style={style}
      className={className}
      data-cursor="pointer"
    >
      <Atropos 
        activeOffset={disableTouchRotation ? 0 : 40} 
        shadow={false} 
        highlight={false} 
        className="my-atropos"
        rotateXMax={disableTouchRotation ? 0 : (variant === 'peek' ? 5 : 15)}
        rotateYMax={disableTouchRotation ? 0 : (variant === 'peek' ? 5 : 15)}
        rotateTouch={disableTouchRotation ? false : (isFlipped ? false : 'scroll-y')} /* Allow scrolling on touch */
      >
        <FlipContainer $flipped={isFlipped}>
          
          {/* --- FRONT FACE --- */}
          <CardFace $active={!isFlipped}>
            <ContentClipper $bgColor={bgColor}>
                {variant === 'compact' ? (
                    // COMPACT LAYOUT
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                        <div style={{ width: '150px', minWidth: '150px', height: '100%', position: 'relative', borderRight: '2px solid rgba(255,255,255,0.2)' }}>
                            <SuspectPortrait 
                                suspect={suspect} 
                                size={200}
                                turnId={turnId}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }} 
                            />
                        </div>
                        <div style={{ flex: 1, padding: '10px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                            <ResponsiveName text={suspect.name} compact />
                            <Subtitle>{suspect.role}</Subtitle>
                        </div>
                    </div>
                ) : (
                    // DEFAULT & PEEK LAYOUT (FULL BLEED)
                    <>
                        {/* Background Layer (Absolute) */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
                            <SuspectPortrait 
                                suspect={suspect} 
                                // Removed hardcoded size={600} to allow auto-fill relative to container
                                emotion={emotion}
                                aggravation={aggravation}
                                turnId={turnId}
                            />
                        </div>

                        {/* Content Overlay (Relative to sit on top) */}
                        <Header data-atropos-offset="5" style={{ 
                            position: 'relative', 
                            zIndex: 2, 
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                            paddingBottom: '40px',
                            paddingTop: '30px'
                        }}>
                          <ResponsiveName text={suspect.name} />
                          <Subtitle style={{ textShadow: '0 2px 4px #000' }}>Age: {suspect.age}</Subtitle>
                        </Header>
                    </>
                )}
            </ContentClipper>
            
            {/* FLOATING CONTROLS (Outside Clipper) */}
            {variant === 'compact' && onAction && (
                 <div style={{ position: 'absolute', right: '15px', bottom: '15px', zIndex: 100, transform: 'translateZ(60px)' }}>
                     <button style={{ background: '#fff', color: bgColor, border: 'none', fontWeight: 'bold', padding: '5px 10px', cursor: 'pointer' }} 
                        onClick={(e) => { e.stopPropagation(); onAction(); }}>
                       [{actionLabel}]
                     </button>
                 </div>
            )}

            {variant === 'default' && (
                <FlipButton 
                  id="flip-card-button"
                  onClick={handleFlip} 
                  onTouchEnd={handleFlip}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                [Flip Card]
                </FlipButton>
            )}
          </CardFace>

          {/* --- BACK FACE --- */}
          <CardBackFace $active={isFlipped}>
            <ContentClipper $bgColor={backColor} style={{ overflow: isFlipped ? 'visible' : 'hidden' }}>
                <Header>
                  <ResponsiveName text={suspect.name} />
                </Header>

                <BackContent 
                  $allowHorizontalScroll={disableTouchRotation}
                  onWheel={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    e.currentTarget.scrollTop += e.deltaY;
                  }}
                  onTouchMove={disableTouchRotation ? undefined : (e) => e.stopPropagation()}
                >
                  <InfoList>
                    <InfoItem>
                        <strong>Role</strong>
                        <span>{suspect.role}</span>
                    </InfoItem>
                    <InfoItem>
                        <strong>Public Profile</strong>
                        <span>{suspect.bio}</span>
                    </InfoItem>
                    <InfoItem>
                        <strong>Profession</strong>
                        <span>{suspect.professionalBackground}</span>
                    </InfoItem>
                    <InfoItem>
                        <strong>Status</strong>
                        <span>Person of Interest</span>
                    </InfoItem>
                  </InfoList>
                </BackContent>
            </ContentClipper>

            {/* Back Controls */}
            <FlipButton 
              id="flip-card-button-back"
              $isBack
              onClick={handleFlip} 
              onTouchEnd={handleFlip}
              onMouseDown={(e) => e.stopPropagation()}
            >
              [Flip Card]
            </FlipButton>
          </CardBackFace>

        </FlipContainer>
      </Atropos>
    </CardWrapper>
  );
};

export default SuspectCard;
