
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type } from '../theme';
import styled from 'styled-components';
import { CaseData, CaseStats } from '../types';


/* ─── Theme System ─── */

type CardTheme = 'green' | 'cyan' | 'gold';

const THEME_COLORS: Record<CardTheme, { border: string; bright: string; glow: string; badgeBg: string }> = {
  green: { border: '#0a0', bright: '#0f0', glow: 'rgba(0, 255, 0, 0.2)', badgeBg: '#031' },
  cyan: { border: '#0aa', bright: '#0ff', glow: 'rgba(0, 255, 255, 0.2)', badgeBg: '#044' },
  gold: { border: '#a80', bright: '#fc0', glow: 'rgba(255, 200, 0, 0.2)', badgeBg: '#442' },
};

const getTheme = (theme?: CardTheme) => THEME_COLORS[theme || 'cyan'];

/* ─── Layout ─── */

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px var(--screen-edge-horizontal);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: calc(var(--space) * 5);
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const HeaderTitle = styled.h2`
  margin: 0;
`;

/* ─── Tab Bars ─── */

const TabBar = styled.div`
  display: flex;
  gap: calc(var(--space) * 3);
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileBottomTabBar = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    background: var(--color-surface-raised);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    padding: 0 var(--screen-edge-horizontal);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
`;

const TabButton = styled.button<{ $active: boolean; $color: string }>`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? props.$color : 'transparent'};
  color: ${props => props.$active ? props.$color : 'var(--color-text-dim)'};
  font-family: inherit;
  ${type.h3}
  padding: var(--space) calc(var(--space) * 2);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;

  &:hover {
    color: ${props => props.$color};
    text-shadow: 0 0 10px ${props => props.$color};
  }
`;

const BottomTabButton = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  background: transparent;
  border: none;
  border-top: 3px solid ${props => props.$active ? props.$color : 'transparent'};
  color: ${props => props.$active ? props.$color : 'var(--color-text-dim)'};
  font-family: inherit;
  ${type.bodyLg}
  font-weight: bold;
  padding: calc(var(--space) * 2) var(--space);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
`;

/* ─── Sort Controls ─── */

const SortBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space);
  margin-left: auto;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const MobileSortBar = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space);
    padding: 10px 5vw 0;
    flex-shrink: 0;
  }
`;

const SortLabel = styled.span`
  color: var(--color-text-disabled);
  ${type.small}
  text-transform: uppercase;
`;

const SortButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(0, 255, 255, 0.15)' : 'transparent'};
  border: 1px solid ${props => props.$active ? '#0ff' : 'var(--color-border)'};
  color: ${props => props.$active ? '#0ff' : 'var(--color-text-dim)'};
  padding: var(--space) calc(var(--space) * 2);
  font-family: inherit;
  ${type.small}
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    border-color: #0ff;
    color: #0ff;
  }
`;

/* ─── Grid Layouts ─── */


const NetworkGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(var(--space) * 2);
  padding: 40px var(--screen-edge-horizontal);
  overflow-y: auto;
  flex: 1;
  height: 100%;
  min-height: 0;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 1000px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    display: flex;
    padding: 15px var(--screen-edge-horizontal);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;

    & > div {
      flex: 0 0 90vw;
      scroll-snap-align: center;
      max-height: none;
      height: 100%;
      overflow-y: hidden;
    }
  }
`;

/* ─── Case Card ─── */

const CaseCard = styled.div<{ $theme?: CardTheme; $isActive?: boolean }>`
  border: 2px solid ${props => getTheme(props.$theme).border};
  padding: calc(var(--space) * 3);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-surface-raised);
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 100%;

  @media (min-width: 769px) {
    &:hover {
      border-color: ${props => getTheme(props.$theme).bright};
      transform: translateY(-2px);
      box-shadow: 0 0 15px ${props => getTheme(props.$theme).glow};
    }
  }

  @media (max-width: 768px) {
    overflow: hidden;
    
    ${props => props.$isActive && `
      border-color: ${getTheme(props.$theme).bright};
      transform: translateY(-2px);
      box-shadow: 0 0 15px ${getTheme(props.$theme).glow};
    `}
    
    &:active {
      border-color: ${props => getTheme(props.$theme).bright};
      transform: translateY(-2px);
      box-shadow: 0 0 15px ${props => getTheme(props.$theme).glow};
    }
  }
`;

const CaseImage = styled.div<{ $src?: string }>`
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: calc(80vh - 200px);
  max-width: calc(80vh - 200px);
  background-color: #080808;
  background-image: ${props => props.$src && props.$src !== 'PLACEHOLDER' ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  border: 1px solid var(--color-border);
  image-rendering: pixelated;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-border);
  ${type.small}
  text-transform: uppercase;
  flex-shrink: 0;
`;

const CardTextContent = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 0;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    -webkit-overflow-scrolling: touch;
    margin-right: -20px;
    padding-right: calc(var(--space) * 3);
    padding-bottom: calc(var(--space) * 3);
    
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: var(--color-border); }
  }
`;

const CardTitle = styled.h3<{ $color: string }>`
  color: ${props => props.$color};
  ${type.h3}
  margin: 0 0 5px 0;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  margin-bottom: var(--space);
`;

const Badge = styled.span<{ $bg: string; $color: string }>`
  background: ${props => props.$bg};
  color: ${props => props.$color};
  padding: 0 var(--space);
  ${type.small}
  font-weight: bold;
  text-transform: uppercase;
`;

const TypeBadge = styled.span<{ $bg: string; $color: string }>`
  background: ${props => props.$bg};
  color: ${props => props.$color};
  padding: 0 var(--space);
  ${type.small}
`;

const DifficultyLabel = styled.span<{ $difficulty: string }>`
  color: ${props => props.$difficulty === 'Hard' ? 'red' : props.$difficulty === 'Medium' ? 'var(--color-accent-orange)' : 'green'};
  ${type.small}
`;

const VersionLabel = styled.span`
  color: var(--color-text-disabled);
  ${type.small}
`;

const AuthorLine = styled.div`
  color: var(--color-text-dim);
  ${type.small}
  margin-top: var(--space);
  font-style: italic;
`;

const Description = styled.p`
  color: var(--color-text-muted);
  margin: 5px 0 0 0;
  ${type.body}
  line-height: 1.4;
`;

const StatsLine = styled.div`
  display: flex;
  gap: calc(var(--space) * 2);
  align-items: center;
  margin-top: var(--space);
  ${type.small}
  color: var(--color-text-disabled);
`;

const UpvoteStat = styled.span`
  color: #0a0;
`;

const DownvoteStat = styled.span`
  color: #a00;
`;

/* ─── Special Cards ─── */

const CreateCard = styled(CaseCard)`
  border: 2px dashed #0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgba(0, 50, 0, 0.2);
  
  @media (min-width: 769px) {
    &:hover {
      border-color: #fff;
      background: rgba(0, 50, 0, 0.4);
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
    }
  }

  h3 { color: #0f0 !important; }
  
  @media (max-width: 768px) {
    height: 150px;
    min-height: 150px;
  }
`;

const CreateCardTitle = styled.h3`
  ${type.h3}
  margin: 0;
`;

/* ─── Admin Controls ─── */

const AdminControls = styled.div`
  display: flex;
  gap: var(--space);
  margin-top: auto;
  padding-top: calc(var(--space) * 2);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
`;

const AdminButton = styled.button<{ $variant?: 'delete' | 'feature' | 'publish' }>`
  background: ${props => props.$variant === 'delete' ? 'rgba(255, 0, 0, 0.1)' : props.$variant === 'publish' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 0, 0.1)'};
  border: 1px solid ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
  color: ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
  padding: var(--space) var(--space);
  font-family: inherit;
  ${type.xs}
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
    color: #000;
  }
`;

/* ─── Status Messages ─── */

const EmptyMessage = styled.div<{ $color?: string; $fullWidth?: boolean }>`
  color: ${props => props.$color || 'var(--color-text-disabled)'};
  padding: calc(var(--space) * 3);
  ${props => props.$fullWidth && 'grid-column: 1 / -1;'}
`;

/* ─── Component ─── */

interface CaseSelectionProps {
  communityCases: CaseData[];
  localDrafts: CaseData[];
  caseStats: Record<string, CaseStats>;
  onSelectCase: (caseId: string) => void;
  onCreateNew: () => void;
  isLoadingCommunity: boolean;
  isAdmin?: boolean;
  userId?: string;
  onDeleteCase?: (caseId: string) => void;
  onToggleFeatured?: (caseId: string, isFeatured: boolean) => void;
  onEditCase?: (caseId: string) => void;
  onPublishDraft?: (caseId: string) => void;
  onDeleteDraft?: (caseId: string) => void;
  onPlayDraft?: (caseData: CaseData) => void;
  onUnpublish?: (caseId: string) => void;
  onDeleteMyCase?: (caseId: string) => void;
  initialTab?: 'featured' | 'network' | 'mycases';
  onTabChange?: (tab: 'featured' | 'network' | 'mycases') => void;
}

const CaseSelection: React.FC<CaseSelectionProps> = ({
  communityCases,
  localDrafts,
  caseStats,
  onSelectCase,
  onCreateNew,
  isLoadingCommunity,
  isAdmin,
  userId,
  onDeleteCase,
  onToggleFeatured,
  onEditCase,
  onPublishDraft,
  onDeleteDraft,
  onPlayDraft,
  onUnpublish,
  onDeleteMyCase,
  initialTab = 'featured',
  onTabChange
}) => {
  const [activeTab, setActiveTabLocal] = useState<'featured' | 'network' | 'mycases'>(initialTab);
  const setActiveTab = (tab: 'featured' | 'network' | 'mycases') => {
    setActiveTabLocal(tab);
    onTabChange?.(tab);
  };
  const [sortMode, setSortMode] = useState<'popular' | 'recent'>('popular');
  const carouselElRef = useRef<HTMLDivElement>(null);
  const networkGridRef = useRef<HTMLDivElement>(null);
  const [activeFeaturedId, setActiveFeaturedId] = useState<string | null>(null);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const [activeMyCaseId, setActiveMyCaseId] = useState<string | null>(null);
  const myCasesGridRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to detect centered card in carousel
  const observeCarousel = (container: HTMLElement | null, setActiveId: (id: string | null) => void) => {
    if (!container || window.innerWidth > 768) return;
    const cards = container.querySelectorAll('[data-case-id]');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null;
        entries.forEach(entry => {
          if (entry.isIntersecting && (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio)) {
            bestEntry = entry;
          }
        });
        if (bestEntry) {
          setActiveId((bestEntry as IntersectionObserverEntry).target.getAttribute('data-case-id'));
        }
      },
      { root: container, threshold: 0.6 }
    );
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  };

  useEffect(() => {
    if (networkGridRef.current) {
      networkGridRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [sortMode]);

  const featuredCases = useMemo(() => {
    const featured = communityCases.filter(c => c.isFeatured && c.isUploaded === true);
    // Featured: sorted by popularity (most plays first)
    return [...featured].sort((a, b) => {
      const aPlays = caseStats[a.id]?.plays || 0;
      const bPlays = caseStats[b.id]?.plays || 0;
      return bPlays - aPlays;
    });
  }, [communityCases, caseStats]);

  const sortedNetworkCases = useMemo(() => {
    // CRITICAL: Only show explicitly published cases on the network tab
    const cases = communityCases.filter(c => c.isUploaded === true);
    if (sortMode === 'popular') {
      return [...cases].sort((a, b) => {
        const aPlays = caseStats[a.id]?.plays || 0;
        const bPlays = caseStats[b.id]?.plays || 0;
        return bPlays - aPlays;
      });
    } else {
      return [...cases].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }
  }, [communityCases, caseStats, sortMode]);

  useEffect(() => {
    if (activeTab === 'featured') return observeCarousel(carouselElRef.current, setActiveFeaturedId);
  }, [activeTab, featuredCases.length]);

  useEffect(() => {
    if (activeTab === 'network') return observeCarousel(networkGridRef.current, setActiveNetworkId);
  }, [activeTab, sortedNetworkCases.length]);

  // Merge local drafts + published cases by this user (deduplicated by id)
  const myCases = useMemo(() => {
    const publishedByMe = communityCases.filter(c => c.authorId === userId);
    const publishedMap = new Map<string, CaseData>();
    publishedByMe.forEach(c => publishedMap.set(c.id, c));

    const merged = new Map<string, CaseData>();
    // Add drafts first, but merge fields from published version
    localDrafts.forEach(d => {
      const published = publishedMap.get(d.id);
      if (published) {
        // Use the LATEST updatedAt from either local or published (cross-device sync)
        const latestUpdatedAt = Math.max(d.updatedAt || 0, published.updatedAt || 0) || d.createdAt || published.createdAt;
        merged.set(d.id, {
          ...d,
          heroImageUrl: d.heroImageUrl || published.heroImageUrl,
          isFeatured: published.isFeatured,
          isUploaded: published.isUploaded ?? d.isUploaded,
          updatedAt: latestUpdatedAt
        });
      } else {
        merged.set(d.id, d);
      }
    });
    // Add published cases that aren't already in drafts
    publishedByMe.forEach(c => { if (!merged.has(c.id)) merged.set(c.id, c); });
    // My Cases: sorted by last edited (updatedAt, falling back to createdAt)
    return Array.from(merged.values()).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [localDrafts, communityCases, userId]);

  useEffect(() => {
    if (activeTab === 'mycases') return observeCarousel(myCasesGridRef.current, setActiveMyCaseId);
  }, [activeTab, myCases.length]);

  /* ─── Reusable Renderers ─── */

  const renderStats = (caseId: string, requirePublished = false, isPublished = true) => {
    if (requirePublished && !isPublished) return null;
    const stats = caseStats[caseId];
    if (!stats || stats.plays <= 0) return null;
    return (
      <StatsLine>
        <span>▶ {stats.plays} plays</span>
        <UpvoteStat>▲ {stats.upvotes || 0}</UpvoteStat>
        <DownvoteStat>▼ {stats.downvotes || 0}</DownvoteStat>
      </StatsLine>
    );
  };

  const renderBadgeRow = (c: CaseData, theme: CardTheme, extraBadges?: React.ReactNode) => {
    const colors = THEME_COLORS[theme];
    return (
      <BadgeRow>
        {extraBadges}
        <TypeBadge $bg={colors.badgeBg} $color={colors.bright}>{c.type}</TypeBadge>
        <DifficultyLabel $difficulty={c.difficulty}>{c.difficulty}</DifficultyLabel>
        {c.version && <VersionLabel>v{c.version}</VersionLabel>}
      </BadgeRow>
    );
  };

  const renderCaseCardContent = (c: CaseData, theme: CardTheme, showFeaturedBadge = false) => {
    const colors = THEME_COLORS[theme];
    return (
      <>
        <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
          {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
        </CaseImage>
        <CardTextContent>
          <CardTitle $color={colors.bright}>{c.title || "[ NO TITLE ]"}</CardTitle>
          {renderBadgeRow(c, theme,
            showFeaturedBadge && c.isFeatured ? <Badge $bg={colors.bright} $color="#000">FEATURED</Badge> : null
          )}
          <AuthorLine>by {c.authorDisplayName || 'Unknown Author'}</AuthorLine>
          <Description>{c.description}</Description>
          {renderStats(c.id)}
        </CardTextContent>
      </>
    );
  };

  const renderAdminControls = (c: CaseData) => (
    <AdminControls onClick={(e) => e.stopPropagation()}>
      {(isAdmin || c.authorId === userId) && onEditCase && (
        <AdminButton key={`edit-${c.id}`} onClick={() => onEditCase(c.id)}>EDIT {c.version ? `v${c.version}` : ''}</AdminButton>
      )}
      {isAdmin && onToggleFeatured && (
        <AdminButton key={`feature-${c.id}`} $variant="feature" onClick={() => onToggleFeatured(c.id, !c.isFeatured)}>{c.isFeatured ? 'UNFEATURE' : 'FEATURE'}</AdminButton>
      )}
      {c.authorId === userId && onUnpublish && (
        <AdminButton key={`unpublish-${c.id}`} $variant="delete" onClick={() => onUnpublish(c.id)}>UNPUBLISH</AdminButton>
      )}
      {isAdmin && onDeleteCase && (
        <AdminButton key={`delete-${c.id}`} $variant="delete" onClick={() => onDeleteCase(c.id)}>DELETE</AdminButton>
      )}
    </AdminControls>
  );

  const renderSortControls = () => (
    <>
      <SortLabel>Sort:</SortLabel>
      <SortButton $active={sortMode === 'popular'} onClick={() => setSortMode('popular')}>Popular</SortButton>
      <SortButton $active={sortMode === 'recent'} onClick={() => setSortMode('recent')}>Recent</SortButton>
    </>
  );

  return (
    <Container>
      <Header>
        <HeaderTitle className="hide-on-mobile">OPEN CASES</HeaderTitle>
        <TabBar>
          <TabButton $active={activeTab === 'featured'} $color="#0f0" onClick={() => setActiveTab('featured')}>
            [ FEATURED ]
          </TabButton>
          <TabButton $active={activeTab === 'network'} $color="#0ff" onClick={() => setActiveTab('network')}>
            [ NETWORK ]
          </TabButton>
          <TabButton $active={activeTab === 'mycases'} $color="#fc0" onClick={() => setActiveTab('mycases')}>
            [ MY CASES ]
          </TabButton>
        </TabBar>
        {activeTab === 'network' && (
          <SortBar>{renderSortControls()}</SortBar>
        )}
      </Header>

      {activeTab === 'featured' ? (
        <>
          <NetworkGrid ref={carouselElRef}>
            {featuredCases.length === 0 && !isLoadingCommunity && (
              <EmptyMessage key="no-featured">No featured cases available.</EmptyMessage>
            )}
            {featuredCases.map((c) => {
              if (!c.id) return null;
              return (
                <CaseCard key={c.id} onClick={() => onSelectCase(c.id)} data-cursor="pointer" data-case-id={c.id} $isActive={activeFeaturedId === c.id} $theme="green">
                  {renderCaseCardContent(c, 'green')}
                  {renderAdminControls(c)}
                </CaseCard>
              );
            })}
          </NetworkGrid>
        </>
      ) : activeTab === 'network' ? (
        <>
          <MobileSortBar>{renderSortControls()}</MobileSortBar>
          <NetworkGrid ref={networkGridRef}>
            {isLoadingCommunity && (
              <EmptyMessage key="loading-network" $color="#0ff">Accessing secure network...</EmptyMessage>
            )}
            {!isLoadingCommunity && communityCases.length === 0 && (
              <EmptyMessage key="no-network">No signals detected on the network.</EmptyMessage>
            )}
            {sortedNetworkCases.map((c) => {
              if (!c.id) return null;
              return (
                <CaseCard key={c.id} onClick={() => onSelectCase(c.id)} $theme="cyan" data-cursor="pointer" data-case-id={c.id} $isActive={activeNetworkId === c.id}>
                  {renderCaseCardContent(c, 'cyan', true)}
                  {renderAdminControls(c)}
                </CaseCard>
              );
            })}
          </NetworkGrid>
        </>
      ) : (
        /* MY CASES TAB */
        <>
          <NetworkGrid ref={myCasesGridRef}>
            <CreateCard onClick={onCreateNew} data-cursor="pointer">
              <CreateCardTitle>+ CREATE A NEW CASE</CreateCardTitle>
            </CreateCard>

            {myCases.length === 0 && (
              <EmptyMessage key="no-mycases" $fullWidth>
                No cases yet. Create one to get started!
              </EmptyMessage>
            )}

            {myCases.map((c) => {
              if (!c.id) return null;
              const isPublished = c.isUploaded;
              const colors = THEME_COLORS['gold'];
              return (
                <CaseCard key={c.id} onClick={() => isPublished ? onSelectCase(c.id) : onPlayDraft?.(c)} data-cursor="pointer" data-case-id={c.id} $isActive={activeMyCaseId === c.id} $theme="gold">
                  <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
                    {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
                  </CaseImage>
                  <CardTextContent>
                    <CardTitle $color={colors.bright}>{c.title || "[ NO TITLE ]"}</CardTitle>
                    {renderBadgeRow(c, 'gold',
                      <>
                        {isPublished
                          ? <Badge $bg={colors.bright} $color="#000">LIVE</Badge>
                          : <Badge $bg={colors.border} $color="#000">DRAFT</Badge>
                        }
                        {c.isFeatured && <Badge $bg={colors.border} $color="#000">FEATURED</Badge>}
                      </>
                    )}
                    <AuthorLine>by {c.authorDisplayName || 'Unknown Author'}</AuthorLine>
                    <Description>{c.description}</Description>
                    {renderStats(c.id, true, !!isPublished)}
                  </CardTextContent>
                  <AdminControls onClick={(e) => e.stopPropagation()}>
                    {onEditCase && (
                      <AdminButton onClick={() => onEditCase(c.id)}>EDIT</AdminButton>
                    )}
                    {isPublished && onUnpublish && (
                      <AdminButton $variant="delete" onClick={() => onUnpublish(c.id)}>UNPUBLISH</AdminButton>
                    )}
                    {!isPublished && onPublishDraft && (
                      <AdminButton $variant="publish" onClick={() => onPublishDraft(c.id)}>PUBLISH</AdminButton>
                    )}
                    {!isPublished && onDeleteDraft && (
                      <AdminButton $variant="delete" onClick={() => onDeleteDraft(c.id)}>DELETE</AdminButton>
                    )}
                    {isPublished && onDeleteMyCase && (
                      <AdminButton $variant="delete" onClick={() => onDeleteMyCase(c.id)}>DELETE</AdminButton>
                    )}
                  </AdminControls>
                </CaseCard>
              );
            })}
          </NetworkGrid>
        </>
      )}
      <MobileBottomTabBar>
        <BottomTabButton $active={activeTab === 'featured'} $color="#0f0" onClick={() => setActiveTab('featured')}>
          FEATURED
        </BottomTabButton>
        <BottomTabButton $active={activeTab === 'network'} $color="#0ff" onClick={() => setActiveTab('network')}>
          NETWORK
        </BottomTabButton>
        <BottomTabButton $active={activeTab === 'mycases'} $color="#fc0" onClick={() => setActiveTab('mycases')}>
          MY CASES
        </BottomTabButton>
      </MobileBottomTabBar>
    </Container>
  );
};

export default CaseSelection;
