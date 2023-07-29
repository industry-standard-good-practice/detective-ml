import React, { useState } from 'react';
import { fetchExample } from '../../store/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import './Dropdown.scss'

export const Dropdown = ({ menu, className, label, onSelect }) => {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setOpen(!open);
  };

  return (
    <div className="dropdown-container">
      <button className='dropdown' onClick={handleOpen}>Talk</button>
      {open ? (
        <ul className="menu">
          {menu.map((menuItem, index) => (
            <li key={index} className="menu-item">
              {React.cloneElement(menuItem, {
                onClick: () => {
                  menuItem.props.onClick();
                  setOpen(false);
                },
              })}
            </li>
          ))}
        </ul>
      ) : null}
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
