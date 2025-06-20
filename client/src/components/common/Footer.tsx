import React from "react";
import "./Footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <a href="https://github.com/paulotaylor/chat-palooza" className="footer-link" target="_blank">Github</a>
        <span className="footer-separator">|</span>
        <a href="/terms.html" className="footer-link">Terms</a>
        <span className="footer-separator">|</span>
        <a href="/privacy.html" className="footer-link">Privacy Policy</a>
      </div>
    </footer>
  );
};

export default Footer;
