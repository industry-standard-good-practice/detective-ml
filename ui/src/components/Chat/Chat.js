import React, { useState } from 'react';
import { fetchExample } from '../../store/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Portrait from '../Portrait/Portrait'
import ChatHistory from '../ChatHistory/ChatHistory'
import { Dropdown } from '../Dropdown/Dropdown'
import './Chat.scss'

const Chat = ({ getExampleValue, fetchExample }) => {

  const [exampleValue, setExampleValue] = useState('');

  const handleGetExample = () => {
    fetchExample(exampleValue);
  }

  const history = [
    {
      id: 1,
      user: true,
      time: '03:55pm September 22, 2030',
      message: 'Hello there'
    },
    {
      id: 2,
      user: false,
      time: '03:55pm September 22, 2030',
      message: 'Hi how can I help you?'
    },
    {
      id: 3,
      user: true,
      time: '03:58pm September 22, 2030',
      message: 'Another message'
    },
    {
      id: 4,
      user: false,
      time: '04:01pm September 22, 2030',
      message: 'Okay then. Bye.'
    },
  ];

  const sortHistory = (items) => {
    return items.sort((a, b) => {
      return a.id - b.id;
    });
  }

  const sortedHistory = sortHistory(history);

  const suspect = { firstName: 'Albert', lastName: 'Flores', fullName: 'Albert Flores', age: 32 };


  const handleMenuOne = () => {
    console.log('clicked one');
  };

  const handleMenuTwo = () => {
    console.log('clicked two');
  };

  return (
    <div className='chat-modal-container'>
      <div className='portrait-container'>
        <Portrait
          suspectInfo={suspect}
        />
      </div>
      <div className='chat-container'>
        <ChatHistory
          history={sortedHistory}
          suspect={suspect}
        />
        <p className='character-insight'>
          {suspect.firstName} seems calm but somewhat uneasy.
        </p>
        <div className='chat-input-container'>
          <Dropdown
            menu={[
              <button onClick={handleMenuOne}>Menu 1</button>,
              <button onClick={handleMenuTwo}>Menu 2</button>,
            ]}
          />
          <textarea
            placeholder={`Talk to ${suspect.firstName}`}
            className='chat-input'
            wrap='hard'
            rows={1}
          />
        </div>
      </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(Chat);
