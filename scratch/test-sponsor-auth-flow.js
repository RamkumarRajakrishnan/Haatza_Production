const { Client } = require('pg');
require('dotenv').config();

async function testFullAuthFlow() {
  const rand = Math.floor(Math.random() * 10000);
  const phone = '987' + String(rand).padStart(7, '0');
  const email = 'sponsor_' + rand + '@haatza.com';
  const password = 'Password123!';

  console.log('=== Step 1: Sponsor Sign-Up ===');
  const signupRes = await fetch('http://127.0.0.1:8080/api/v1/sponsorSignup?module=sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Sponsor Auth Test ' + rand,
      companyName: 'Sponsor Corp',
      email,
      phone,
      password,
      confirmPassword: password,
    }),
  });
  const signupJson = await signupRes.json();
  console.log('Sign-Up Status:', signupRes.status);
  console.log('Sign-Up Output:', JSON.stringify(signupJson, null, 2));

  const userId = signupJson.data?.userId;
  if (!userId) {
    console.error('Sign up failed');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const otpQuery = await client.query('SELECT otp_hash FROM public.otp_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
  const otpCode = otpQuery.rows[0]?.otp_hash;
  console.log('Retrieved Generated OTP Code:', otpCode);
  await client.end();

  console.log('\n=== Step 2: Verify Registration OTP ===');
  const verifyRegRes = await fetch('http://127.0.0.1:8080/api/v1/verifyOtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: phone,
      otp: otpCode,
      purpose: 'registration',
    }),
  });
  const verifyRegJson = await verifyRegRes.json();
  console.log('Verify Registration Status:', verifyRegRes.status);
  console.log('Verify Registration Output:', JSON.stringify(verifyRegJson, null, 2));

  console.log('\n=== Step 3: Login via Email & Password ===');
  const loginRes = await fetch('http://127.0.0.1:8080/api/v1/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: password,
    }),
  });
  const loginJson = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Output:', JSON.stringify(loginJson, null, 2));
}

testFullAuthFlow().catch((err) => console.error('Error:', err));
