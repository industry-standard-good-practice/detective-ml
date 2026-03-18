
import React from 'react';
import styled from 'styled-components';
import { signInWithGoogle } from '../services/firebase';
import { type } from '../theme';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: calc(var(--space) * 4);
  background: var(--color-surface-inset);
  padding: calc(var(--space) * 3);
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: calc(var(--space) * 5) calc(var(--space) * 4);
  }
`;

const Title = styled.h1`
  ${type.h1}
  color: var(--color-accent-green);
  text-shadow: 0 0 20px var(--color-accent-green);
  margin: 0;
  letter-spacing: 5px;
`;

const Subtitle = styled.p`
  ${type.bodyLg}
  color: var(--color-text-disabled);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const LoginButton = styled.button`
  ${type.h3}
  background: transparent;
  border: 2px solid var(--color-accent-green);
  color: var(--color-accent-green);
  padding: calc(var(--space) * 2) calc(var(--space) * 5);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-accent-green);
    color: var(--color-text-inverse);
    box-shadow: 0 0 30px var(--color-accent-green);
  }
`;

const Warning = styled.div`
  ${type.small}
  color: var(--color-accent-red);
  max-width: 400px;
  text-align: center;
  margin-top: calc(var(--space) * 3);
  opacity: 0.7;
`;

const Login: React.FC = () => {
  return (
    <Container>
      <Title>DetectiveML</Title>
      <Subtitle>Unauthorized Access Prohibited</Subtitle>
      <LoginButton onClick={signInWithGoogle}>
        Sign In with Google
      </LoginButton>
      <Warning>
        BY LOGGING IN, YOU AGREE TO THE TERMS OF THE BUREAU. 
        ALL INTERROGATIONS ARE RECORDED FOR QUALITY ASSURANCE.
      </Warning>
    </Container>
  );
};

export default Login;
