/**
 * Gym / Supplement Store — Demo Data Seeder
 * Usage: node database/seed-demo.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  console.log('✅ Connected\n');

  // ── Helper ────────────────────────────────────────────────────────────────
  async function insert(table, cols, rows) {
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    const flat = rows.flat();
    const [res] = await conn.execute(
      `INSERT IGNORE INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`,
      flat
    );
    return res;
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin123', 10);
  const mgrHash = await bcrypt.hash('manager123', 10);
  await conn.execute(`INSERT INTO users (name,email,password,role) VALUES (?,?,?,'admin') ON DUPLICATE KEY UPDATE id=id`,
    ['Admin', 'admin@store.com', hash]);
  await conn.execute(`INSERT INTO users (name,email,password,role) VALUES (?,?,?,'manager') ON DUPLICATE KEY UPDATE id=id`,
    ['Rahul Manager', 'manager@store.com', mgrHash]);
  console.log('  ✅ Users');

  // ── Stores ────────────────────────────────────────────────────────────────
  await insert('stores', ['name','address','phone'], [
    ['Invincible Fitness - Main Branch', 'Shop 12, Fitness Plaza, MG Road, Bangalore', '+91 98765 43210'],
    ['Invincible Fitness - Koramangala',  '2nd Floor, Sports Hub, Koramangala, Bangalore', '+91 91234 56789'],
    ['Invincible Fitness - Whitefield',   'Unit 5, Tech Park Mall, Whitefield, Bangalore', '+91 87654 32109'],
  ]);
  console.log('  ✅ Stores');

  // ── Categories ────────────────────────────────────────────────────────────
  await insert('categories', ['name'], [
    ['Protein Supplements'], ['Pre-Workout'], ['Post-Workout'],
    ['Mass Gainers'], ['Fat Burners'], ['Vitamins & Minerals'],
    ['Amino Acids'], ['Creatine'], ['Bars & Snacks'], ['Apparel & Accessories'],
  ]);
  console.log('  ✅ Categories');

  // ── Brands ────────────────────────────────────────────────────────────────
  await insert('brands', ['name'], [
    ['MuscleBlaze'], ['Optimum Nutrition'], ['MyProtein'],
    ['BSN'], ['Dymatize'], ['MuscleTech'],
    ['GNC'], ['Scitron'], ['AS-IT-IS Nutrition'], ['Nakpro'],
  ]);
  console.log('  ✅ Brands');

  // ── Flavors ───────────────────────────────────────────────────────────────
  await insert('flavors', ['name'], [
    ['Chocolate'], ['Vanilla'], ['Strawberry'], ['Mango'],
    ['Cookies & Cream'], ['Banana'], ['Unflavored'], ['Rocky Road'],
    ['Mocha'], ['Butterscotch'],
  ]);
  console.log('  ✅ Flavors');

  // ── Suppliers ─────────────────────────────────────────────────────────────
  await insert('suppliers', ['name','contact','phone','email','address'], [
    ['NutriSource India Pvt Ltd',  'Amit Shah',   '+91 99001 12233', 'amit@nutrisource.in',  'Warehouse 7, APMC Yard, Navi Mumbai'],
    ['FitSupply Distributors',     'Priya Nair',  '+91 88002 23344', 'priya@fitsupply.in',   'Plot 22, Industrial Area, Pune'],
    ['ProteinHub Wholesale',       'Karan Mehta', '+91 77003 34455', 'karan@proteinhub.in',  'Sector 18, Noida, UP'],
    ['SupplementWorld Imports',    'Sneha Rao',   '+91 66004 45566', 'sneha@suppworld.in',   'T2 Cargo Complex, Chennai Airport'],
    ['GymGear & Nutrition Co.',    'Vikram Joshi','+91 55005 56677', 'vikram@gymgear.in',    'Baner Road, Pune'],
  ]);
  console.log('  ✅ Suppliers');

  // ── Products ──────────────────────────────────────────────────────────────
  const products = [
    ['Whey Protein 1kg',           'WP-MB-1KG',  1499.00, 'Premium whey protein concentrate, 24g protein per serving'],
    ['Whey Protein 2kg',           'WP-MB-2KG',  2799.00, 'Economy pack whey protein concentrate'],
    ['Whey Isolate 1kg',           'WI-ON-1KG',  2999.00, 'Fast-absorbing whey isolate, 90% protein'],
    ['Whey Isolate 2kg',           'WI-ON-2KG',  5499.00, 'Double pack whey isolate'],
    ['Casein Protein 1kg',         'CP-MP-1KG',  2199.00, 'Slow-release micellar casein for overnight recovery'],
    ['Mass Gainer 3kg',            'MG-MB-3KG',  1999.00, 'High-calorie mass gainer, 1250 kcal per serving'],
    ['Mass Gainer 6kg',            'MG-MB-6KG',  3499.00, 'Bulk pack mass gainer'],
    ['Pre-Workout Explosive',      'PW-BSN-300', 1799.00, 'High-stim pre-workout with caffeine and beta-alanine'],
    ['Pre-Workout Stim-Free',      'PW-SF-250',  1599.00, 'Stimulant-free pump formula'],
    ['Creatine Monohydrate 300g',  'CR-AISI-300', 599.00, 'Pure micronized creatine monohydrate'],
    ['Creatine Monohydrate 500g',  'CR-AISI-500', 899.00, 'Economy creatine monohydrate'],
    ['BCAA 2:1:1 250g',            'BC-SC-250',   799.00, 'Branched chain amino acids 2:1:1 ratio'],
    ['BCAA 2:1:1 500g',            'BC-SC-500',  1399.00, 'Large pack BCAA'],
    ['EAA Complex 300g',           'EA-MP-300',  1299.00, 'Essential amino acids with electrolytes'],
    ['Fat Burner Thermogenic',     'FB-MT-90',   1899.00, '90 capsules thermogenic fat burner'],
    ['L-Carnitine 1000mg',         'LC-GNC-60',   999.00, '60 capsules L-Carnitine for fat metabolism'],
    ['Multivitamin 60 tabs',       'MV-GNC-60',   699.00, 'Complete daily multivitamin for athletes'],
    ['Omega-3 Fish Oil 60 caps',   'OM-NK-60',    549.00, 'High-potency omega-3 fatty acids'],
    ['Vitamin D3 + K2 60 caps',    'VD-NK-60',    449.00, 'Vitamin D3 2000IU with K2 for bone health'],
    ['Protein Bar Box (12 pcs)',   'PB-MB-12',   1199.00, 'High protein snack bars, 20g protein each'],
    ['Peanut Butter Crunchy 1kg',  'PB-CR-1KG',   699.00, 'Natural crunchy peanut butter, high protein'],
    ['Shaker Bottle 700ml',        'SH-700',      299.00, 'BPA-free protein shaker with mixing ball'],
    ['Gym Gloves (M)',             'GG-M',        499.00, 'Anti-slip gym training gloves'],
    ['Resistance Bands Set',       'RB-SET',      799.00, 'Set of 5 resistance bands, various strengths'],
    ['Whey Protein 500g (Trial)',  'WP-TR-500',   849.00, 'Trial size whey protein for beginners'],
  ];

  await insert('products', ['name','barcode','price','description'],
    products.map(([name, barcode, price, description]) => [name, barcode, price, description])
  );
  console.log('  ✅ Products');

  // ── Fetch IDs ─────────────────────────────────────────────────────────────
  const [catRows]     = await conn.execute('SELECT id, name FROM categories');
  const [brandRows]   = await conn.execute('SELECT id, name FROM brands');
  const [flavorRows]  = await conn.execute('SELECT id, name FROM flavors');
  const [productRows] = await conn.execute('SELECT id, name FROM products');
  const [storeRows]   = await conn.execute('SELECT id, name FROM stores');
  const [supplierRows]= await conn.execute('SELECT id, name FROM suppliers');

  const cat   = Object.fromEntries(catRows.map(r => [r.name, r.id]));
  const brand = Object.fromEntries(brandRows.map(r => [r.name, r.id]));
  const flav  = Object.fromEntries(flavorRows.map(r => [r.name, r.id]));
  const prod  = Object.fromEntries(productRows.map(r => [r.name, r.id]));
  const store = Object.fromEntries(storeRows.map(r => [r.name, r.id]));
  const supp  = Object.fromEntries(supplierRows.map(r => [r.name, r.id]));

  // ── Product → Categories ──────────────────────────────────────────────────
  const pcLinks = [
    ['Whey Protein 1kg',          'Protein Supplements'],
    ['Whey Protein 2kg',          'Protein Supplements'],
    ['Whey Isolate 1kg',          'Protein Supplements'],
    ['Whey Isolate 2kg',          'Protein Supplements'],
    ['Casein Protein 1kg',        'Protein Supplements'],
    ['Mass Gainer 3kg',           'Mass Gainers'],
    ['Mass Gainer 6kg',           'Mass Gainers'],
    ['Pre-Workout Explosive',     'Pre-Workout'],
    ['Pre-Workout Stim-Free',     'Pre-Workout'],
    ['Creatine Monohydrate 300g', 'Creatine'],
    ['Creatine Monohydrate 500g', 'Creatine'],
    ['BCAA 2:1:1 250g',           'Amino Acids'],
    ['BCAA 2:1:1 500g',           'Amino Acids'],
    ['EAA Complex 300g',          'Amino Acids'],
    ['Fat Burner Thermogenic',    'Fat Burners'],
    ['L-Carnitine 1000mg',        'Fat Burners'],
    ['Multivitamin 60 tabs',      'Vitamins & Minerals'],
    ['Omega-3 Fish Oil 60 caps',  'Vitamins & Minerals'],
    ['Vitamin D3 + K2 60 caps',   'Vitamins & Minerals'],
    ['Protein Bar Box (12 pcs)',  'Bars & Snacks'],
    ['Peanut Butter Crunchy 1kg', 'Bars & Snacks'],
    ['Shaker Bottle 700ml',       'Apparel & Accessories'],
    ['Gym Gloves (M)',            'Apparel & Accessories'],
    ['Resistance Bands Set',      'Apparel & Accessories'],
    ['Whey Protein 500g (Trial)', 'Protein Supplements'],
  ];
  for (const [p, c] of pcLinks) {
    if (prod[p] && cat[c]) await conn.execute('INSERT IGNORE INTO product_categories (product_id,category_id) VALUES (?,?)', [prod[p], cat[c]]);
  }
  console.log('  ✅ Product → Categories');

  // ── Product → Brands ──────────────────────────────────────────────────────
  const pbLinks = [
    ['Whey Protein 1kg',          'MuscleBlaze'],
    ['Whey Protein 2kg',          'MuscleBlaze'],
    ['Whey Isolate 1kg',          'Optimum Nutrition'],
    ['Whey Isolate 2kg',          'Optimum Nutrition'],
    ['Casein Protein 1kg',        'MyProtein'],
    ['Mass Gainer 3kg',           'MuscleBlaze'],
    ['Mass Gainer 6kg',           'MuscleBlaze'],
    ['Pre-Workout Explosive',     'BSN'],
    ['Pre-Workout Stim-Free',     'Dymatize'],
    ['Creatine Monohydrate 300g', 'AS-IT-IS Nutrition'],
    ['Creatine Monohydrate 500g', 'AS-IT-IS Nutrition'],
    ['BCAA 2:1:1 250g',           'Scitron'],
    ['BCAA 2:1:1 500g',           'Scitron'],
    ['EAA Complex 300g',          'MyProtein'],
    ['Fat Burner Thermogenic',    'MuscleTech'],
    ['L-Carnitine 1000mg',        'GNC'],
    ['Multivitamin 60 tabs',      'GNC'],
    ['Omega-3 Fish Oil 60 caps',  'Nakpro'],
    ['Vitamin D3 + K2 60 caps',   'Nakpro'],
    ['Protein Bar Box (12 pcs)',  'MuscleBlaze'],
    ['Peanut Butter Crunchy 1kg', 'Nakpro'],
    ['Whey Protein 500g (Trial)', 'MuscleBlaze'],
  ];
  for (const [p, b] of pbLinks) {
    if (prod[p] && brand[b]) await conn.execute('INSERT IGNORE INTO product_brands (product_id,brand_id) VALUES (?,?)', [prod[p], brand[b]]);
  }
  console.log('  ✅ Product → Brands');

  // ── Product → Flavors ─────────────────────────────────────────────────────
  const pfLinks = [
    ['Whey Protein 1kg',          'Chocolate'],
    ['Whey Protein 1kg',          'Vanilla'],
    ['Whey Protein 2kg',          'Chocolate'],
    ['Whey Protein 2kg',          'Cookies & Cream'],
    ['Whey Isolate 1kg',          'Chocolate'],
    ['Whey Isolate 1kg',          'Strawberry'],
    ['Whey Isolate 2kg',          'Vanilla'],
    ['Casein Protein 1kg',        'Chocolate'],
    ['Casein Protein 1kg',        'Banana'],
    ['Mass Gainer 3kg',           'Chocolate'],
    ['Mass Gainer 3kg',           'Vanilla'],
    ['Mass Gainer 6kg',           'Chocolate'],
    ['Pre-Workout Explosive',     'Mango'],
    ['Pre-Workout Explosive',     'Mocha'],
    ['Pre-Workout Stim-Free',     'Strawberry'],
    ['Creatine Monohydrate 300g', 'Unflavored'],
    ['Creatine Monohydrate 500g', 'Unflavored'],
    ['BCAA 2:1:1 250g',           'Mango'],
    ['BCAA 2:1:1 500g',           'Watermelon'],
    ['EAA Complex 300g',          'Strawberry'],
    ['Whey Protein 500g (Trial)', 'Chocolate'],
    ['Whey Protein 500g (Trial)', 'Butterscotch'],
  ];
  for (const [p, f] of pfLinks) {
    if (prod[p] && flav[f]) await conn.execute('INSERT IGNORE INTO product_flavors (product_id,flavor_id) VALUES (?,?)', [prod[p], flav[f]]);
  }
  console.log('  ✅ Product → Flavors');

  // ── Store Products (stock) ────────────────────────────────────────────────
  const mainStore = store['Invincible Fitness - Main Branch'];
  const koraStore = store['Invincible Fitness - Koramangala'];
  const whiteStore= store['Invincible Fitness - Whitefield'];

  const stockData = [
    // [product_name, main, kora, white]
    ['Whey Protein 1kg',          45, 30, 20],
    ['Whey Protein 2kg',          20, 15, 10],
    ['Whey Isolate 1kg',          18, 12,  8],
    ['Whey Isolate 2kg',           8,  5,  3],
    ['Casein Protein 1kg',        12,  8,  5],
    ['Mass Gainer 3kg',           25, 18, 12],
    ['Mass Gainer 6kg',           10,  6,  4],
    ['Pre-Workout Explosive',     30, 20, 15],
    ['Pre-Workout Stim-Free',     20, 14, 10],
    ['Creatine Monohydrate 300g', 50, 35, 25],
    ['Creatine Monohydrate 500g', 30, 20, 15],
    ['BCAA 2:1:1 250g',           35, 25, 18],
    ['BCAA 2:1:1 500g',           20, 14, 10],
    ['EAA Complex 300g',          15, 10,  7],
    ['Fat Burner Thermogenic',    22, 16, 12],
    ['L-Carnitine 1000mg',        18, 12,  8],
    ['Multivitamin 60 tabs',      40, 28, 20],
    ['Omega-3 Fish Oil 60 caps',  35, 24, 18],
    ['Vitamin D3 + K2 60 caps',   30, 20, 15],
    ['Protein Bar Box (12 pcs)',  25, 18, 12],
    ['Peanut Butter Crunchy 1kg', 20, 14, 10],
    ['Shaker Bottle 700ml',       40, 30, 20],
    ['Gym Gloves (M)',            15, 10,  8],
    ['Resistance Bands Set',      12,  8,  5],
    ['Whey Protein 500g (Trial)', 30, 22, 15],
  ];

  for (const [pName, main, kora, white] of stockData) {
    const pid = prod[pName];
    if (!pid) continue;
    if (mainStore)  await conn.execute('INSERT INTO store_products (store_id,product_id,stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [mainStore,  pid, main]);
    if (koraStore)  await conn.execute('INSERT INTO store_products (store_id,product_id,stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [koraStore,  pid, kora]);
    if (whiteStore) await conn.execute('INSERT INTO store_products (store_id,product_id,stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [whiteStore, pid, white]);
  }
  console.log('  ✅ Store stock');

  // ── Customers ─────────────────────────────────────────────────────────────
  await insert('customers', ['name','phone'], [
    ['Arjun Sharma',    '9876543210'],
    ['Priya Patel',     '9765432109'],
    ['Rohit Verma',     '9654321098'],
    ['Sneha Gupta',     '9543210987'],
    ['Karan Singh',     '9432109876'],
    ['Ananya Nair',     '9321098765'],
    ['Vikram Reddy',    '9210987654'],
    ['Pooja Mehta',     '9109876543'],
    ['Aditya Kumar',    '9098765432'],
    ['Divya Joshi',     '8987654321'],
  ]);
  console.log('  ✅ Customers');

  // ── Purchase Orders ───────────────────────────────────────────────────────
  const [userRows] = await conn.execute("SELECT id FROM users WHERE role='admin' LIMIT 1");
  const adminId = userRows[0]?.id;
  const [supplierIds] = await conn.execute('SELECT id FROM suppliers LIMIT 3');

  const orders = [
    { num: 'PO-2024-001', store: 'Invincible Fitness - Main Branch',    supplier: 'NutriSource India Pvt Ltd',  status: 'received', notes: 'Monthly restock' },
    { num: 'PO-2024-002', store: 'Invincible Fitness - Koramangala',    supplier: 'FitSupply Distributors',     status: 'received', notes: 'New store opening stock' },
    { num: 'PO-2024-003', store: 'Invincible Fitness - Whitefield',     supplier: 'ProteinHub Wholesale',       status: 'pending',  notes: 'Pending delivery' },
    { num: 'PO-2024-004', store: 'Invincible Fitness - Main Branch',    supplier: 'SupplementWorld Imports',    status: 'received', notes: 'Imported brands restock' },
    { num: 'PO-2024-005', store: 'Invincible Fitness - Koramangala',    supplier: 'GymGear & Nutrition Co.',    status: 'cancelled', notes: 'Cancelled due to pricing' },
  ];

  for (const o of orders) {
    const sid = store[o.store];
    const supId = supp[o.supplier];
    try {
      await conn.execute(
        `INSERT IGNORE INTO purchase_orders (order_number,store_id,supplier_id,status,total_amount,notes,created_by)
         VALUES (?,?,?,?,?,?,?)`,
        [o.num, sid || null, supId || null, o.status, 0, o.notes, adminId || null]
      );
    } catch(e) { /* skip if column missing */ }
  }

  // Add items to first two orders
  const [poRows] = await conn.execute("SELECT id, order_number FROM purchase_orders WHERE order_number IN ('PO-2024-001','PO-2024-002')");
  const poMap = Object.fromEntries(poRows.map(r => [r.order_number, r.id]));

  const poItems = {
    'PO-2024-001': [
      ['Whey Protein 1kg', 20, 1200], ['Whey Protein 2kg', 10, 2200],
      ['Creatine Monohydrate 300g', 30, 450], ['BCAA 2:1:1 250g', 20, 620],
      ['Multivitamin 60 tabs', 25, 520],
    ],
    'PO-2024-002': [
      ['Whey Isolate 1kg', 15, 2400], ['Mass Gainer 3kg', 12, 1600],
      ['Pre-Workout Explosive', 18, 1400], ['Protein Bar Box (12 pcs)', 15, 950],
    ],
  };

  let totalAmounts = { 'PO-2024-001': 0, 'PO-2024-002': 0 };
  for (const [poNum, items] of Object.entries(poItems)) {
    const poId = poMap[poNum];
    if (!poId) continue;
    for (const [pName, qty, cost] of items) {
      const pid = prod[pName];
      if (!pid) continue;
      await conn.execute(
        'INSERT IGNORE INTO purchase_order_items (purchase_order_id,product_id,quantity,unit_cost) VALUES (?,?,?,?)',
        [poId, pid, qty, cost]
      );
      totalAmounts[poNum] += qty * cost;
    }
    await conn.execute('UPDATE purchase_orders SET total_amount=? WHERE id=?', [totalAmounts[poNum], poId]);
  }
  console.log('  ✅ Purchase orders');

  // ── Bills ─────────────────────────────────────────────────────────────────
  const [custRows] = await conn.execute('SELECT id, name, phone FROM customers LIMIT 10');
  const customers  = custRows;

  const billsData = [
    { store: 'Invincible Fitness - Main Branch',  customer: 0, payment: 'cash',  items: [['Whey Protein 1kg',1,1499],['Creatine Monohydrate 300g',1,599]], discount: 50 },
    { store: 'Invincible Fitness - Main Branch',  customer: 1, payment: 'upi',   items: [['Whey Isolate 1kg',1,2999],['BCAA 2:1:1 250g',1,799]], discount: 0 },
    { store: 'Invincible Fitness - Koramangala',  customer: 2, payment: 'card',  items: [['Mass Gainer 3kg',1,1999],['Shaker Bottle 700ml',1,299]], discount: 100 },
    { store: 'Invincible Fitness - Main Branch',  customer: 3, payment: 'cash',  items: [['Pre-Workout Explosive',1,1799],['Multivitamin 60 tabs',1,699]], discount: 0 },
    { store: 'Invincible Fitness - Whitefield',   customer: 4, payment: 'upi',   items: [['Whey Protein 1kg',2,1499],['Protein Bar Box (12 pcs)',1,1199]], discount: 200 },
    { store: 'Invincible Fitness - Koramangala',  customer: 5, payment: 'cash',  items: [['Fat Burner Thermogenic',1,1899],['L-Carnitine 1000mg',1,999]], discount: 0 },
    { store: 'Invincible Fitness - Main Branch',  customer: 6, payment: 'card',  items: [['Whey Protein 2kg',1,2799],['Gym Gloves (M)',1,499]], discount: 150 },
    { store: 'Invincible Fitness - Whitefield',   customer: 7, payment: 'upi',   items: [['Creatine Monohydrate 500g',1,899],['EAA Complex 300g',1,1299]], discount: 0 },
    { store: 'Invincible Fitness - Main Branch',  customer: 8, payment: 'cash',  items: [['Whey Protein 500g (Trial)',1,849],['Omega-3 Fish Oil 60 caps',1,549]], discount: 0 },
    { store: 'Invincible Fitness - Koramangala',  customer: 9, payment: 'card',  items: [['Resistance Bands Set',1,799],['Peanut Butter Crunchy 1kg',1,699]], discount: 50 },
  ];

  for (let i = 0; i < billsData.length; i++) {
    const b = billsData[i];
    const sid = store[b.store];
    const cust = customers[b.customer];
    const billNum = `BILL-2024-${String(i + 1).padStart(3, '0')}`;
    const subtotal = b.items.reduce((s, [,qty,price]) => s + qty * price, 0);
    const total = subtotal - b.discount;

    try {
      const [billRes] = await conn.execute(
        `INSERT IGNORE INTO bills (bill_number,store_id,customer_name,customer_phone,payment_type,status,total_amount,discount,tax,created_by)
         VALUES (?,?,?,?,?,'paid',?,?,0,?)`,
        [billNum, sid || null, cust?.name || null, cust?.phone || null, b.payment, total, b.discount, adminId || null]
      );

      if (billRes.insertId) {
        for (const [pName, qty, price] of b.items) {
          const pid = prod[pName];
          if (pid) await conn.execute(
            'INSERT IGNORE INTO bill_items (bill_id,product_id,quantity,unit_price) VALUES (?,?,?,?)',
            [billRes.insertId, pid, qty, price]
          );
        }
      }
    } catch(e) { console.log(`  ⚠️  Bill ${billNum} skipped: ${e.message}`); }
  }
  console.log('  ✅ Bills');

  console.log('\n✅ Demo data seeded successfully!');
  console.log('   Admin:   admin@store.com    / admin123');
  console.log('   Manager: manager@store.com  / manager123');
  await conn.end();
}

seed().catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });
