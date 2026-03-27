import bcrypt from 'bcryptjs';
const hash = '$2b$10$8sk4BeE2n/FugCMOxmGmS.vJTkqS8fK7g9KhYmI14O9YzvgPqbF.S';
const testPassword = 'admin123';

async function test() {
  const match = await bcrypt.compare(testPassword, hash);
  console.log('Password "admin123" matches hash:', match);
}

test();
