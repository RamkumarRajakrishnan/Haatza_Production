async function test() {
  const email = 'sponsor.login.' + Date.now() + '@example.com';
  const phone = '99' + Math.floor(10000000 + Math.random() * 90000000);

  console.log('1. Register Sponsor...');
  const regRes = await fetch('http://localhost:8080/api/v1/sponsorSignup?module=sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Sponsor Login Test',
      companyName: 'Test Corp',
      email: email,
      phone: phone,
      password: 'SponsorPass123!',
      confirmPassword: 'SponsorPass123!'
    })
  });
  const regData = await regRes.json();
  console.log('Register Response status:', regRes.status);

  console.log('\n2. Test sponsorLogin WITHOUT module parameter (Expect HTTP 400)...');
  const noModuleRes = await fetch('http://localhost:8080/api/v1/sponsorLogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: 'SponsorPass123!'
    })
  });
  console.log('No module status:', noModuleRes.status, await noModuleRes.json());

  console.log('\n3. Test sponsorLogin WITH module=sponsor BEFORE activation (Expect HTTP 401 - PENDING status)...');
  const pendingLoginRes = await fetch('http://localhost:8080/api/v1/sponsorLogin?module=sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: 'SponsorPass123!'
    })
  });
  console.log('Pending login status:', pendingLoginRes.status, await pendingLoginRes.json());

  console.log('\n4. Test login?module=sponsor WITH module=sponsor query parameter...');
  const loginModuleRes = await fetch('http://localhost:8080/api/v1/login?module=sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: 'SponsorPass123!'
    })
  });
  console.log('Login?module=sponsor status:', loginModuleRes.status, await loginModuleRes.json());
}

test();
