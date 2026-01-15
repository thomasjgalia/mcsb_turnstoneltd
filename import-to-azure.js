// ============================================================================
// Import OMOP CSV files to Azure SQL Database
// ============================================================================
// Usage: node import-to-azure.js
// ============================================================================

import sql from 'mssql';
import fs from 'fs';
import readline from 'readline';

// Azure SQL connection config
const config = {
  server: 'mcsbserver.database.windows.net',
  database: 'omop_vocabulary',
  user: 'CloudSAb1e05bb3',
  password: 'S0Lfiliilibertati$',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 60000,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// CSV file paths
const files = {
  concept: 'C:\\OMOP_VOCAB\\CONCEPT.csv',
  concept_ancestor: 'C:\\OMOP_VOCAB\\CONCEPT_ANCESTOR.csv',
  concept_relationship: 'C:\\OMOP_VOCAB\\CONCEPT_RELATIONSHIP.csv',
};

// Parse CSV line with pipe delimiter and quoted fields
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === '|' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  // Remove quotes and handle empty strings
  return values.map(v => {
    if (v === '' || v === '""') return null;
    return v;
  });
}

// Import CONCEPT table
async function importConcept(pool) {
  console.log('\n📊 Importing CONCEPT table...');
  const fileStream = fs.createReadStream(files.concept);
  const rl = readline.createInterface({ input: fileStream });

  let lineNum = 0;
  let imported = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // Skip header

    const values = parseCsvLine(line);
    batch.push(values);

    if (batch.length >= BATCH_SIZE) {
      // Insert batch
      const table = new sql.Table('concept');
      table.columns.add('concept_id', sql.Int, { nullable: false });
      table.columns.add('concept_name', sql.NVarChar(255), { nullable: false });
      table.columns.add('domain_id', sql.NVarChar(20), { nullable: false });
      table.columns.add('vocabulary_id', sql.NVarChar(20), { nullable: false });
      table.columns.add('concept_class_id', sql.NVarChar(20), { nullable: false });
      table.columns.add('standard_concept', sql.NVarChar(1), { nullable: true });
      table.columns.add('concept_code', sql.NVarChar(50), { nullable: false });
      table.columns.add('valid_start_date', sql.Date, { nullable: false });
      table.columns.add('valid_end_date', sql.Date, { nullable: false });
      table.columns.add('invalid_reason', sql.NVarChar(1), { nullable: true });

      batch.forEach(row => {
        table.rows.add(
          parseInt(row[0]),
          row[1],
          row[2],
          row[3],
          row[4],
          row[5],
          row[6],
          row[7],
          row[8],
          row[9]
        );
      });

      const request = pool.request();
      await request.bulk(table);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported} rows...`);
      batch = [];
    }
  }

  // Insert remaining rows
  if (batch.length > 0) {
    const table = new sql.Table('concept');
    table.columns.add('concept_id', sql.Int, { nullable: false });
    table.columns.add('concept_name', sql.NVarChar(255), { nullable: false });
    table.columns.add('domain_id', sql.NVarChar(20), { nullable: false });
    table.columns.add('vocabulary_id', sql.NVarChar(20), { nullable: false });
    table.columns.add('concept_class_id', sql.NVarChar(20), { nullable: false });
    table.columns.add('standard_concept', sql.NVarChar(1), { nullable: true });
    table.columns.add('concept_code', sql.NVarChar(50), { nullable: false });
    table.columns.add('valid_start_date', sql.Date, { nullable: false });
    table.columns.add('valid_end_date', sql.Date, { nullable: false });
    table.columns.add('invalid_reason', sql.NVarChar(1), { nullable: true });

    batch.forEach(row => {
      table.rows.add(
        parseInt(row[0]),
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        row[6],
        row[7],
        row[8],
        row[9]
      );
    });

    const request = pool.request();
    await request.bulk(table);
    imported += batch.length;
  }

  console.log(`✅ CONCEPT: ${imported} rows imported`);
}

// Import CONCEPT_ANCESTOR table
async function importConceptAncestor(pool) {
  console.log('\n📊 Importing CONCEPT_ANCESTOR table...');
  const fileStream = fs.createReadStream(files.concept_ancestor);
  const rl = readline.createInterface({ input: fileStream });

  let lineNum = 0;
  let imported = 0;
  let batch = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // Skip header

    const values = parseCsvLine(line);
    batch.push(values);

    if (batch.length >= BATCH_SIZE) {
      const table = new sql.Table('concept_ancestor');
      table.columns.add('ancestor_concept_id', sql.Int, { nullable: false });
      table.columns.add('descendant_concept_id', sql.Int, { nullable: false });
      table.columns.add('min_levels_of_separation', sql.Int, { nullable: false });
      table.columns.add('max_levels_of_separation', sql.Int, { nullable: false });

      batch.forEach(row => {
        table.rows.add(
          parseInt(row[0]),
          parseInt(row[1]),
          parseInt(row[2]),
          parseInt(row[3])
        );
      });

      const request = pool.request();
      await request.bulk(table);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported} rows...`);
      batch = [];
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    const table = new sql.Table('concept_ancestor');
    table.columns.add('ancestor_concept_id', sql.Int, { nullable: false });
    table.columns.add('descendant_concept_id', sql.Int, { nullable: false });
    table.columns.add('min_levels_of_separation', sql.Int, { nullable: false });
    table.columns.add('max_levels_of_separation', sql.Int, { nullable: false });

    batch.forEach(row => {
      table.rows.add(
        parseInt(row[0]),
        parseInt(row[1]),
        parseInt(row[2]),
        parseInt(row[3])
      );
    });

    const request = pool.request();
    await request.bulk(table);
    imported += batch.length;
  }

  console.log(`✅ CONCEPT_ANCESTOR: ${imported} rows imported`);
}

// Import CONCEPT_RELATIONSHIP table
async function importConceptRelationship(pool) {
  console.log('\n📊 Importing CONCEPT_RELATIONSHIP table...');
  const fileStream = fs.createReadStream(files.concept_relationship);
  const rl = readline.createInterface({ input: fileStream });

  let lineNum = 0;
  let imported = 0;
  let batch = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // Skip header

    const values = parseCsvLine(line);
    batch.push(values);

    if (batch.length >= BATCH_SIZE) {
      const table = new sql.Table('concept_relationship');
      table.columns.add('concept_id_1', sql.Int, { nullable: false });
      table.columns.add('concept_id_2', sql.Int, { nullable: false });
      table.columns.add('relationship_id', sql.NVarChar(20), { nullable: false });
      table.columns.add('valid_start_date', sql.Date, { nullable: false });
      table.columns.add('valid_end_date', sql.Date, { nullable: false });
      table.columns.add('invalid_reason', sql.NVarChar(1), { nullable: true });

      batch.forEach(row => {
        table.rows.add(
          parseInt(row[0]),
          parseInt(row[1]),
          row[2],
          row[3],
          row[4],
          row[5]
        );
      });

      const request = pool.request();
      await request.bulk(table);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported} rows...`);
      batch = [];
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    const table = new sql.Table('concept_relationship');
    table.columns.add('concept_id_1', sql.Int, { nullable: false });
    table.columns.add('concept_id_2', sql.Int, { nullable: false });
    table.columns.add('relationship_id', sql.NVarChar(20), { nullable: false });
    table.columns.add('valid_start_date', sql.Date, { nullable: false });
    table.columns.add('valid_end_date', sql.Date, { nullable: false });
    table.columns.add('invalid_reason', sql.NVarChar(1), { nullable: true });

    batch.forEach(row => {
      table.rows.add(
        parseInt(row[0]),
        parseInt(row[1]),
        row[2],
        row[3],
        row[4],
        row[5]
      );
    });

    const request = pool.request();
    await request.bulk(table);
    imported += batch.length;
  }

  console.log(`✅ CONCEPT_RELATIONSHIP: ${imported} rows imported`);
}

// Main import function
async function main() {
  console.log('🚀 Starting OMOP data import to Azure SQL...\n');

  try {
    // Connect to Azure SQL
    console.log('📡 Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    console.log('✅ Connected!\n');

    // Import tables
    await importConcept(pool);
    await importConceptAncestor(pool);
    await importConceptRelationship(pool);

    console.log('\n🎉 All data imported successfully!');
    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
