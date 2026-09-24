import mysql from 'mysql2/promise';
import { requireAdmin } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

async function getConn() {
  return mysql.createConnection({
    host:           process.env.DB_HOST     || 'localhost',
    port:           parseInt(process.env.DB_PORT || '3306'),
    user:           process.env.DB_USER     || 'root',
    password:       process.env.DB_PASSWORD || '',
    database:       process.env.DB_NAME     || 'store',
    connectTimeout: 10000,
  });
}

function buildStoreClause(column, userStores) {
  if (!userStores || userStores.length === 0) return { clause: ' AND 1=0', params: [] };
  const placeholders = userStores.map(() => '?').join(',');
  return { clause: ` AND ${column} IN (${placeholders})`, params: userStores };
}

// ── section=counts  (fast — just COUNTs) ─────────────────────────────────────
async function getCounts(userStores, isAdmin) {
  const conn = await getConn();
  try {
    const q = async (sql, params = []) => {
      const [r] = await conn.execute(sql, params);
      return Number(r[0]?.v || 0);
    };

    let poCond = '', spCond = '', siCond = '', bCond = '';
    let poParams = [], spParams = [], siParams = [], bParams = [];

    if (!isAdmin) {
      const poC = buildStoreClause('po.store_id', userStores);
      poCond = poC.clause; poParams = poC.params;

      const spC = buildStoreClause('sp.store_id', userStores);
      spCond = spC.clause; spParams = spC.params;

      const siC = buildStoreClause('si.store_id', userStores);
      siCond = siC.clause; siParams = siC.params;

      const bC = buildStoreClause('b.store_id', userStores);
      bCond = bC.clause; bParams = bC.params;
    }

    const [
      total_products, total_suppliers, total_orders, pending_orders,
      low_stock, out_of_stock, expiring_soon, expired,
      total_bills, paid_bills, draft_bills, cancelled_bills,
      today_bills, today_paid_bills, month_bills,
    ] = await Promise.all([
      q('SELECT COUNT(*) AS v FROM products WHERE delete_status IS NULL'),
      q('SELECT COUNT(*) AS v FROM suppliers'),
      q(`SELECT COUNT(*) AS v FROM purchase_orders po WHERE 1=1 ${poCond}`, poParams),
      q(`SELECT COUNT(*) AS v FROM purchase_orders po WHERE status='pending' ${poCond}`, poParams),
      q(`SELECT COUNT(*) AS v FROM (SELECT product_id, COUNT(*) AS total FROM stock_items_new si WHERE status='available' ${siCond} GROUP BY product_id HAVING total <= 5 AND total > 0) t`, siParams),
      q(`SELECT COUNT(*) AS v FROM products p WHERE p.delete_status IS NULL AND NOT EXISTS (SELECT 1 FROM stock_items_new si WHERE si.product_id = p.id AND si.status='available' ${siCond})`, siParams),
      q(`SELECT COUNT(*) AS v FROM stock_items_new si JOIN products p ON si.product_id = p.id WHERE si.status='available' AND si.expiry_date IS NOT NULL AND si.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND si.expiry_date >= CURDATE() ${siCond}`, siParams),
      q(`SELECT COUNT(*) AS v FROM stock_items_new si JOIN products p ON si.product_id = p.id WHERE si.status='available' AND si.expiry_date IS NOT NULL AND si.expiry_date < CURDATE() ${siCond}`, siParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE 1=1 ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE status='paid' ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE status='draft' ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE status='cancelled' ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE DATE(created_at)=CURDATE() ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE status='paid' AND DATE(created_at)=CURDATE() ${bCond}`, bParams),
      q(`SELECT COUNT(*) AS v FROM bills b WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE()) ${bCond}`, bParams),
    ]);
    return { total_products, total_suppliers, total_orders, pending_orders, low_stock, out_of_stock, expiring_soon, expired, total_bills, paid_bills, draft_bills, cancelled_bills, today_bills, today_paid_bills, month_bills };
  } finally { await conn.end().catch(() => {}); }
}

// ── section=revenue  (sums) ──────────────────────────────────────────────────
async function getRevenue(userStores, isAdmin) {
  const conn = await getConn();
  try {
    const q = async (sql, params = []) => {
      const [r] = await conn.execute(sql, params);
      return Number(r[0]?.v || 0);
    };

    let bCond = '', bParams = [];
    if (!isAdmin) {
      const bC = buildStoreClause('b.store_id', userStores);
      bCond = bC.clause; bParams = bC.params;
    }

    const [total_revenue, today_revenue, today_discount, month_revenue] = await Promise.all([
      q(`SELECT COALESCE(SUM(total_amount),0) AS v FROM bills b WHERE status='paid' ${bCond}`, bParams),
      q(`SELECT COALESCE(SUM(total_amount),0) AS v FROM bills b WHERE status='paid' AND DATE(created_at)=CURDATE() ${bCond}`, bParams),
      q(`SELECT COALESCE(SUM(discount),0) AS v FROM bills b WHERE DATE(created_at)=CURDATE() ${bCond}`, bParams),
      q(`SELECT COALESCE(SUM(total_amount),0) AS v FROM bills b WHERE status='paid' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE()) ${bCond}`, bParams),
    ]);
    return { total_revenue, today_revenue, today_discount, month_revenue };
  } finally { await conn.end().catch(() => {}); }
}

// ── section=tables  (recent bills + top products + 7days + breakdowns) ───────
async function getTables(userStores, isAdmin) {
  const conn = await getConn();
  try {
    const q = async (sql, params = []) => { const [r] = await conn.execute(sql, params); return r; };

    let bCond = '', siCond = '', bParams = [], siParams = [];
    if (!isAdmin) {
      const bC = buildStoreClause('b.store_id', userStores);
      bCond = bC.clause; bParams = bC.params;

      const siC = buildStoreClause('si.store_id', userStores);
      siCond = siC.clause; siParams = siC.params;
    }

    const recent_bills = await q(`
      SELECT b.id, b.bill_number, b.customer_name, b.total_amount, b.status, b.created_at,
             s.name AS store_name
      FROM bills b LEFT JOIN stores s ON b.store_id = s.id
      WHERE b.status = 'paid' ${bCond} ORDER BY b.created_at DESC LIMIT 6
    `, bParams);

    const top_products = await q(`
      SELECT p.name, SUM(bi.quantity) AS total_sold, SUM(bi.subtotal) AS total_revenue
      FROM bill_items bi JOIN products p ON bi.product_id = p.id JOIN bills b ON bi.bill_id = b.id
      WHERE b.status = 'paid' ${bCond} GROUP BY p.id, p.name ORDER BY total_sold DESC LIMIT 5
    `, bParams);

    const raw7 = await q(`
      SELECT DATE(created_at) AS date, COUNT(*) AS bills, COALESCE(SUM(total_amount),0) AS revenue
      FROM bills b WHERE status='paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) ${bCond}
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, bParams);

    const today_by_payment = await q(`
      SELECT payment_type, COUNT(*) AS bills, COALESCE(SUM(total_amount),0) AS revenue
      FROM bills b WHERE DATE(created_at)=CURDATE() AND status='paid' ${bCond} GROUP BY payment_type
    `, bParams);

    const today_by_store = await q(`
      SELECT s.name AS store_name, COUNT(*) AS bills, COALESCE(SUM(b.total_amount),0) AS revenue
      FROM bills b JOIN stores s ON b.store_id=s.id
      WHERE DATE(b.created_at)=CURDATE() AND b.status='paid' ${bCond}
      GROUP BY s.id, s.name ORDER BY revenue DESC
    `, bParams);

    const expiring_soon_products = await q(`
      SELECT p.id AS product_id, p.name AS product_name, s.name AS store_name,
             COUNT(*) AS units, MIN(si.expiry_date) AS earliest_expiry,
             DATEDIFF(MIN(si.expiry_date), CURDATE()) AS days_left
      FROM stock_items_new si JOIN products p ON si.product_id=p.id JOIN stores s ON si.store_id=s.id
      WHERE si.status='available' AND si.expiry_date IS NOT NULL
        AND NOT (p.product_type = 'variable_product' AND si.variation_id IS NULL)
        AND si.expiry_date >= CURDATE() AND si.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) ${siCond}
      GROUP BY p.id, p.name, s.id, s.name ORDER BY earliest_expiry ASC
    `, siParams);

    const sales_7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = raw7.find(r => new Date(r.date).toISOString().slice(0, 10) === key);
      sales_7days.push({ date: key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), bills: found ? Number(found.bills) : 0, revenue: found ? parseFloat(found.revenue) : 0 });
    }

    return { recent_bills, top_products, sales_7days, today_by_payment, today_by_store, expiring_soon_products };
  } finally { await conn.end().catch(() => {}); }
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).end();

  const isAdmin = user.role === 'admin';
  let userStores = [];
  if (!isAdmin) {
    if (user.role === 'sales') {
      // Sales: stores come from store_permissions keys
      const storePerms = await getStorePermissions(user.id);
      userStores = Object.keys(storePerms).map(Number);
    } else {
      // Manager and legacy roles: stores come from assigned_stores
      userStores = await getUserStores(user.id);
    }
  }
  const section = req.query.section || 'all';

  try {
    if (section === 'counts')  return res.status(200).json(await getCounts(userStores, isAdmin));
    if (section === 'revenue') return res.status(200).json(await getRevenue(userStores, isAdmin));
    if (section === 'tables')  return res.status(200).json(await getTables(userStores, isAdmin));

    // all — fetch sequentially
    const counts  = await getCounts(userStores, isAdmin);
    const revenue = await getRevenue(userStores, isAdmin);
    const tables  = await getTables(userStores, isAdmin);

    return res.status(200).json({
      products:  { total: counts.total_products, low_stock: counts.low_stock, out_of_stock: counts.out_of_stock, expiring_soon: counts.expiring_soon, expired: counts.expired },
      suppliers: { total: counts.total_suppliers },
      orders:    { total: counts.total_orders, pending: counts.pending_orders },
      sales: {
        total_revenue:    revenue.total_revenue,
        total_bills:      counts.total_bills,
        paid_bills:       counts.paid_bills,
        draft_bills:      counts.draft_bills,
        cancelled_bills:  counts.cancelled_bills,
        today_revenue:    revenue.today_revenue,
        today_bills:      counts.today_bills,
        today_paid_bills: counts.today_paid_bills,
        today_discount:   revenue.today_discount,
        month_revenue:    revenue.month_revenue,
        month_bills:      counts.month_bills,
      },
      ...tables,
    });
  } catch (err) {
    console.error('[dashboard/stats]', err.message);
    return res.status(500).json({ message: err.message });
  }
}
