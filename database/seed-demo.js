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
    ['Invincible Stationary - Main Branch', 'Shop 12, Stationary Plaza, MG Road, Bangalore', '+91 98765 43210'],
    ['Invincible Stationary - Koramangala',  '2nd Floor, Student Hub, Koramangala, Bangalore', '+91 91234 56789'],
    ['Invincible Stationary - Whitefield',   'Unit 5, Tech Park Mall, Whitefield, Bangalore', '+91 87654 32109'],
  ]);
  console.log('  ✅ Stores');

  // ── Categories ────────────────────────────────────────────────────────────
  await insert('categories', ['name'], [
    ['Notebooks & Registers'], ['Pens & Pencils'], ['Art & Craft Supplies'],
    ['Files & Folders'], ['Calculators & Electronics'], ['Desk Accessories'],
    ['Papers & Printing'], ['Adhesives & Tapes'], ['Geometry & Measuring'], ['School Bags & Cases'],
  ]);
  console.log('  ✅ Categories');

  // ── Brands ────────────────────────────────────────────────────────────────
  await insert('brands', ['name'], [
    ['Classmate'], ['Faber-Castell'], ['Reynolds'],
    ['Camlin'], ['Doms'], ['Parker'],
    ['Casio'], ['Navneet'], ['Luxor'], ['Staedtler'],
  ]);
  console.log('  ✅ Brands');

  // ── Flavors ───────────────────────────────────────────────────────────────
  await insert('flavors', ['name'], [
    ['Blue'], ['Black'], ['Red'], ['Green'],
    ['Assorted Colors'], ['White'], ['Multi-color'], ['Pastel'],
    ['Transparent'], ['Glossy'],
  ]);
  console.log('  ✅ Flavors');

  // ── Suppliers ─────────────────────────────────────────────────────────────
  await insert('suppliers', ['name','contact','phone','email','address'], [
    ['National Paper & Stationery Ltd', 'Amit Shah',   '+91 99001 12233', 'amit@nationalpaper.in',  'Warehouse 7, APMC Yard, Navi Mumbai'],
    ['Prime Office Supplies Co.',      'Priya Nair',  '+91 88002 23344', 'priya@primesupplies.in', 'Plot 22, Industrial Area, Pune'],
    ['Allied School Products',         'Karan Mehta', '+91 77003 34455', 'karan@alliedschool.in',  'Sector 18, Noida, UP'],
    ['Global Stationery Imports',      'Sneha Rao',   '+91 66004 45566', 'sneha@globalstationery.in','T2 Cargo Complex, Chennai Airport'],
    ['Craft & Office Mart',            'Vikram Joshi','+91 55005 56677', 'vikram@craftmart.in',    'Baner Road, Pune'],
  ]);
  console.log('  ✅ Suppliers');

  // ── Products ──────────────────────────────────────────────────────────────
  const products = [
    ['A4 Spiral Notebook 200 Pages',    'NB-CM-200',  120.00, 'Premium ruled spiral notebook with 70 GSM paper'],
    ['Hardbound Register 300 Pages',    'RG-NV-300',  180.00, 'Heavy duty hardbound accounting and office register'],
    ['Ballpoint Pen Set (Pack of 10)',  'PN-RN-10',   100.00, 'Smooth ink flow 0.7mm ballpoint pens in blue'],
    ['Gel Pen 0.5mm (Pack of 5)',       'GP-LX-05',   150.00, 'Quick-dry waterproof gel ink pens'],
    ['Fountain Pen with Ink Converter',  'FP-PK-01',   499.00, 'Classic stainless steel nib fountain pen'],
    ['A4 Copier Paper 75 GSM (500 sheets)','PP-JK-500', 350.00, 'High brightness multipurpose xerox copier paper'],
    ['Color Pencil Set (24 Shades)',    'CP-FC-24',   220.00, 'Vibrant break-resistant hexagonal colored pencils'],
    ['Scientific Calculator fx-991CW',  'CL-CS-991', 1295.00, 'Non-programmable scientific calculator with 540+ functions'],
    ['Mathematical Drawing Box / Geometry Box','GB-CM-01', 140.00, 'Precision compass, divider, and measuring tools set'],
    ['Desk Organizer & Pen Stand',      'DO-OM-01',   250.00, 'Multi-compartment mesh metal desk tidy organizer'],
    ['Correction Tape 5mm x 6m',        'CT-DM-01',    60.00, 'Instant dry tear-resistant correction tape dispenser'],
    ['Stapler & Staples 24/6 Set',      'ST-KG-24',   130.00, 'Standard half-strip office desk stapler with pins'],
    ['Highlighter Marker Set (6 Colors)','HL-FC-06',   160.00, 'Fluorescent water-based non-toxic highlight markers'],
    ['Sticky Notes 3x3 (Pack of 400)',  'SN-3M-400',  110.00, 'Self-adhesive repositionable memo note pads'],
    ['Heavy Duty Paper Punch (2-Hole)', 'PP-KG-02',   190.00, 'All-metal construction 2-hole puncher, 20 sheets'],
    ['Executive Leatherette Diary 2024','DR-EX-24',   399.00, 'Dated daily planner notebook with ribbon bookmark'],
    ['Acrylic Paint Set 12 Tubes (12ml)','AP-FC-12',  240.00, 'Artist grade rich pigment acrylic colors set'],
    ['Permanent Marker (Pack of 4)',    'PM-LX-04',   120.00, 'Waterproof bullet tip permanent marker pens'],
    ['Display Folder 40 Pockets A4',    'DF-SM-40',   180.00, 'Clear transparent leaf file document portfolio'],
    ['Whiteboard Marker Set (4 Colors)','WB-LX-04',   140.00, 'Easy wipe low odor whiteboard marker pens'],
    ['Craft Scissors 6-inch',           'SC-FC-06',    80.00, 'Stainless steel sharp blade soft grip craft scissors'],
    ['PVA Glue 200ml Bottle',           'GL-FV-200',   70.00, 'Strong bonding non-toxic paper and craft glue'],
    ['Cardboard File Box Set of 3',     'FB-ST-03',   299.00, 'Collapsible document storage archive box'],
    ['Expanding File Folder 12 Pockets','EF-ST-12',   260.00, 'Accordion document organizer folder with index tabs'],
    ['Fine Tip Fineliner Pens (10 Shades)','FL-ST-10', 320.00, '0.4mm metal-clad tip precision drawing pens'],
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
  const mainStore = store['Invincible Stationary - Main Branch'];
  const koraStore = store['Invincible Stationary - Koramangala'];
  const whiteStore= store['Invincible Stationary - Whitefield'];

  const stockData = [
    // [product_name, main, kora, white]
    ['A4 Spiral Notebook 200 Pages',          45, 30, 20],
    ['Hardbound Register 300 Pages',          20, 15, 10],
    ['Ballpoint Pen Set (Pack of 10)',        50, 35, 25],
    ['Gel Pen 0.5mm (Pack of 5)',             35, 25, 18],
    ['Fountain Pen with Ink Converter',       12,  8,  5],
    ['A4 Copier Paper 75 GSM (500 sheets)',   40, 25, 15],
    ['Color Pencil Set (24 Shades)',          25, 18, 12],
    ['Scientific Calculator fx-991CW',        15, 10,  8],
    ['Mathematical Drawing Box / Geometry Box', 30, 20, 15],
    ['Desk Organizer & Pen Stand',            22, 16, 12],
    ['Correction Tape 5mm x 6m',              40, 28, 20],
    ['Stapler & Staples 24/6 Set',            30, 20, 15],
    ['Highlighter Marker Set (6 Colors)',     35, 24, 18],
    ['Sticky Notes 3x3 (Pack of 400)',        50, 35, 25],
    ['Heavy Duty Paper Punch (2-Hole)',       18, 12,  8],
    ['Executive Leatherette Diary 2024',      20, 14, 10],
    ['Acrylic Paint Set 12 Tubes (12ml)',     22, 15, 10],
    ['Permanent Marker (Pack of 4)',          30, 20, 15],
    ['Display Folder 40 Pockets A4',          25, 18, 12],
    ['Whiteboard Marker Set (4 Colors)',      30, 22, 15],
    ['Craft Scissors 6-inch',                 20, 14, 10],
    ['PVA Glue 200ml Bottle',                 35, 25, 18],
    ['Cardboard File Box Set of 3',           15, 10,  8],
    ['Expanding File Folder 12 Pockets',      18, 12,  8],
    ['Fine Tip Fineliner Pens (10 Shades)',   20, 14, 10],
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
    { num: 'PO-2024-001', store: 'Invincible Stationary - Main Branch',    supplier: 'National Paper & Stationery Ltd',  status: 'received', notes: 'Monthly restock' },
    { num: 'PO-2024-002', store: 'Invincible Stationary - Koramangala',    supplier: 'Prime Office Supplies Co.',        status: 'received', notes: 'New store opening stock' },
    { num: 'PO-2024-003', store: 'Invincible Stationary - Whitefield',     supplier: 'Allied School Products',           status: 'pending',  notes: 'Pending delivery' },
    { num: 'PO-2024-004', store: 'Invincible Stationary - Main Branch',    supplier: 'Global Stationery Imports',        status: 'received', notes: 'Imported brands restock' },
    { num: 'PO-2024-005', store: 'Invincible Stationary - Koramangala',    supplier: 'Craft & Office Mart',              status: 'cancelled', notes: 'Cancelled due to pricing' },
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
      ['A4 Spiral Notebook 200 Pages', 50, 90], ['Hardbound Register 300 Pages', 30, 140],
      ['Ballpoint Pen Set (Pack of 10)', 100, 75], ['Gel Pen 0.5mm (Pack of 5)', 60, 110],
      ['A4 Copier Paper 75 GSM (500 sheets)', 40, 270],
    ],
    'PO-2024-002': [
      ['Scientific Calculator fx-991CW', 20, 1050], ['Color Pencil Set (24 Shades)', 40, 165],
      ['Mathematical Drawing Box / Geometry Box', 35, 105], ['Sticky Notes 3x3 (Pack of 400)', 50, 80],
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
    { store: 'Invincible Stationary - Main Branch',  customer: 0, payment: 'cash',  items: [['A4 Spiral Notebook 200 Pages',2,120],['Ballpoint Pen Set (Pack of 10)',1,100]], discount: 20 },
    { store: 'Invincible Stationary - Main Branch',  customer: 1, payment: 'upi',   items: [['Scientific Calculator fx-991CW',1,1295],['Gel Pen 0.5mm (Pack of 5)',2,150]], discount: 0 },
    { store: 'Invincible Stationary - Koramangala',  customer: 2, payment: 'card',  items: [['Color Pencil Set (24 Shades)',1,220],['Mathematical Drawing Box / Geometry Box',1,140]], discount: 30 },
    { store: 'Invincible Stationary - Main Branch',  customer: 3, payment: 'cash',  items: [['A4 Copier Paper 75 GSM (500 sheets)',2,350],['Highlighter Marker Set (6 Colors)',1,160]], discount: 0 },
    { store: 'Invincible Stationary - Whitefield',   customer: 4, payment: 'upi',   items: [['Executive Leatherette Diary 2024',1,399],['Fountain Pen with Ink Converter',1,499]], discount: 50 },
    { store: 'Invincible Stationary - Koramangala',  customer: 5, payment: 'cash',  items: [['Desk Organizer & Pen Stand',1,250],['Stapler & Staples 24/6 Set',1,130]], discount: 0 },
    { store: 'Invincible Stationary - Main Branch',  customer: 6, payment: 'card',  items: [['Hardbound Register 300 Pages',2,180],['Heavy Duty Paper Punch (2-Hole)',1,190]], discount: 25 },
    { store: 'Invincible Stationary - Whitefield',   customer: 7, payment: 'upi',   items: [['Acrylic Paint Set 12 Tubes (12ml)',1,240],['Fine Tip Fineliner Pens (10 Shades)',1,320]], discount: 0 },
    { store: 'Invincible Stationary - Main Branch',  customer: 8, payment: 'cash',  items: [['Sticky Notes 3x3 (Pack of 400)',2,110],['Correction Tape 5mm x 6m',1,60]], discount: 0 },
    { store: 'Invincible Stationary - Koramangala',  customer: 9, payment: 'card',  items: [['Expanding File Folder 12 Pockets',1,260],['Display Folder 40 Pockets A4',1,180]], discount: 20 },
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
