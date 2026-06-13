const fs = require('fs');
const content = fs.readFileSync('c:/Users/Hp Vitus Gaming/Desktop/saraosiyo crm/src/components/StudentDetails.tsx', 'utf8');
const lines = content.split(/\r?\n/);
for (let i = 795; i <= 810; i++) {
    console.log(`Line ${i + 1}: ${JSON.stringify(lines[i])}`);
}
