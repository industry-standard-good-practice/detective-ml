import React, { useState } from 'react';
import './Navbar.scss'

const Navbar = ({ getExampleValue, fetchExample }) => {

  const [exampleValue, setExampleValue] = useState('');

  const handleGetExample = () => {
    fetchExample(exampleValue);
  }

  return (
    <nav className="navbar">
      <div className="container">
        <div className="logo">
          DetectiveML v1.0.0
        </div>
        <div className="nav-elements">
          <ul>
            <li>
              [Exit]
            </li>
            <li>
              [Give Up]
            </li>
            <li>
              [Make Accusation]
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
