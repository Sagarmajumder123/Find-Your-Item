import React from 'react';

const Footer = () => {
  return (
    <footer className="footer-area">
      <div className="footer-content">
        <p className="crafted-text">
          Crafted with <span className="heart-icon">♥</span> by developers
        </p>
        <div className="dev-links">
          <a
            href="https://www.linkedin.com/in/sagar-majumder-304b80314?utm_source=share_via&utm_content=profile&utm_medium=member_android"
            target="_blank"
            rel="noopener noreferrer"
            className="dev-link"
          >
            Sagar Majumder
          </a>
          <span className="dev-separator">|</span>
          <a
            href="https://www.linkedin.com/in/subhabrata-ruidas-942367301?utm_source=share_via&utm_content=profile&utm_medium=member_android"
            target="_blank"
            rel="noopener noreferrer"
            className="dev-link"
          >
            Subhabrata Ruidas
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
