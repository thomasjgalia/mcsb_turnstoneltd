// Script to encode Oracle wallet files to base64 for Vercel deployment
const fs = require('fs');
const path = require('path');

const walletDir = 'C:\\Users\\T933261\\oracle_wallet';

// Files needed for Oracle connection
const filesToEncode = [
  'cwallet.sso',
  'tnsnames.ora',
  'sqlnet.ora',
  'ewallet.pem'
];

console.log('='.repeat(70));
console.log('Oracle Wallet Base64 Encoder');
console.log('='.repeat(70));
console.log('\nAdd these to your Vercel Environment Variables:\n');

filesToEncode.forEach(filename => {
  const filepath = path.join(walletDir, filename);

  try {
    const fileContent = fs.readFileSync(filepath);
    const base64 = fileContent.toString('base64');

    const envVarName = `ORACLE_WALLET_${filename.replace(/\./g, '_').toUpperCase()}`;

    console.log(`\n${'-'.repeat(70)}`);
    console.log(`File: ${filename}`);
    console.log(`Environment Variable: ${envVarName}`);
    console.log(`Size: ${(base64.length / 1024).toFixed(2)} KB`);
    console.log(`${'-'.repeat(70)}`);
    console.log(base64);

  } catch (error) {
    console.error(`\n❌ Error reading ${filename}:`, error.message);
  }
});

console.log('\n' + '='.repeat(70));
console.log('Copy each base64 value above to Vercel as environment variables');
console.log('='.repeat(70));
