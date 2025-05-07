import React, { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

export default function CustomDropdown({ options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  const handleClickOutside = e => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
      setOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <div className="dropdown-selected" onClick={() => setOpen(!open)}>
        {value}
        <span className="dropdown-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <ul className="dropdown-options">
          {options.map(opt => (
            <li
              key={opt}
              className={`dropdown-option ${opt === value ? 'selected' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
