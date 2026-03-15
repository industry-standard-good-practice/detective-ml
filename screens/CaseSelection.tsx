
import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { CaseData, CaseStats } from '../types';
import { useDragScroll } from '../hooks/useDragScroll';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px 40px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  gap: 40px;
  
  @media (max-width: 768px) {
    padding: 15px;
    gap: 15px;
    flex-direction: column;
    align-items: flex-start;
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 10px;
    width: 100%;
    justify-content: space-between;
  }
`;

const TabButton = styled.button<{ $active: boolean; $color: string }>`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? props.$color : 'transparent'};
  color: ${props => props.$active ? props.$color : '#666'};
  font-family: inherit;
  font-size: var(--type-h3);
  padding: 5px 15px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;

  &:hover {
    color: ${props => props.$color};
    text-shadow: 0 0 10px ${props => props.$color};
  }
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
    padding: 5px 5px;
    flex: 1;
    text-align: center;
  }
`;

const Carousel = styled.div`
  display: flex;
  gap: 20px;
  padding: 40px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  height: 100%;
  min-height: 0;
  align-items: stretch;

  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;

  & > div {
    flex: 0 0 min(450px, 40vh);
    width: min(450px, 40vh);
    height: auto;
    max-height: 80vh;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    padding: 15px;
    & > div {
      flex: 0 0 90%;
    }
  }
`;

const NetworkGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 40px;
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

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    padding: 15px;
  }
`;

const CaseCard = styled.div<{ $isCommunity?: boolean }>`
  border: 2px solid ${props => props.$isCommunity ? '#0aa' : '#333'};
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: #111;
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 100%;

  &:hover {
    border-color: ${props => props.$isCommunity ? '#0ff' : '#fff'};
    transform: translateY(-2px);
    box-shadow: 0 0 15px ${props => props.$isCommunity ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255,255,255,0.2)'};
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
  border: 1px solid #333;
  margin-bottom: 15px;
  image-rendering: pixelated;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: var(--type-small);
  text-transform: uppercase;
`;

const CreateCard = styled(CaseCard)`
  border: 2px dashed #0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgba(0, 50, 0, 0.2);
  
  &:hover {
    background: rgba(0, 50, 0, 0.4);
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
  }

  h3 { color: #0f0 !important; }
  
  @media (max-width: 768px) {
    height: 150px;
    min-height: 150px;
  }
`;

const DraftCard = styled(CaseCard)`
  border: 2px solid #a80;
  
  &:hover {
    border-color: #fc0;
    box-shadow: 0 0 15px rgba(255, 200, 0, 0.2);
  }
`;

const AdminControls = styled.div`
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid #222;
`;

const AdminButton = styled.button<{ $variant?: 'delete' | 'feature' | 'publish' }>`
  background: ${props => props.$variant === 'delete' ? 'rgba(255, 0, 0, 0.1)' : props.$variant === 'publish' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 0, 0.1)'};
  border: 1px solid ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
  color: ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
  padding: 5px 10px;
  font-family: inherit;
  font-size: 0.7rem;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$variant === 'delete' ? '#f00' : props.$variant === 'publish' ? '#0f0' : '#ff0'};
    color: #000;
  }
`;

const AuthorLine = styled.div`
  color: #666;
  font-size: var(--type-small);
  margin-top: 5px;
  font-style: italic;
`;

const SortBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const SortButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(0, 255, 255, 0.15)' : 'transparent'};
  border: 1px solid ${props => props.$active ? '#0ff' : '#333'};
  color: ${props => props.$active ? '#0ff' : '#666'};
  padding: 4px 12px;
  font-family: inherit;
  font-size: var(--type-small);
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    border-color: #0ff;
    color: #0ff;
  }
`;

const DraftBadge = styled.span`
  background: #a80;
  color: #000;
  padding: 2px 8px;
  font-size: var(--type-small);
  font-weight: bold;
  text-transform: uppercase;
`;

const StatsLine = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  font-size: var(--type-small);
  color: #555;
`;

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
  onDeleteMyCase
}) => {
  const [activeTab, setActiveTab] = useState<'featured' | 'network' | 'mycases'>('featured');
  const [sortMode, setSortMode] = useState<'popular' | 'recent'>('popular');
  const carouselDragRef = useDragScroll<HTMLDivElement>();

  const featuredCases = communityCases.filter(c => c.isFeatured && c.isUploaded === true);

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
      return [...cases].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  }, [communityCases, caseStats, sortMode]);

  // Merge local drafts + published cases by this user (deduplicated by id)
  const myCases = useMemo(() => {
    const publishedByMe = communityCases.filter(c => c.authorId === userId);
    const publishedMap = new Map<string, CaseData>();
    publishedByMe.forEach(c => publishedMap.set(c.id, c));
    
    const merged = new Map<string, CaseData>();
    // Add drafts first, but merge heroImageUrl from published version if local is missing
    localDrafts.forEach(d => {
      const published = publishedMap.get(d.id);
      if (published && !d.heroImageUrl && published.heroImageUrl) {
        merged.set(d.id, { ...d, heroImageUrl: published.heroImageUrl });
      } else {
        merged.set(d.id, d);
      }
    });
    // Add published cases that aren't already in drafts
    publishedByMe.forEach(c => { if (!merged.has(c.id)) merged.set(c.id, c); });
    return Array.from(merged.values());
  }, [localDrafts, communityCases, userId]);

  const renderCaseCardContent = (c: CaseData, isCommunity: boolean) => (
    <>
      <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
        {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
      </CaseImage>
      <h3 style={{ color: isCommunity ? '#0ff' : '#fff', fontSize: 'var(--type-h3)', margin: '0 0 5px 0' }}>{c.title || "[ NO TITLE ]"}</h3>
      <div style={{ marginBottom: '10px' }}>
        <span style={{ background: isCommunity ? '#044' : '#333', color: isCommunity ? '#0ff' : undefined, padding: '2px 8px', fontSize: 'var(--type-small)' }}>{c.type}</span>
        <span style={{ marginLeft: '10px', color: c.difficulty === 'Hard' ? 'red' : c.difficulty === 'Medium' ? '#fa0' : 'green', fontSize: 'var(--type-small)' }}>{c.difficulty}</span>
        {c.version && <span style={{ marginLeft: '10px', color: '#555', fontSize: 'var(--type-small)' }}>v{c.version}</span>}
      </div>
      <AuthorLine>by {c.authorDisplayName || 'Unknown Author'}</AuthorLine>
      <p style={{ color: '#aaa', margin: '5px 0 0 0', fontSize: 'var(--type-body)', lineHeight: '1.4' }}>{c.description}</p>
      {caseStats[c.id] && caseStats[c.id].plays > 0 && (
        <StatsLine>
          <span>▶ {caseStats[c.id].plays} plays</span>
          <span style={{ color: '#0a0' }}>▲ {caseStats[c.id].upvotes || 0}</span>
          <span style={{ color: '#a00' }}>▼ {caseStats[c.id].downvotes || 0}</span>
        </StatsLine>
      )}
    </>
  );

  return (
    <Container>
      <Header>
        <h2 style={{ margin: 0 }}>OPEN CASES</h2>
        <TabBar>
          <TabButton
            $active={activeTab === 'featured'}
            $color="#0f0"
            onClick={() => setActiveTab('featured')}
          >
            [ FEATURED ]
          </TabButton>
          <TabButton
            $active={activeTab === 'network'}
            $color="#0ff"
            onClick={() => setActiveTab('network')}
          >
            [ NETWORK ]
          </TabButton>
          <TabButton
            $active={activeTab === 'mycases'}
            $color="#fc0"
            onClick={() => setActiveTab('mycases')}
          >
            [ MY CASES ]
          </TabButton>
        </TabBar>
        {activeTab === 'network' && (
          <SortBar>
            <span style={{ color: '#555', fontSize: 'var(--type-small)', textTransform: 'uppercase' }}>Sort:</span>
            <SortButton $active={sortMode === 'popular'} onClick={() => setSortMode('popular')}>Popular</SortButton>
            <SortButton $active={sortMode === 'recent'} onClick={() => setSortMode('recent')}>Recent</SortButton>
          </SortBar>
        )}
      </Header>

      {activeTab === 'featured' ? (
        <Carousel ref={carouselDragRef}>
          {featuredCases.length === 0 && !isLoadingCommunity && (
            <div key="no-featured" style={{ color: '#555', padding: '20px' }}>No featured cases available.</div>
          )}
          {featuredCases.map((c) => {
            if (!c.id) return null;
            return (
              <CaseCard key={c.id} onClick={() => onSelectCase(c.id)} data-cursor="pointer">
                {renderCaseCardContent(c, false)}
                <AdminControls onClick={(e) => e.stopPropagation()}>
                  {(isAdmin || c.authorId === userId) && onEditCase && (
                    <AdminButton key={`edit-${c.id}`} onClick={() => onEditCase(c.id)}>[ EDIT {c.version ? `v${c.version}` : ''} ]</AdminButton>
                  )}
                  {isAdmin && onToggleFeatured && (
                    <AdminButton key={`feature-${c.id}`} $variant="feature" onClick={() => onToggleFeatured(c.id, !c.isFeatured)}>[ {c.isFeatured ? 'UNFEATURE' : 'FEATURE'} ]</AdminButton>
                  )}
                  {c.authorId === userId && onUnpublish && (
                    <AdminButton key={`unpublish-${c.id}`} $variant="delete" onClick={() => onUnpublish(c.id)}>[ UNPUBLISH ]</AdminButton>
                  )}
                  {isAdmin && onDeleteCase && (
                    <AdminButton key={`delete-${c.id}`} $variant="delete" onClick={() => onDeleteCase(c.id)}>[ DELETE ]</AdminButton>
                  )}
                </AdminControls>
              </CaseCard>
            );
          })}
        </Carousel>
      ) : activeTab === 'network' ? (
        <NetworkGrid>
          {isLoadingCommunity && (
            <div key="loading-network" style={{ color: '#0ff', padding: '20px' }}>Accessing secure network...</div>
          )}

          {!isLoadingCommunity && communityCases.length === 0 && (
            <div key="no-network" style={{ color: '#555', padding: '20px' }}>No signals detected on the network.</div>
          )}

          {sortedNetworkCases.map((c) => {
            if (!c.id) return null;
            return (
              <CaseCard key={c.id} onClick={() => onSelectCase(c.id)} $isCommunity data-cursor="pointer">
                {renderCaseCardContent(c, true)}
                <AdminControls onClick={(e) => e.stopPropagation()}>
                  {(isAdmin || c.authorId === userId) && onEditCase && (
                    <AdminButton key={`edit-${c.id}`} onClick={() => onEditCase(c.id)}>[ EDIT {c.version ? `v${c.version}` : ''} ]</AdminButton>
                  )}
                  {isAdmin && onToggleFeatured && (
                    <AdminButton key={`feature-${c.id}`} $variant="feature" onClick={() => onToggleFeatured(c.id, !c.isFeatured)}>[ {c.isFeatured ? 'UNFEATURE' : 'FEATURE'} ]</AdminButton>
                  )}
                  {c.authorId === userId && onUnpublish && (
                    <AdminButton key={`unpublish-${c.id}`} $variant="delete" onClick={() => onUnpublish(c.id)}>[ UNPUBLISH ]</AdminButton>
                  )}
                  {isAdmin && onDeleteCase && (
                    <AdminButton key={`delete-${c.id}`} $variant="delete" onClick={() => onDeleteCase(c.id)}>[ DELETE ]</AdminButton>
                  )}
                </AdminControls>
              </CaseCard>
            );
          })}
        </NetworkGrid>
      ) : (
        /* MY CASES TAB */
        <NetworkGrid>
          <CreateCard onClick={onCreateNew} data-cursor="pointer">
            <h3 style={{ fontSize: 'var(--type-h3)', margin: 0 }}>+ CREATE A NEW CASE</h3>
          </CreateCard>

          {myCases.length === 0 && (
            <div key="no-mycases" style={{ color: '#555', padding: '20px', gridColumn: '1 / -1' }}>
              No cases yet. Create one to get started!
            </div>
          )}

          {myCases.map((c) => {
            if (!c.id) return null;
            const isPublished = c.isUploaded;
            return (
              <DraftCard key={c.id} onClick={() => isPublished ? onSelectCase(c.id) : onPlayDraft?.(c)} data-cursor="pointer">
                <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
                  {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
                </CaseImage>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  {isPublished 
                    ? <span style={{ background: '#0a5', color: '#000', padding: '2px 8px', fontSize: 'var(--type-small)', fontWeight: 'bold', textTransform: 'uppercase' }}>LIVE</span>
                    : <DraftBadge>DRAFT</DraftBadge>
                  }
                  <h3 style={{ color: isPublished ? '#0f0' : '#fc0', fontSize: 'var(--type-h3)', margin: 0 }}>{c.title || "[ NO TITLE ]"}</h3>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ background: '#442', color: '#fc0', padding: '2px 8px', fontSize: 'var(--type-small)' }}>{c.type}</span>
                  <span style={{ marginLeft: '10px', color: c.difficulty === 'Hard' ? 'red' : c.difficulty === 'Medium' ? '#fa0' : 'green', fontSize: 'var(--type-small)' }}>{c.difficulty}</span>
                  {c.version && <span style={{ marginLeft: '10px', color: '#555', fontSize: 'var(--type-small)' }}>v{c.version}</span>}
                </div>
                <p style={{ color: '#aaa', margin: '0 0 10px 0', fontSize: 'var(--type-body)', lineHeight: '1.4' }}>{c.description}</p>
                {isPublished && caseStats[c.id] && caseStats[c.id].plays > 0 && (
                  <StatsLine>
                    <span>▶ {caseStats[c.id].plays} plays</span>
                    <span style={{ color: '#0a0' }}>▲ {caseStats[c.id].upvotes || 0}</span>
                    <span style={{ color: '#a00' }}>▼ {caseStats[c.id].downvotes || 0}</span>
                  </StatsLine>
                )}
                <AdminControls onClick={(e) => e.stopPropagation()}>
                  {onEditCase && (
                    <AdminButton onClick={() => onEditCase(c.id)}>[ EDIT ]</AdminButton>
                  )}
                  {isPublished && onUnpublish && (
                    <AdminButton $variant="delete" onClick={() => onUnpublish(c.id)}>[ UNPUBLISH ]</AdminButton>
                  )}
                  {!isPublished && onPublishDraft && (
                    <AdminButton $variant="publish" onClick={() => onPublishDraft(c.id)}>[ PUBLISH ]</AdminButton>
                  )}
                  {!isPublished && onDeleteDraft && (
                    <AdminButton $variant="delete" onClick={() => onDeleteDraft(c.id)}>[ DELETE ]</AdminButton>
                  )}
                  {isPublished && onDeleteMyCase && (
                    <AdminButton $variant="delete" onClick={() => onDeleteMyCase(c.id)}>[ DELETE ]</AdminButton>
                  )}
                </AdminControls>
              </DraftCard>
            );
          })}
        </NetworkGrid>
      )}
    </Container>
  );
};

export default CaseSelection;
