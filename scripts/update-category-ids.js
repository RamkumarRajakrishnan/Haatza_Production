const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

async function migrate() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Starting category migration transaction...');
    await client.query('BEGIN');

    // 1. Fetch current categories from category_master
    const catRes = await client.query(
      'SELECT id, category_id, category_name, parent_category_id, module FROM public.category_master'
    );
    const existingCategories = catRes.rows;
    console.log(`Fetched ${existingCategories.length} existing categories from category_master.`);

    // Sort existing categories alphabetically by category_id to assign sequential new IDs
    existingCategories.sort((a, b) => a.category_id.localeCompare(b.category_id));

    const idMap = {}; // database UUID -> new CAT_xxx ID
    const keyMap = {}; // old category_id -> new CAT_xxx ID
    const nameMap = {}; // category_name -> new CAT_xxx ID (for UUID lookups)

    existingCategories.forEach((cat, index) => {
      const numStr = String(index + 1).padStart(3, '0');
      const newId = `CAT_${numStr}`;
      idMap[cat.id] = newId;
      keyMap[cat.category_id] = newId;
      
      const nameKey = cat.category_name.toLowerCase().trim();
      nameMap[nameKey] = newId;

      console.log(`Mapping existing: ${cat.category_id} (${cat.category_name}) -> ${newId}`);
    });

    // 2. Custom categories in appbar or dashboard that don't exist in category_master
    const customCategories = [
      { id: 'CAT-E-CITY-01', name: 'Electronic City Express', module: 'LITE' },
      { id: 'CAT-KORA-01', name: 'Koramangala Gourmet', module: 'LITE' },
      { id: 'CAT-INDIRA-01', name: 'Indiranagar Fashion', module: 'LITE' },
      { id: 'CAT-NIGHT-01', name: 'Night Special', module: 'LITE' },
      { id: 'haatza-cat-001', name: 'Haatza Electronics', module: 'LITE' }
    ];

    let nextIndex = existingCategories.length + 1;
    for (const custom of customCategories) {
      // Check if it already exists to avoid duplicate insertions
      const checkDup = await client.query(
        "SELECT id FROM public.category_master WHERE LOWER(category_name) = $1",
        [custom.name.toLowerCase().trim()]
      );

      if (checkDup.rows.length > 0) {
        console.log(`Custom category '${custom.name}' already exists in category_master. Skipping insertion.`);
        continue;
      }

      const numStr = String(nextIndex).padStart(3, '0');
      const newId = `CAT_${numStr}`;
      keyMap[custom.id] = newId;
      nameMap[custom.name.toLowerCase().trim()] = newId;
      console.log(`Mapping custom: ${custom.id} (${custom.name}) -> ${newId}`);

      const uuid = crypto.randomUUID();
      const insertRes = await client.query(
        `INSERT INTO public.category_master (id, category_id, category_name, parent_category_id, category_type, category_image, description, sequence, status, module, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, 'CATEGORY', NULL, $4, 0, 'ACTIVE', $5, NOW(), NOW())`,
        [uuid, newId, custom.name, `Auto-created during migration for ${custom.name}`, custom.module]
      );
      console.log(`Inserted custom category '${custom.name}' into category_master (affected rows: ${insertRes.rowCount}).`);
      
      idMap[uuid] = newId;
      nextIndex++;
    }

    // 3. Update category_master entries
    console.log('Updating category_master table keys (temporary TEMP_ prefix)...');
    for (const cat of existingCategories) {
      const tempId = `TEMP_${keyMap[cat.category_id]}`;
      const res = await client.query(
        'UPDATE public.category_master SET category_id = $1 WHERE id = $2',
        [tempId, cat.id]
      );
      console.log(`Set temp category_id for ${cat.category_name} (id: ${cat.id}): ${tempId} (affected rows: ${res.rowCount})`);
    }

    // Now set them to their final values and resolve parents
    console.log('Updating category_master table keys (final values)...');
    for (const cat of existingCategories) {
      const finalId = keyMap[cat.category_id];
      const oldParent = cat.parent_category_id;
      const newParent = oldParent ? keyMap[oldParent] : null;

      const res = await client.query(
        'UPDATE public.category_master SET category_id = $1, parent_category_id = $2 WHERE id = $3',
        [finalId, newParent, cat.id]
      );
      console.log(`Set final category_id for ${cat.category_name} (id: ${cat.id}): ${finalId}, parent: ${newParent} (affected rows: ${res.rowCount})`);
    }

    // 4. Update appbar_categories table
    console.log('Updating appbar_categories table...');
    const appbarRes = await client.query('SELECT id, category_id, category_name FROM public.appbar_categories');
    for (const row of appbarRes.rows) {
      let targetNewId = null;
      if (keyMap[row.category_id]) {
        targetNewId = keyMap[row.category_id];
      } else {
        const nameKey = row.category_name.toLowerCase().trim();
        if (nameMap[nameKey]) {
          targetNewId = nameMap[nameKey];
        }
      }

      if (targetNewId) {
        const res = await client.query(
          'UPDATE public.appbar_categories SET category_id = $1 WHERE id = $2',
          [targetNewId, row.id]
        );
        console.log(`Updated appbar_categories row ${row.id}: ${row.category_id} -> ${targetNewId} (affected rows: ${res.rowCount})`);
      } else {
        console.warn(`Could not resolve category ID mapping for appbar_category: ${row.category_id} (${row.category_name})`);
      }
    }

    // 5. Update dashboard table
    console.log('Updating dashboard table...');
    const dashRes = await client.query('SELECT id, category_id, category_name FROM public.dashboard');
    for (const row of dashRes.rows) {
      let targetNewId = null;
      if (keyMap[row.category_id]) {
        targetNewId = keyMap[row.category_id];
      } else {
        const nameKey = row.category_name.toLowerCase().trim();
        if (nameMap[nameKey]) {
          targetNewId = nameMap[nameKey];
        }
      }

      if (targetNewId) {
        const res = await client.query(
          'UPDATE public.dashboard SET category_id = $1 WHERE id = $2',
          [targetNewId, row.id]
        );
        console.log(`Updated dashboard row ${row.id}: ${row.category_id} -> ${targetNewId} (affected rows: ${res.rowCount})`);
      } else {
        console.warn(`Could not resolve category ID mapping for dashboard widget: ${row.category_id} (${row.category_name})`);
      }
    }

    // 6. Update products table
    console.log('Updating products table...');
    try {
      const prodRes = await client.query('SELECT product_id, category_id FROM public.products');
      for (const row of prodRes.rows) {
        if (row.category_id) {
          let targetNewId = keyMap[row.category_id];
          if (targetNewId) {
            const res = await client.query(
              'UPDATE public.products SET category_id = $1 WHERE product_id = $2',
              [targetNewId, row.product_id]
            );
            console.log(`Updated products row ${row.product_id}: ${row.category_id} -> ${targetNewId} (affected rows: ${res.rowCount})`);
          }
        }
      }
    } catch (e) {
      console.log('Skipping products update:', e.message);
    }

    await client.query('COMMIT');
    console.log('✅ Category ID migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, transaction rolled back:', err);
  } finally {
    await client.end();
  }
}

migrate();
