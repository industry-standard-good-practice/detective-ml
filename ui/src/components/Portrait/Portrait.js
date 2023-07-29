import React, { useState } from 'react';
import { fetchExample } from '../../store/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ReactComponent as PortraitSvg } from './example-svg.svg'
import './Portrait.scss'

const Portrait = ({ suspectInfo }) => {

  return (
    <div className='portrait'>
      {suspectInfo &&
        <div className='suspect-info'>
          <div className='suspect-name'>
            {suspectInfo.fullName}
          </div>
          <div className='suspect-age'>
            Age: {suspectInfo.age}
          </div>
        </div>
      }

      <div className='flip-card-button'>
        [Flip Card]
      </div>

      <PortraitSvg />
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

export default Portrait;
