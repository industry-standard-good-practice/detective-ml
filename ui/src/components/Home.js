import React, { useState } from 'react';
import logo from '../logo.svg';
import '../App.css';
import { fetchExample } from '../store/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

const Home = ({ getExampleValue, fetchExample }) => {

  const [exampleValue, setExampleValue] = useState('');

  const handleGetExample = () => {
    fetchExample(exampleValue);
  }

  return (
    <div className='App'>
      <header className='App-header'>
        <img src={logo} className='App-logo' alt='logo' />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <p>Enter a value and press the "Get Example" button.</p>
        <input
          value={exampleValue}
          onChange={e => setExampleValue(e.target.value)}
        />
        <button onClick={handleGetExample}>
          Get Example
        </button>
        {typeof getExampleValue !== 'object' &&
          <div>
            <p>{JSON.stringify(getExampleValue)}</p>
            <p>Also take a look in the Network console to see the request.</p>
          </div>
        }
        <a
          className='App-link'
          href='https://reactjs.org'
          target='_blank'
          rel='noopener noreferrer'
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

const mapStateToProps = state => ({
  getExampleValue: state.example.data
})

const mapDispatchToProps = dispatch => {
  return bindActionCreators({
    fetchExample
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Home);
