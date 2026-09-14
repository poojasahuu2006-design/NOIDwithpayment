import React, { useState, useEffect } from 'react';

export default function PidSearch({
  onGenerate,
  loading,
  error,
  paymentRequiredInfo,
  onResetPaymentPrompt,
}) {
  const [pid, setPid] = useState('');
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('PENDING'); // PENDING, SUCCESS, FAILED
  const [statusMessage, setStatusMessage] = useState('');
  const [verifiedPaymentData, setVerifiedPaymentData] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);

  useEffect(() => {
    if (paymentRequiredInfo && paymentRequiredInfo.initialVerifiedData) {
      setPaymentStatus('SUCCESS');
      setVerifiedPaymentData(paymentRequiredInfo.initialVerifiedData);
      setStatusMessage('✓ Payment verified! Ready to generate ID card.');
    } else if (paymentRequiredInfo && paymentRequiredInfo.pid) {
      setPaymentStatus('PENDING');
      setVerifiedPaymentData(null);
      setOrderInfo(null);
      setStatusMessage('');
    } else {
      setPaymentStatus('PENDING');
      setVerifiedPaymentData(null);
      setOrderInfo(null);
    }
  }, [paymentRequiredInfo]);

  /**
   * Opens Razorpay Standard Checkout Modal
   */
  const handlePayWithRazorpay = async () => {
    const studentPid = paymentRequiredInfo?.pid || pid;
    if (!studentPid) return;

    try {
      setRazorpayLoading(true);
      setStatusMessage('Opening secure Razorpay checkout...');

      const res = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: studentPid }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        setStatusMessage(orderData.error || 'Failed to initialize payment.');
        setRazorpayLoading(false);
        return;
      }

      setOrderInfo(orderData);

      const options = {
        key: orderData.keyId,
        amount: orderData.amountInPaise || 1500,
        currency: orderData.currency || 'INR',
        name: 'NOID Card Generator',
        description: `₹15 ID Card Fee for PID ${studentPid}`,
        image: '/photos/NOID.jpg',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.studentName || 'Student',
          email: `${studentPid.toLowerCase()}@universal.edu.in`,
          contact: '8261836404',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setRazorpayLoading(false);
            setStatusMessage('Payment was cancelled or closed.');
          },
        },
        handler: async (response) => {
          try {
            setStatusMessage('Verifying cryptographic signature with Razorpay...');
            const verifyRes = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                pid: studentPid,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success && verifyData.verified) {
              setPaymentStatus('SUCCESS');
              setVerifiedPaymentData(verifyData);
              setStatusMessage('✓ Payment confirmed by Razorpay!');
              onGenerate(studentPid, verifyData.merchantOrderId || response.razorpay_order_id);
            } else {
              setPaymentStatus('FAILED');
              setStatusMessage(verifyData.error || 'Payment signature verification failed.');
            }
          } catch (verifyErr) {
            console.error('Signature verification error:', verifyErr);
            setPaymentStatus('FAILED');
          } finally {
            setRazorpayLoading(false);
          }
        },
      };

      if (typeof window.Razorpay === 'function') {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (failResponse) => {
          console.error('Razorpay payment failed:', failResponse.error);
          setPaymentStatus('FAILED');
          setStatusMessage(failResponse.error?.description || 'Payment was declined or failed.');
          setRazorpayLoading(false);
        });
        rzp.open();
      } else {
        alert('Razorpay SDK loading. Please try again in 2 seconds.');
        setRazorpayLoading(false);
      }
    } catch (err) {
      console.error('Error starting Razorpay checkout:', err);
      setRazorpayLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pid.trim()) {
      onGenerate(pid.trim().toUpperCase());
    }
  };

  const handleGenerateAfterPayment = () => {
    const orderId =
      verifiedPaymentData?.merchantOrderId ||
      verifiedPaymentData?.razorpayOrderId ||
      orderInfo?.orderId;
    const studentPid = paymentRequiredInfo?.pid || pid;
    onGenerate(studentPid, orderId);
  };

  return (
    <div className="outer-card">
      <div className="header">
        <div className="logo-wrapper">
          <img
            className="logo"
            src="/photos/NOID.jpg"
            alt="NOID Logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/NOID.jpg';
            }}
          />
        </div>
        <h1>NOID</h1>
        <p className="subtitle">Dynamic ID Card Generator</p>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Payment Flow (Limit reached >= 3) */}
      {paymentRequiredInfo ? (
        paymentStatus === 'SUCCESS' && verifiedPaymentData ? (
          /* SUCCESS STATE */
          <div className="payment-card payment-success-card">
            <div className="success-icon-badge">✓</div>
            <div className="payment-success-badge">Payment Successful</div>
            <h3>Payment Received (₹{verifiedPaymentData.amount || 15}.00)</h3>
            <p className="payment-desc">
              Your ₹15 payment for PID <span className="mono-pid">{paymentRequiredInfo.pid}</span> has been confirmed by Razorpay.
            </p>

            <div className="payment-receipt-box">
              <div className="receipt-row">
                <span className="receipt-label">Student PID:</span>
                <span className="receipt-value mono-pid">{paymentRequiredInfo.pid}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Payment ID:</span>
                <span className="receipt-value mono-pid" style={{ fontSize: '12px' }}>
                  {verifiedPaymentData.razorpayPaymentId || verifiedPaymentData.transactionId || 'pay_verified'}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Amount Paid:</span>
                <span className="receipt-value paid-amount-text">
                  ₹{verifiedPaymentData.amount || 15}.00
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Verification:</span>
                <span className="receipt-value status-paid-text">HMAC-SHA256 SECURED ✓</span>
              </div>
            </div>

            <div className="payment-actions">
              <button
                type="button"
                className="btn-generate-unlocked"
                disabled={loading}
                onClick={handleGenerateAfterPayment}
              >
                {loading ? 'Generating ID Card...' : '🪪 Generate ID Card'}
              </button>

              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  if (onResetPaymentPrompt) onResetPaymentPrompt();
                }}
              >
                Done / Search Another PID
              </button>
            </div>
          </div>
        ) : (
          /* SECURE PAYMENT CHECKOUT */
          <div className="payment-card">
            <div className="payment-badge">Monthly Free Limit Reached</div>
            <h3>Pay ₹15 to Generate ID Card</h3>
            <p className="payment-desc">
              You have used all <b>3 free generations</b> for PID{' '}
              <span className="mono-pid">{paymentRequiredInfo.pid}</span> in{' '}
              <b>
                {paymentRequiredInfo.monthName || 'this month'} {paymentRequiredInfo.year || ''}
              </b>
              . Additional generations require a verified payment of <b>₹15</b>.
            </p>

            <div className="payment-amount-box">
              <span className="amount-label">Amount Payable</span>
              <span className="amount-val">₹{paymentRequiredInfo.amount || 15}.00</span>
            </div>

            <div className="razorpay-gateway-box">
              <div className="razorpay-badge-header">
                <span className="rzp-shield-icon">🛡️</span>
                <span>Razorpay 256-Bit SSL Gateway</span>
              </div>

              <div className="payment-supported-methods">
                <span className="method-tag">⚡ UPI / PhonePe / GPay</span>
                <span className="method-tag">💳 Debit &amp; Credit Cards</span>
                <span className="method-tag">🏦 NetBanking</span>
              </div>

              {statusMessage && (
                <div className="razorpay-status-pill">
                  <span className="pulse-dot" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <div className="payment-actions">
              <button
                type="button"
                className="btn-pay-razorpay"
                disabled={razorpayLoading || loading}
                onClick={handlePayWithRazorpay}
              >
                {razorpayLoading ? (
                  <>
                    <span className="spinner-small" /> Opening Razorpay...
                  </>
                ) : (
                  <>
                    <span className="rzp-bolt">⚡</span> Pay ₹15 with Razorpay
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-cancel"
                disabled={loading || razorpayLoading}
                onClick={() => {
                  if (onResetPaymentPrompt) onResetPaymentPrompt();
                }}
              >
                Cancel &amp; Search Another
              </button>
            </div>
          </div>
        )
      ) : (
        /* PID INPUT FORM */
        <form className="pid-form" onSubmit={handleSubmit}>
          <label htmlFor="pid">Enter PID</label>
          <input
            id="pid"
            name="pid"
            type="text"
            placeholder="EU1244004"
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              if (onResetPaymentPrompt) onResetPaymentPrompt();
            }}
            required
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate ID Card'}
          </button>
        </form>
      )}
    </div>
  );
}
