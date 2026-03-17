
import React from 'react';
import styled from 'styled-components';
import { signInWithGoogle } from '../services/firebase';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 30px;
  background: #050505;
  padding: 20px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 40px 30px;
  }
`;

const Title = styled.h1`
  color: #0f0;
  font-size: 4rem;
  text-shadow: 0 0 20px #0f0;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 5px;

  @media (max-width: 768px) {
    font-size: 2.2rem;
    letter-spacing: 3px;
  }
`;

const Subtitle = styled.p`
  color: #555;
  font-size: 1.2rem;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const LoginButton = styled.button`
  background: transparent;
  border: 2px solid #0f0;
  color: #0f0;
  padding: 15px 40px;
  font-family: inherit;
  font-size: 1.5rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 2px;
  transition: all 0.2s;

  &:hover {
    background: #0f0;
    color: #000;
    box-shadow: 0 0 30px #0f0;
  }
`;

const Warning = styled.div`
  color: #f00;
  font-size: 0.9rem;
  max-width: 400px;
  text-align: center;
  margin-top: 20px;
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
