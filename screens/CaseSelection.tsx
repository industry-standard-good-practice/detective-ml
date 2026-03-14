
import React, { useState } from 'react';
import styled from 'styled-components';
import { CaseData } from '../types';
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
  /* Inherits height: 400px from CaseCard on desktop */
  
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

const AdminControls = styled.div`
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid #222;
`;

const AdminButton = styled.button<{ $variant?: 'delete' | 'feature' }>`
  background: ${props => props.$variant === 'delete' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 0, 0.1)'};
  border: 1px solid ${props => props.$variant === 'delete' ? '#f00' : '#ff0'};
  color: ${props => props.$variant === 'delete' ? '#f00' : '#ff0'};
  padding: 5px 10px;
  font-family: inherit;
  font-size: 0.7rem;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$variant === 'delete' ? '#f00' : '#ff0'};
    color: #000;
  }
`;

interface CaseSelectionProps {
  communityCases: CaseData[];
  onSelectCase: (caseId: string) => void;
  onCreateNew: () => void;
  isLoadingCommunity: boolean;
  isAdmin?: boolean;
  userId?: string;
  onDeleteCase?: (caseId: string) => void;
  onToggleFeatured?: (caseId: string, isFeatured: boolean) => void;
  onEditCase?: (caseId: string) => void;
}

const CaseSelection: React.FC<CaseSelectionProps> = ({
  communityCases,
  onSelectCase,
  onCreateNew,
  isLoadingCommunity,
  isAdmin,
  userId,
  onDeleteCase,
  onToggleFeatured,
  onEditCase
}) => {
  const [activeTab, setActiveTab] = useState<'featured' | 'network'>('featured');
  const carouselDragRef = useDragScroll<HTMLDivElement>();

  const featuredCases = communityCases.filter(c => c.isFeatured);

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
            [ FEATURED CASES ]
          </TabButton>
          <TabButton
            $active={activeTab === 'network'}
            $color="#0ff"
            onClick={() => setActiveTab('network')}
          >
            [ THE NETWORK ]
          </TabButton>
        </TabBar>
      </Header>

      {activeTab === 'featured' ? (
        <Carousel ref={carouselDragRef}>
          {featuredCases.length === 0 && !isLoadingCommunity && (
            <div key="no-featured" style={{ color: '#555', padding: '20px' }}>No featured cases available.</div>
          )}
          {featuredCases.map((c) => {
            if (!c.id) return null;
            return (
              <CaseCard key={c.id} onClick={() => onSelectCase(c.id)}>
                <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
                  {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
                </CaseImage>
                <h3 style={{ color: '#fff', fontSize: 'var(--type-h3)', margin: '0 0 5px 0' }}>{c.title || "[ NO TITLE ]"}</h3>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ background: '#333', padding: '2px 8px', fontSize: 'var(--type-small)' }}>{c.type}</span>
                  <span style={{ marginLeft: '10px', color: c.difficulty === 'Hard' ? 'red' : 'green', fontSize: 'var(--type-small)' }}>{c.difficulty}</span>
                  {c.version && <span style={{ marginLeft: '10px', color: '#555', fontSize: 'var(--type-small)' }}>v{c.version}</span>}
                </div>
                <p style={{ color: '#aaa', margin: 0, fontSize: 'var(--type-body)', lineHeight: '1.4' }}>{c.description}</p>
                <AdminControls onClick={(e) => e.stopPropagation()}>
                  {(isAdmin || c.authorId === userId) && onEditCase && (
                    <AdminButton key={`edit-${c.id}`} onClick={() => onEditCase(c.id)}>[ EDIT {c.version ? `v${c.version}` : ''} ]</AdminButton>
                  )}
                  {isAdmin && onToggleFeatured && (
                    <AdminButton key={`feature-${c.id}`} $variant="feature" onClick={() => onToggleFeatured(c.id, !c.isFeatured)}>[ {c.isFeatured ? 'UNFEATURE' : 'FEATURE'} ]</AdminButton>
                  )}
                  {isAdmin && onDeleteCase && (
                    <AdminButton key={`delete-${c.id}`} $variant="delete" onClick={() => onDeleteCase(c.id)}>[ DELETE ]</AdminButton>
                  )}
                </AdminControls>
              </CaseCard>
            );
          })}
        </Carousel>
      ) : (
        <NetworkGrid>
          <CreateCard onClick={onCreateNew}>
            <h3 style={{ fontSize: 'var(--type-h3)', margin: 0 }}>+ CREATE A NEW CASE</h3>
          </CreateCard>

          {isLoadingCommunity && (
            <div key="loading-network" style={{ color: '#0ff', padding: '20px' }}>Accessing secure network...</div>
          )}

          {!isLoadingCommunity && communityCases.length === 0 && (
            <div key="no-network" style={{ color: '#555', padding: '20px' }}>No signals detected on the network.</div>
          )}

          {communityCases.map((c) => {
            if (!c.id) return null;
            return (
              <CaseCard key={c.id} onClick={() => onSelectCase(c.id)} $isCommunity>
                <CaseImage $src={c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl}>
                  {!(c.heroImageUrl || c.initialEvidence?.[0]?.imageUrl) && "[ NO IMAGE ]"}
                </CaseImage>
                <h3 style={{ color: '#0ff', fontSize: 'var(--type-h3)', margin: '0 0 5px 0' }}>{c.title || "[ NO TITLE ]"}</h3>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ background: '#044', color: '#0ff', padding: '2px 8px', fontSize: 'var(--type-small)' }}>{c.type}</span>
                  <span style={{ marginLeft: '10px', color: '#ccc', fontSize: 'var(--type-small)' }}>{c.difficulty}</span>
                  {c.version && <span style={{ marginLeft: '10px', color: '#555', fontSize: 'var(--type-small)' }}>v{c.version}</span>}
                </div>
                <p style={{ color: '#aaa', margin: 0, fontSize: 'var(--type-body)', lineHeight: '1.4' }}>{c.description}</p>
                <AdminControls onClick={(e) => e.stopPropagation()}>
                  {(isAdmin || c.authorId === userId) && onEditCase && (
                    <AdminButton key={`edit-${c.id}`} onClick={() => onEditCase(c.id)}>[ EDIT {c.version ? `v${c.version}` : ''} ]</AdminButton>
                  )}
                  {isAdmin && onToggleFeatured && (
                    <AdminButton key={`feature-${c.id}`} $variant="feature" onClick={() => onToggleFeatured(c.id, !c.isFeatured)}>[ {c.isFeatured ? 'UNFEATURE' : 'FEATURE'} ]</AdminButton>
                  )}
                  {isAdmin && onDeleteCase && (
                    <AdminButton key={`delete-${c.id}`} $variant="delete" onClick={() => onDeleteCase(c.id)}>[ DELETE ]</AdminButton>
                  )}
                </AdminControls>
              </CaseCard>
            );
          })}
        </NetworkGrid>
      )}
    </Container>
  );
};

export default CaseSelection;
