const fs = require("fs");
const path = require("path");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
  },
  body: JSON.stringify(body),
});

const PRODUCTS = [
  { code: "HS", sku: "3555785455", name: "电动按摩器", purchase: 28, domestic: 5, firstFreight: 4.18, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "HX", sku: "3592078186", name: "电动按摩器", purchase: 37, domestic: 5, firstFreight: 6.27, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "HX", sku: "3903949202", name: "电动按摩器", purchase: 37, domestic: 5, firstFreight: 6.27, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "JBAM", sku: "3714580469", name: "电动按摩器", purchase: 35, domestic: 5, firstFreight: 29.046, lastMile: 6, rate: 11.5, platform: "Ozon" },
  { code: "PJ", sku: "3555656299", name: "电动按摩器", purchase: 50, domestic: 5, firstFreight: 27.55, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "SFZ", sku: "3555479037", name: "按摩枕", purchase: 35, domestic: 5, firstFreight: 25.3, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "TBAM", sku: "3714561826", name: "电动按摩器", purchase: 65, domestic: 5, firstFreight: 12.78, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "XFJ", sku: "3555131131", name: "电动按摩器", purchase: 60, domestic: 5, firstFreight: 22.66, lastMile: 4, rate: 11.5, platform: "Ozon" },
  { code: "JW", sku: "4526520053", name: "脚腕按摩器", purchase: 28, domestic: 5, firstFreight: 3.52, lastMile: 3.5, rate: 11.5, platform: "Ozon" },
  { code: "CDAM", sku: "4539993573", name: "床垫按摩器", purchase: 150, domestic: 5, firstFreight: 120.6, lastMile: 5, rate: 11.5, platform: "Ozon" },
  { code: "AMY", sku: "4488765265", name: "按摩椅", purchase: 950, domestic: 5, firstFreight: 1587.2, lastMile: 0, rate: 11.5, platform: "Ozon" },
  { code: "QB60-GRAY", sku: "4675959653", name: "水泵", purchase: 74.5, domestic: 12, firstFreight: 43.2, lastMile: 5, rate: 11.5, platform: "Ozon" },
  { code: "QB-60", sku: "4509788886", name: "水泵", purchase: 70.5, domestic: 12, firstFreight: 43.2, lastMile: 5, rate: 11.5, platform: "Ozon" },
  { code: "PK-750", sku: "4509718786", name: "水泵", purchase: 104.5, domestic: 12, firstFreight: 76.61, lastMile: 7, rate: 11.5, platform: "Ozon" },
  { code: "GP-130", sku: "4509770907", name: "水泵", purchase: 104.5, domestic: 12, firstFreight: 141.86, lastMile: 10, rate: 11.5, platform: "Ozon" },
].map((item, index) => ({ ...item, id: `${item.platform}-${item.sku}-${index}` }));

function dateRange(searchParams) {
  const today = new Date();
  const to = searchParams.get("dateTo") || today.toISOString().slice(0, 10);
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - 59);
  const from = searchParams.get("dateFrom") || fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function amount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function fetchOzonPostings(kind, from, to) {
  const clientId = process.env.OZON_CLIENT_ID;
  const apiKey = process.env.OZON_API_KEY;
  if (!clientId || !apiKey) return [];

  const endpoint = kind === "fbo"
    ? "https://api-seller.ozon.ru/v2/posting/fbo/list"
    : "https://api-seller.ozon.ru/v3/posting/fbs/list";

  const body = kind === "fbo"
    ? {
        dir: "ASC",
        filter: { since: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
        limit: 1000,
        offset: 0,
        with: { analytics_data: false, financial_data: true },
      }
    : {
        dir: "ASC",
        filter: { since: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
        limit: 1000,
        offset: 0,
        with: { analytics_data: false, financial_data: true },
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "client-id": clientId,
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon ${kind.toUpperCase()} API ${response.status}: ${text.slice(0, 240)}`);
  }
  const payload = await response.json();
  return payload.result?.postings || payload.result || [];
}

async function fetchOzonOrders(from, to) {
  const postings = [
    ...(await fetchOzonPostings("fbs", from, to)),
    ...(await fetchOzonPostings("fbo", from, to)),
  ];
  const rows = [];
  for (const posting of postings) {
    const date = String(posting.in_process_at || posting.created_at || posting.shipment_date || "").slice(0, 10);
    for (const product of posting.products || []) {
      const sale = amount(product.price) * amount(product.quantity || 1);
      rows.push({
        date,
        store: process.env.OZON_STORE_NAME || "Ozon 店铺",
        orderNo: posting.posting_number || posting.order_id || "",
        sku: String(product.offer_id || product.sku || product.name || ""),
        sale,
        backendPrice: sale,
        commission: amount(product.commission_amount),
        logisticsFee: amount(product.payout) ? 0 : 0,
        handlingFee: 0,
        acquiringFee: 0,
        otherFixedFee: 0,
        refundFee: 0,
        adCost: 0,
      });
    }
  }
  return rows.filter((row) => row.date);
}

async function fetchWildberriesOrders(from) {
  const token = process.env.WB_API_TOKEN;
  if (!token) return [];
  const response = await fetch(`https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${encodeURIComponent(from)}`, {
    headers: { authorization: token },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WB orders API ${response.status}: ${text.slice(0, 240)}`);
  }
  const payload = await response.json();
  return payload.map((item) => {
    const sale = amount(item.finishedPrice || item.priceWithDisc || item.totalPrice);
    return {
      date: String(item.date || item.lastChangeDate || "").slice(0, 10),
      store: process.env.WB_STORE_NAME || "WB 店铺",
      orderNo: String(item.gNumber || item.srid || item.odid || ""),
      sku: String(item.supplierArticle || item.nmId || item.barcode || ""),
      sale,
      backendPrice: sale,
      commission: 0,
      logisticsFee: 0,
      handlingFee: 0,
      acquiringFee: 0,
      otherFixedFee: 0,
      refundFee: item.isCancel ? sale : 0,
      adCost: 0,
    };
  }).filter((row) => row.date);
}

function filterRows(rows, params) {
  const store = params.get("store") || "all";
  const dateFrom = params.get("dateFrom") || "";
  const dateTo = params.get("dateTo") || "";
  return rows.filter((row) => {
    if (store !== "all" && row.store !== store) return false;
    if (dateFrom && row.date < dateFrom) return false;
    if (dateTo && row.date > dateTo) return false;
    return true;
  });
}

async function liveOrders(params) {
  const { from, to } = dateRange(params);
  const [ozon, wb] = await Promise.all([
    fetchOzonOrders(from, to),
    fetchWildberriesOrders(from),
  ]);
  return filterRows([...ozon, ...wb], params);
}

async function liveAds(params) {
  // 广告 API 暂停接入：当前账号未确认广告权限。
  // 不返回模拟广告，避免经营数据误判。
  return [];
}

function integrations() {
  const rows = [];
  if (process.env.OZON_API_KEY || process.env.OZON_CLIENT_ID) {
    rows.push({ id: "ozon-env", name: process.env.OZON_STORE_NAME || "Ozon API", platform: "Ozon", createdAt: "Netlify 环境变量" });
  }
  if (process.env.WB_API_TOKEN) {
    rows.push({ id: "wb-env", name: process.env.WB_STORE_NAME || "WB API", platform: "WB", createdAt: "Netlify 环境变量" });
  }
  return rows;
}

function debugStatus() {
  return {
    netlifyFunction: true,
    ozon: {
      clientIdConfigured: Boolean(process.env.OZON_CLIENT_ID),
      apiKeyConfigured: Boolean(process.env.OZON_API_KEY),
      storeName: process.env.OZON_STORE_NAME || "",
    },
    wb: {
      tokenConfigured: Boolean(process.env.WB_API_TOKEN),
      storeName: process.env.WB_STORE_NAME || "",
    },
    ads: {
      enabled: false,
      reason: "广告 API 暂停接入：当前未确认广告权限",
    },
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});

  const pathPart = event.path.replace(/^\/.netlify\/functions\/api\/?/, "").replace(/^\/api\/?/, "");
  const params = new URLSearchParams(event.rawQuery || "");

  try {
    if (pathPart === "health") return json(200, { ok: true, service: "netlify-ozon-wb-control-center" });
    if (pathPart === "debug") return json(200, debugStatus());
    if (pathPart === "products") return json(200, PRODUCTS);
    if (pathPart === "orders") return json(200, await liveOrders(params));
    if (pathPart === "ads/daily-products") return json(200, await liveAds(params));
    if (pathPart === "competitors") return json(200, []);
    if (pathPart === "integrations") return json(200, integrations());
    if (pathPart.startsWith("integrations/")) return json(200, { ok: true });
    return json(404, { error: "Not found", path: pathPart });
  } catch (error) {
    return json(500, { error: error.message || String(error) });
  }
};
