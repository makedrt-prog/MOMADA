const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data files exist
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const files = {
    restaurants: [],
    categories: [],
    items: [],
    tables: [],
    orders: []
  };
  for (const [name, def] of Object.entries(files)) {
    const fp = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def, null, 2));
  }
}
ensureData();

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8'));
}
function write(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}
function uid() {
  return crypto.randomUUID();
}
function now() {
  return new Date().toISOString();
}

// Seed one demo restaurant if empty
function seed() {
  const restaurants = read('restaurants');
  if (restaurants.length === 0) {
    const rid = uid();
    restaurants.push({
      id: rid,
      name: 'رستوران نمونه',
      username: 'demo',
      password: '1234',
      created_at: now()
    });
    write('restaurants', restaurants);

    const cats = [
      { id: uid(), restaurant_id: rid, name: 'پیش‌غذا', sort: 1 },
      { id: uid(), restaurant_id: rid, name: 'غذای اصلی', sort: 2 },
      { id: uid(), restaurant_id: rid, name: 'نوشیدنی', sort: 3 },
      { id: uid(), restaurant_id: rid, name: 'دسر', sort: 4 }
    ];
    write('categories', cats);

    const items = [
      { id: uid(), restaurant_id: rid, category_id: cats[0].id, name: 'سالاد فصل', price: 85000, description: 'سالاد تازه با سس مخصوص', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[0].id, name: 'سوپ جو', price: 65000, description: 'سوپ جو با سبزیجات', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[1].id, name: 'چلوکباب کوبیده', price: 280000, description: 'دو سیخ کوبیده با برنج ایرانی', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[1].id, name: 'جوجه کباب', price: 250000, description: 'جوجه زعفرانی با برنج', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[1].id, name: 'قورمه سبزی', price: 220000, description: 'قورمه سبزی اصیل ایرانی', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[2].id, name: 'دوغ', price: 35000, description: 'دوغ محلی', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[2].id, name: 'نوشابه', price: 30000, description: 'نوشابه خانواده', available: true },
      { id: uid(), restaurant_id: rid, category_id: cats[3].id, name: 'بستنی سنتی', price: 70000, description: 'بستنی زعفرانی', available: true }
    ];
    write('items', items);

    const tables = [];
    for (let i = 1; i <= 10; i++) {
      tables.push({ id: uid(), restaurant_id: rid, number: i, label: `میز ${i}` });
    }
    write('tables', tables);

    console.log('✓ دیتای نمونه ساخته شد. یوزرنیم: demo | پسورد: 1234');
  }
}
seed();

// ---------- API Handlers ----------
// All handlers: (params, body, query) => { status, data }
const api = {
  // Auth
  'POST /api/login': (params, body) => {
    const restaurants = read('restaurants');
    const r = restaurants.find(x => x.username === body.username && x.password === body.password);
    if (!r) return { status: 401, data: { error: 'نام کاربری یا رمز عبور اشتباه است' } };
    return { status: 200, data: { id: r.id, name: r.name, token: r.id } };
  },

  'POST /api/register': (params, body) => {
    const restaurants = read('restaurants');
    if (restaurants.find(x => x.username === body.username)) {
      return { status: 400, data: { error: 'این نام کاربری قبلاً ثبت شده' } };
    }
    const r = {
      id: uid(),
      name: body.name,
      username: body.username,
      password: body.password,
      created_at: now()
    };
    restaurants.push(r);
    write('restaurants', restaurants);

    const tables = read('tables');
    for (let i = 1; i <= 8; i++) {
      tables.push({ id: uid(), restaurant_id: r.id, number: i, label: `میز ${i}` });
    }
    write('tables', tables);

    return { status: 201, data: { id: r.id, name: r.name, token: r.id } };
  },

  // Categories
  'GET /api/restaurants/:id/categories': (params) => {
    const cats = read('categories').filter(c => c.restaurant_id === params.id).sort((a, b) => a.sort - b.sort);
    return { status: 200, data: cats };
  },

  'POST /api/restaurants/:id/categories': (params, body) => {
    const cats = read('categories');
    const cat = { id: uid(), restaurant_id: params.id, name: body.name, sort: body.sort || cats.length + 1 };
    cats.push(cat);
    write('categories', cats);
    return { status: 201, data: cat };
  },

  'DELETE /api/categories/:id': (params) => {
    let cats = read('categories');
    cats = cats.filter(c => c.id !== params.id);
    write('categories', cats);
    return { status: 200, data: { success: true } };
  },

  // Items
  'GET /api/restaurants/:id/items': (params) => {
    const items = read('items').filter(i => i.restaurant_id === params.id);
    return { status: 200, data: items };
  },

  'POST /api/restaurants/:id/items': (params, body) => {
    const items = read('items');
    const item = {
      id: uid(),
      restaurant_id: params.id,
      category_id: body.category_id,
      name: body.name,
      price: Number(body.price),
      description: body.description || '',
      available: true
    };
    items.push(item);
    write('items', items);
    return { status: 201, data: item };
  },

  'PUT /api/items/:id': (params, body) => {
    const items = read('items');
    const idx = items.findIndex(i => i.id === params.id);
    if (idx === -1) return { status: 404, data: { error: 'یافت نشد' } };
    items[idx] = { ...items[idx], ...body, price: body.price !== undefined ? Number(body.price) : items[idx].price };
    write('items', items);
    return { status: 200, data: items[idx] };
  },

  'DELETE /api/items/:id': (params) => {
    let items = read('items');
    items = items.filter(i => i.id !== params.id);
    write('items', items);
    return { status: 200, data: { success: true } };
  },

  // Tables
  'GET /api/restaurants/:id/tables': (params) => {
    const tables = read('tables').filter(t => t.restaurant_id === params.id).sort((a, b) => a.number - b.number);
    return { status: 200, data: tables };
  },

  // Public menu (for customer)
  'GET /api/menu/:restaurantId': (params) => {
    const restaurant = read('restaurants').find(r => r.id === params.restaurantId);
    if (!restaurant) return { status: 404, data: { error: 'رستوران یافت نشد' } };
    const categories = read('categories').filter(c => c.restaurant_id === params.restaurantId).sort((a, b) => a.sort - b.sort);
    const items = read('items').filter(i => i.restaurant_id === params.restaurantId && i.available);
    const tables = read('tables').filter(t => t.restaurant_id === params.restaurantId);
    return {
      status: 200,
      data: {
        restaurant: { id: restaurant.id, name: restaurant.name },
        categories,
        items,
        tables
      }
    };
  },

  // Orders
  'POST /api/orders': (params, body) => {
    const orders = read('orders');
    const order = {
      id: uid(),
      restaurant_id: body.restaurant_id,
      table_id: body.table_id,
      table_label: body.table_label,
      items: body.items,
      total: body.items.reduce((s, i) => s + i.price * i.qty, 0),
      status: 'جدید',
      note: body.note || '',
      created_at: now(),
      updated_at: now()
    };
    orders.unshift(order);
    write('orders', orders);
    return { status: 201, data: order };
  },

  'GET /api/restaurants/:id/orders': (params, body, query) => {
    let orders = read('orders').filter(o => o.restaurant_id === params.id);
    if (query && query.status) {
      const statuses = query.status.split(',');
      orders = orders.filter(o => statuses.includes(o.status));
    }
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { status: 200, data: orders };
  },

  'PUT /api/orders/:id/status': (params, body) => {
    const orders = read('orders');
    const idx = orders.findIndex(o => o.id === params.id);
    if (idx === -1) return { status: 404, data: { error: 'سفارش یافت نشد' } };
    orders[idx].status = body.status;
    orders[idx].updated_at = now();
    write('orders', orders);
    return { status: 200, data: orders[idx] };
  }
};

// ---------- Router ----------
function matchRoute(method, pathname) {
  for (const key of Object.keys(api)) {
    const [m, route] = key.split(' ');
    if (m !== method) continue;
    const routeParts = route.split('/');
    const pathParts = pathname.split('/');
    if (routeParts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: api[key], params };
  }
  return null;
}

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API
  if (pathname.startsWith('/api/')) {
    let body = {};
    if (['POST', 'PUT'].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'JSON نامعتبر' }));
        return;
      }
    }

    const matched = matchRoute(req.method, pathname);
    if (matched) {
      const query = Object.fromEntries(url.searchParams);
      const final = matched.handler(matched.params, body, query);
      res.writeHead(final.status || 200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(final.data));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'مسیر یافت نشد' }));
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1 style="font-family:tahoma;text-align:center;margin-top:100px">صفحه یافت نشد</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 سرور آماده است: http://localhost:${PORT}`);
  console.log(`   پنل مدیریت:  http://localhost:${PORT}/admin.html`);
  console.log(`   داشبورد آشپز: http://localhost:${PORT}/kitchen.html`);
  console.log(`   منوی مشتری:   http://localhost:${PORT}/menu.html?r=RESTAURANT_ID\n`);
});
