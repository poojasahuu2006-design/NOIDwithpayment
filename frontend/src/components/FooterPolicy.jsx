import React, { useState } from 'react';

export default function FooterPolicy() {
  const [activeModal, setActiveModal] = useState(null); // 'terms', 'privacy', 'refund', 'contact'

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <footer className="website-footer">
        <div className="footer-content">
          <p className="footer-copy">
            © {new Date().getFullYear()} NOID - Universal Dynamic Student ID Card Generator. All Rights Reserved.
          </p>
          <div className="footer-links">
            <button type="button" onClick={() => setActiveModal('contact')}>Contact Us</button>
            <span className="footer-sep">•</span>
            <button type="button" onClick={() => setActiveModal('terms')}>Terms &amp; Conditions</button>
            <span className="footer-sep">•</span>
            <button type="button" onClick={() => setActiveModal('privacy')}>Privacy Policy</button>
            <span className="footer-sep">•</span>
            <button type="button" onClick={() => setActiveModal('refund')}>Refund &amp; Cancellation</button>
          </div>
        </div>
      </footer>

      {/* Policy Modals */}
      {activeModal && (
        <div className="policy-modal-overlay" onClick={closeModal}>
          <div className="policy-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <h2>
                {activeModal === 'contact' && '📞 Contact Us'}
                {activeModal === 'terms' && '📜 Terms & Conditions'}
                {activeModal === 'privacy' && '🔒 Privacy Policy'}
                {activeModal === 'refund' && '💸 Refund & Cancellation Policy'}
              </h2>
              <button className="btn-close-modal" onClick={closeModal}>✕</button>
            </div>

            <div className="policy-modal-body">
              {activeModal === 'contact' && (
                <div>
                  <p><b>Merchant Legal Entity Name:</b> POOJA VINOD SAHU</p>
                  <p><b>Service Name:</b> NOID Dynamic Student ID Card Portal</p>
                  <p><b>Support Email:</b> poojasahuu2006@gmail.com</p>
                  <p><b>Contact Number:</b> +91 8261836404</p>
                  <p><b>Registered Address:</b> Universal College of Engineering, Kaman Road, Vasai, Maharashtra - 401208, India</p>
                  <p><b>Operating Hours:</b> Monday to Saturday, 9:00 AM - 6:00 PM IST</p>
                </div>
              )}

              {activeModal === 'terms' && (
                <div>
                  <p><b>1. Acceptance of Terms:</b> By accessing and using NOID ID Card Generation Portal, you agree to comply with these terms.</p>
                  <p><b>2. Service Description:</b> NOID provides digital ID card generation services for registered college students.</p>
                  <p><b>3. Fair Usage Policy:</b> Every student receives up to 3 free card generations per calendar month. Extra generations are priced at ₹15 per generation.</p>
                  <p><b>4. User Verification:</b> Generating an ID card requires valid PID verification and OTP authentication via college email.</p>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div>
                  <p><b>1. Data Collection:</b> We collect student PID, college email, name, department, and transaction details strictly for generating ID cards and processing payments.</p>
                  <p><b>2. Data Protection:</b> Your personal details and photos are processed securely using 256-bit SSL encryption and are never sold to third parties.</p>
                  <p><b>3. Payment Security:</b> All payment transactions are processed securely via RBI-compliant Razorpay payment gateway with cryptographic HMAC-SHA256 signature verification.</p>
                </div>
              )}

              {activeModal === 'refund' && (
                <div>
                  <p><b>1. Digital Goods Delivery:</b> ID Cards are generated and delivered instantly in digital format upon successful payment confirmation.</p>
                  <p><b>2. Refund Eligibility:</b> If payment is deducted but card generation fails due to technical server errors, a full refund of ₹15 will be initiated to the original payment method within 5-7 business days.</p>
                  <p><b>3. Refund Support:</b> For refund requests, please email us at <code>poojasahuu2006@gmail.com</code> with your Transaction ID and Student PID.</p>
                </div>
              )}
            </div>

            <div className="policy-modal-footer">
              <button className="btn-modal-ok" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
