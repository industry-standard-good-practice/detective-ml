import React, { useState } from 'react';
import { fetchExample } from '../../store/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import './ChatHistory.scss'

const ChatHistory = ({ history, suspect }) => {

  console.log(history)

  //history is an array of objects, numbered for order.

  const [exampleValue, setExampleValue] = useState('');

  const handleGetExample = () => {
    fetchExample(exampleValue);
  }

  const messageHistory = history.map((message) => {
    return (
      <li
        className={message.user ? 'message user-chat-message' : 'message other-chat-message'}
        key={message.id}
      >
        <div
          className={message.user ? 'message-sender user-sender' : 'message-sender other-sender'}
        >
          {message.user ? 'Detective' : suspect.fullName}
        </div>
        <div>
          {message.message}
        </div>
      </li>
    )
  })
  return (
    <div className='chat-history'>
      <div className='chat-time'>
        {history[0].time}
      </div>
      {messageHistory}
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

export default connect(mapStateToProps, mapDispatchToProps)(ChatHistory);
