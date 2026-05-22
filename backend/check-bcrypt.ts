import bcrypt from 'bcrypt';
const hashes = [
  { email: 'admin@gmail.com', hash: '$2b$10$Y3AVtzVpF59dSIfGoL2W3OpxXGcD2h1NXB.3kEw8Oyb1pqpRO//HS' },
  { email: 'nhanvien@gmail.com', hash: '$2b$10$oMjXm8p0mtIM6FwSlrwER.QQPikQngWFKuwi6yW1iy3EaMCnaDobW' },
  { email: 'bep@gmail.com', hash: '$2b$10$uVDVR2ayNlK5wdxeoBiONeek4GlYAtrsf/3Vnqj.zeiR8uTvrtyua' },
];
Promise.all(hashes.map(u => bcrypt.compare('123456', u.hash).then(match => ({ email: u.email, match }))))
  .then(r => console.log(JSON.stringify(r, null, 2)));
