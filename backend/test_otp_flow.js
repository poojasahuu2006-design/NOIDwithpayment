const { createAndSendOtp, verifyOtp, isVerificationTokenValid } = require('./src/services/otpService');

async function testOtpFlow() {
  console.log('🧪 Testing OTP Flow...');

  // 1. Generate OTP
  const sendRes = createAndSendOtp('EU1244017', 'saanj@universal.edu.in');
  console.log('1. Send OTP Result:', sendRes);
  if (!sendRes.success || !sendRes.demoOtp) {
    throw new Error('Failed to generate OTP');
  }

  // 2. Test Invalid OTP
  const invalidRes = verifyOtp('EU1244017', 'saanj@universal.edu.in', '000000');
  console.log('2. Invalid OTP check:', invalidRes);
  if (invalidRes.success) {
    throw new Error('Invalid OTP should have failed!');
  }

  // 3. Test Valid OTP
  const validRes = verifyOtp('EU1244017', 'saanj@universal.edu.in', sendRes.demoOtp);
  console.log('3. Valid OTP check:', validRes);
  if (!validRes.success || !validRes.verificationToken) {
    throw new Error('Valid OTP should succeed!');
  }

  // 4. Test Token Validation
  const isTokenValid = isVerificationTokenValid(validRes.verificationToken, 'EU1244017');
  console.log('4. Token is valid:', isTokenValid);
  if (!isTokenValid) {
    throw new Error('Token should be valid for PID EU1244017');
  }

  console.log('🎉 ALL OTP TESTS PASSED SUCCESSFULLY!');
}

testOtpFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
