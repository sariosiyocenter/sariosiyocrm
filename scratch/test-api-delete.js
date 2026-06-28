import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

async function main() {
  // 1. Create a test template
  console.log('Creating a test template in database...');
  const template = await prisma.messageTemplate.create({
    data: {
      name: 'Test Template To Delete',
      body: 'Body content',
      category: 'Umumiy',
      schoolId: 1
    }
  });
  console.log('Created template:', template);

  // 2. Generate a valid token
  // Let's use the admin credentials
  const token = jwt.sign(
    { id: 1, email: 'admin@sariosiyo.uz', role: 'ADMIN', schoolId: 1 },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // 3. Perform DELETE request to local server on port 3000
  console.log(`Sending DELETE request to http://127.0.0.1:3000/api/messaging/templates/${template.id}...`);
  try {
    const res = await fetch(`http://127.0.0.1:3000/api/messaging/templates/${template.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Response status:', res.status);
    const body = await res.json();
    console.log('Response body:', body);
  } catch (error) {
    console.error('API request failed:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
