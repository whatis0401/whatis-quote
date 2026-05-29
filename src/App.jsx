// whatis Quote | 工程估價與報價管理系統
// 何為設計有限公司 whatis ARCH DESIGN
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";

const GAS_URL = "https://script.google.com/macros/s/AKfycbzSpPwVWdJkzvuPG6HM0fOBFJv271mEuPCF5V2AyD9iaMp5gRfV8CPDnv-HmBH7FKKOYg/exec";

// ─── 工具函式 ───────────────────────────────────────────────
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();
const fmt = (n) => {
  const num = Math.round(Number(n) || 0);
  return num.toLocaleString("zh-TW");
};
const toNum = (v) => Number(v) || 0;

function toChineseAmount(amount) {
  const units = ["", "萬", "億"];
  const digits = ["零", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
  const positions = ["", "拾", "佰", "仟"];
  if (!amount || amount === 0) return "零元整";
  const n = Math.round(amount);
  const str = String(n);
  let result = "";
  const groups = [];
  let s = str;
  while (s.length > 0) {
    groups.unshift(s.slice(-4));
    s = s.slice(0, -4);
  }
  groups.forEach((g, gi) => {
    const unit = units[groups.length - 1 - gi];
    let groupStr = "";
    for (let i = 0; i < g.length; i++) {
      const d = parseInt(g[i]);
      const pos = g.length - 1 - i;
      if (d !== 0) groupStr += digits[d] + positions[pos];
      else if (groupStr && !groupStr.endsWith("零")) groupStr += "零";
    }
    groupStr = groupStr.replace(/零+$/, "");
    if (groupStr) result += groupStr + unit;
  });
  return result + "元整";
}

// ─── GAS API ────────────────────────────────────────────────
async function sheetGet(sheetName) {
  const r = await fetch(`${GAS_URL}?sheet=${encodeURIComponent(sheetName)}`);
  return r.json();
}
async function sheetPut(sheetName, values) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ sheet: sheetName, values }),
  });
  return r.json();
}
async function gasAction(action, params) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, ...params }),
  });
  return r.json();
}

// ─── 資料轉換 ───────────────────────────────────────────────
function rowsToQuotes(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  const idx = (k) => h.indexOf(k);
  return rows.slice(1).filter(r => r[idx("id")]).map(r => ({
    id: r[idx("id")],
    name: r[idx("name")] || "",
    type: r[idx("type")] || "independent",
    status: r[idx("status")] || "draft",
    clientName: r[idx("clientName")] || "",
    projectName: r[idx("projectName")] || "",
    projectAddress: r[idx("projectAddress")] || "",
    date: r[idx("date")] || "",
    managementFeeMode: r[idx("managementFeeMode")] || "percent",
    managementFeeValue: toNum(r[idx("managementFeeValue")]),
    managementFeeBase: r[idx("managementFeeBase")] || "subtotal",
    managementFeeOverride: r[idx("managementFeeOverride")] ? toNum(r[idx("managementFeeOverride")]) : null,
    taxRate: toNum(r[idx("taxRate")]),
    roundingMode: r[idx("roundingMode")] || "none",
    roundingTarget: toNum(r[idx("roundingTarget")]),
    showChineseAmount: r[idx("showChineseAmount")] === "TRUE",
    showBankAccount: r[idx("showBankAccount")] === "TRUE",
    bankAccountId: r[idx("bankAccountId")] || "",
    termTemplateId: r[idx("termTemplateId")] || "",
    terms: r[idx("terms")] || "",
    internalNote: r[idx("internalNote")] || "",
    showManagementFeeInClient: r[idx("showManagementFeeInClient")] !== "FALSE",
    createdAt: r[idx("createdAt")] || "",
    updatedAt: r[idx("updatedAt")] || "",
  }));
}

function quotesToRows(quotes) {
  const h = [
    "id","name","type","status","clientName","projectName","projectAddress","date",
    "managementFeeMode","managementFeeValue","managementFeeBase","managementFeeOverride",
    "taxRate","roundingMode","roundingTarget","showChineseAmount","showBankAccount",
    "bankAccountId","termTemplateId","terms","internalNote","showManagementFeeInClient",
    "createdAt","updatedAt"
  ];
  return [h, ...quotes.map(q => [
    q.id, q.name, q.type, q.status, q.clientName, q.projectName, q.projectAddress, q.date,
    q.managementFeeMode, q.managementFeeValue, q.managementFeeBase,
    q.managementFeeOverride ?? "",
    q.taxRate, q.roundingMode, q.roundingTarget,
    q.showChineseAmount ? "TRUE" : "FALSE",
    q.showBankAccount ? "TRUE" : "FALSE",
    q.bankAccountId, q.termTemplateId, q.terms, q.internalNote,
    q.showManagementFeeInClient ? "TRUE" : "FALSE",
    q.createdAt, q.updatedAt,
  ])];
}

function rowsToItems(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  const idx = (k) => h.indexOf(k);
  return rows.slice(1).filter(r => r[idx("id")]).map(r => ({
    id: r[idx("id")],
    quoteId: r[idx("quoteId")],
    group: r[idx("group")] || "",
    category: r[idx("category")] || "",
    position: r[idx("position")] || "",
    itemName: r[idx("itemName")] || "",
    unit: r[idx("unit")] || "式",
    qty: toNum(r[idx("qty")]) || 1,
    cost: toNum(r[idx("cost")]),
    multiplier: toNum(r[idx("multiplier")]) || 1,
    price: toNum(r[idx("price")]),
    priceOverride: r[idx("priceOverride")] === "TRUE",
    total: toNum(r[idx("total")]),
    note: r[idx("note")] || "",
    sortOrder: toNum(r[idx("sortOrder")]),
    updatedAt: r[idx("updatedAt")] || "",
  }));
}

function itemsToRows(items) {
  const h = [
    "id","quoteId","group","category","position","itemName","unit","qty",
    "cost","multiplier","price","priceOverride","total","note","sortOrder","updatedAt"
  ];
  return [h, ...items.map(it => [
    it.id, it.quoteId, it.group, it.category, it.position,
    it.itemName, it.unit, it.qty, it.cost, it.multiplier,
    it.price, it.priceOverride ? "TRUE" : "FALSE",
    it.total, it.note, it.sortOrder, it.updatedAt,
  ])];
}

function rowsToTemplates(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  const idx = (k) => h.indexOf(k);
  return rows.slice(1).filter(r => r[idx("id")]).map(r => ({
    id: r[idx("id")],
    name: r[idx("name")] || "",
    type: r[idx("type")] || "independent",
    items: (() => { try { return JSON.parse(r[idx("items")]); } catch { return []; } })(),
    createdAt: r[idx("createdAt")] || "",
  }));
}

function templatesToRows(templates) {
  const h = ["id","name","type","items","createdAt"];
  return [h, ...templates.map(t => [t.id, t.name, t.type, JSON.stringify(t.items || []), t.createdAt])];
}

function rowsToSettings(rows) {
  if (!rows || rows.length < 2) return {};
  const obj = {};
  rows.slice(1).forEach(r => { if (r[0]) obj[r[0]] = r[1]; });
  return obj;
}

function settingsToRows(settings) {
  return [["key","value"], ...Object.entries(settings)];
}

// ─── 計算邏輯 ───────────────────────────────────────────────
function calcItem(item) {
  const cost = toNum(item.cost);
  const multiplier = toNum(item.multiplier) || 1;
  const qty = toNum(item.qty) || 1;
  const price = item.priceOverride ? toNum(item.price) : Math.round(cost * multiplier);
  const total = Math.round(price * qty);
  const margin = cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  return { ...item, price, total, margin };
}

function calcQuoteSummary(items, quote) {
  const subtotal = items.reduce((s, it) => s + toNum(it.total), 0);

  let managementFeeRaw = 0;
  if (quote.managementFeeMode === "percent") {
    managementFeeRaw = Math.round(subtotal * (toNum(quote.managementFeeValue) / 100));
  } else if (quote.managementFeeMode === "fixed") {
    managementFeeRaw = toNum(quote.managementFeeValue);
  }
  const managementFee = quote.managementFeeOverride !== null && quote.managementFeeOverride !== undefined
    ? toNum(quote.managementFeeOverride)
    : managementFeeRaw;

  const beforeTax = subtotal + managementFee;

  // 整價邏輯
  let roundedBeforeTax = beforeTax;
  let roundingDiscount = 0;
  if (quote.roundingMode === "pretax" && quote.roundingTarget > 0) {
    roundedBeforeTax = toNum(quote.roundingTarget);
    roundingDiscount = beforeTax - roundedBeforeTax;
  }

  const taxAmount = Math.round(roundedBeforeTax * (toNum(quote.taxRate) / 100));
  let total = roundedBeforeTax + taxAmount;

  if (quote.roundingMode === "total" && quote.roundingTarget > 0) {
    total = toNum(quote.roundingTarget);
  }

  return {
    subtotal,
    managementFeeRaw,
    managementFee,
    managementFeeDiscount: managementFeeRaw - managementFee,
    beforeTax,
    roundedBeforeTax,
    roundingDiscount,
    taxAmount,
    total,
  };
}

// ─── 狀態標籤 ───────────────────────────────────────────────
const STATUS_LABELS = {
  draft: "草稿",
  quoted: "已報價",
  confirmed: "已確認",
  addendum: "追加減帳中",
  closed: "已結案",
};
const STATUS_COLORS = {
  draft: "#bbbbbb",
  quoted: "#6a96b0",
  confirmed: "#6aaa8a",
  addendum: "#c9a84c",
  closed: "#888888",
};
const TYPE_LABELS = {
  independent: "獨立品項",
  integrated: "整合式工程",
  template: "快速模板",
  addendum: "追加減帳",
};

// ─── 樣式常數 ───────────────────────────────────────────────
const S = {
  page: {
    fontFamily: '"微軟正黑體","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif',
    background: "#f7f7f5",
    minHeight: "100vh",
    color: "#333",
    fontSize: 14,
  },
  sidebar: {
    width: 220,
    background: "#fff",
    borderRight: "1px solid #e8e8e8",
    minHeight: "100vh",
    padding: "32px 0",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  main: {
    marginLeft: 220,
    padding: "40px 48px",
    maxWidth: 1200,
  },
  btn: {
    background: "#333",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  btnSecondary: {
    background: "transparent",
    color: "#333",
    border: "1px solid #e0e0e0",
    borderRadius: 4,
    padding: "7px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  btnDanger: {
    background: "transparent",
    color: "#c0675a",
    border: "1px solid #e8d0cc",
    borderRadius: 4,
    padding: "7px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  input: {
    border: "1px solid #e0e0e0",
    borderRadius: 4,
    padding: "8px 12px",
    fontSize: 14,
    color: "#333",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    border: "1px solid #e0e0e0",
    borderRadius: 4,
    padding: "8px 10px",
    fontSize: 14,
    color: "#333",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  card: {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
    padding: "24px 28px",
  },
  label: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
    display: "block",
    fontWeight: 500,
  },
};

// ─── 主元件 ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("list"); // list | edit | settings | templates
  const [quotes, setQuotes] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editQuoteId, setEditQuoteId] = useState(null);
  const [notification, setNotification] = useState(null);

  const latestState = useRef({ quotes, allItems, templates, settings });
  useEffect(() => {
    latestState.current = { quotes, allItems, templates, settings };
  }, [quotes, allItems, templates, settings]);

  const saveTimer = useRef(null);

  // 讀取全部資料
  useEffect(() => {
    async function loadAll() {
      try {
        const [qRows, iRows, tRows, sRows] = await Promise.all([
          sheetGet("Quotes"),
          sheetGet("QuoteItems"),
          sheetGet("Templates"),
          sheetGet("Settings"),
        ]);
        setQuotes(rowsToQuotes(qRows));
        setAllItems(rowsToItems(iRows));
        setTemplates(rowsToTemplates(tRows));
        const s = rowsToSettings(sRows);
        ["bank_accounts","engineering_groups","engineering_categories","term_templates"].forEach(k => {
          if (s[k]) try { s[k] = JSON.parse(s[k]); } catch { s[k] = []; }
        });
        setSettings(s);
      } catch (e) {
        setNotification({ msg: "載入失敗：" + e.message, type: "error" });
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // 儲存
  const scheduleSave = useCallback((newQuotes, newItems, newSettings) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const { quotes: q, allItems: ai, settings: s } = latestState.current;
        const saveQ = newQuotes ?? q;
        const saveI = newItems ?? ai;
        const saveS = newSettings ?? s;

        // 設定要序列化 JSON 欄位
        const serialSettings = { ...saveS };
        ["bank_accounts","engineering_groups","engineering_categories","term_templates"].forEach(k => {
          if (Array.isArray(serialSettings[k])) {
            serialSettings[k] = JSON.stringify(serialSettings[k]);
          }
        });

        const ops = [sheetPut("Quotes", quotesToRows(saveQ))];
        if (newItems !== undefined) ops.push(sheetPut("QuoteItems", itemsToRows(saveI)));
        if (newSettings !== undefined) ops.push(sheetPut("Settings", settingsToRows(serialSettings)));

        await Promise.all(ops);
        showNotif("已儲存", "success");
      } catch (e) {
        showNotif("儲存失敗：" + e.message, "error");
      } finally {
        setSaving(false);
        saveTimer.current = null;
      }
    }, 800);
  }, []);

  function showNotif(msg, type = "info") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  function updateQuotes(next, items) {
    setQuotes(next);
    scheduleSave(next, items);
  }

  function goEdit(id) {
    setEditQuoteId(id);
    setPage("edit");
  }

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888", fontSize: 15 }}>載入中…</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* 側欄 */}
      <Sidebar page={page} setPage={setPage} />

      {/* 主內容 */}
      <div style={S.main}>
        {page === "list" && (
          <QuoteList
            quotes={quotes}
            allItems={allItems}
            settings={settings}
            onEdit={goEdit}
            onNew={(type) => {
              const id = genId();
              const newQ = {
                id,
                name: "新報價單",
                type,
                status: "draft",
                clientName: "",
                projectName: "",
                projectAddress: "",
                date: new Date().toISOString().slice(0, 10),
                managementFeeMode: "percent",
                managementFeeValue: 10,
                managementFeeBase: "subtotal",
                managementFeeOverride: null,
                taxRate: 5,
                roundingMode: "none",
                roundingTarget: 0,
                showChineseAmount: false,
                showBankAccount: true,
                bankAccountId: (settings.bank_accounts || [])[0]?.id || "",
                termTemplateId: type === "independent" ? "t2" : "t1",
                terms: "",
                internalNote: "",
                showManagementFeeInClient: true,
                createdAt: now(),
                updatedAt: now(),
              };
              const next = [...quotes, newQ];
              updateQuotes(next);
              goEdit(id);
            }}
            onDelete={async (id) => {
              if (!confirm("確定要刪除這張報價單？此操作無法復原。")) return;
              setSaving(true);
              try {
                await gasAction("deleteQuote", { quoteId: id });
                const nextQ = quotes.filter(q => q.id !== id);
                const nextI = allItems.filter(it => it.quoteId !== id);
                setQuotes(nextQ);
                setAllItems(nextI);
                showNotif("已刪除", "success");
              } catch (e) {
                showNotif("刪除失敗", "error");
              } finally {
                setSaving(false);
              }
            }}
            onStatusChange={(id, status) => {
              const next = quotes.map(q => q.id === id ? { ...q, status, updatedAt: now() } : q);
              updateQuotes(next);
            }}
          />
        )}
        {page === "edit" && editQuoteId && (
          <QuoteEditor
            quote={quotes.find(q => q.id === editQuoteId)}
            items={allItems.filter(it => it.quoteId === editQuoteId)}
            allItems={allItems}
            settings={settings}
            templates={templates}
            onBack={() => setPage("list")}
            onUpdateQuote={(updatedQ) => {
              const next = quotes.map(q => q.id === updatedQ.id ? updatedQ : q);
              updateQuotes(next);
            }}
            onUpdateItems={(updatedItems) => {
              const others = allItems.filter(it => it.quoteId !== editQuoteId);
              const next = [...others, ...updatedItems];
              setAllItems(next);
              scheduleSave(undefined, next);
            }}
          />
        )}
        {page === "settings" && (
          <SettingsPage
            settings={settings}
            onSave={(newS) => {
              setSettings(newS);
              scheduleSave(undefined, undefined, newS);
              showNotif("設定已儲存");
            }}
          />
        )}
        {page === "templates" && (
          <TemplatesPage
            templates={templates}
            settings={settings}
            onSave={(newT) => {
              setTemplates(newT);
              const rows = templatesToRows(newT);
              sheetPut("Templates", rows).then(() => showNotif("模板已儲存"));
            }}
          />
        )}
      </div>

      {/* 通知 */}
      {notification && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: notification.type === "error" ? "#c0675a" : notification.type === "success" ? "#6aaa8a" : "#555",
          color: "#fff", padding: "10px 20px", borderRadius: 4,
          fontSize: 13, zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          {saving && "儲存中… "}{notification.msg}
        </div>
      )}
    </div>
  );
}

// ─── 側欄 ───────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const navItems = [
    { id: "list", label: "報價單列表" },
    { id: "templates", label: "工程模板" },
    { id: "settings", label: "系統設定" },
  ];
  return (
    <div style={S.sidebar}>
      {/* LOGO */}
      <div style={{ padding: "0 24px 32px" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", marginBottom: 2 }}>WHATIS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#333", letterSpacing: 1 }}>ARCH DESIGN</div>
        <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>報價管理系統</div>
      </div>
      <div style={{ borderTop: "1px solid #eee", marginBottom: 16 }} />
      {navItems.map(n => (
        <button
          key={n.id}
          onClick={() => setPage(n.id)}
          style={{
            background: page === n.id ? "#f5f5f5" : "transparent",
            border: "none",
            borderLeft: page === n.id ? "3px solid #333" : "3px solid transparent",
            padding: "11px 24px",
            textAlign: "left",
            fontSize: 13,
            color: page === n.id ? "#333" : "#888",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: page === n.id ? 600 : 400,
            width: "100%",
            transition: "all 0.15s",
          }}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

// ─── 報價單列表 ─────────────────────────────────────────────
function QuoteList({ quotes, allItems, settings, onEdit, onNew, onDelete, onStatusChange }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showNewMenu, setShowNewMenu] = useState(false);

  const filtered = quotes.filter(q => {
    const matchSearch = !search ||
      q.name.includes(search) || q.clientName.includes(search) || q.projectName.includes(search);
    const matchStatus = filterStatus === "all" || q.status === filterStatus;
    const matchType = filterType === "all" || q.type === filterType;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div>
      {/* 標題列 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>報價單列表</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>共 {quotes.length} 張</div>
        </div>
        <div style={{ position: "relative" }}>
          <button style={S.btn} onClick={() => setShowNewMenu(!showNewMenu)}>
            ＋ 新增報價單
          </button>
          {showNewMenu && (
            <div style={{
              position: "absolute", right: 0, top: 40,
              background: "#fff", border: "1px solid #e0e0e0",
              borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              zIndex: 100, minWidth: 180, overflow: "hidden",
            }}>
              {[
                { type: "independent", label: "獨立品項報價" },
                { type: "integrated", label: "整合式工程報價" },
                { type: "template", label: "從模板新增" },
                { type: "addendum", label: "追加減帳報價" },
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { setShowNewMenu(false); onNew(opt.type); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "11px 16px", border: "none", background: "transparent",
                    fontSize: 13, color: "#333", cursor: "pointer",
                    fontFamily: "inherit",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                  onMouseEnter={e => e.target.style.background = "#f5f5f5"}
                  onMouseLeave={e => e.target.style.background = "transparent"}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          style={{ ...S.input, width: 260 }}
          placeholder="搜尋報價單名稱、客戶、專案…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">所有狀態</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select style={S.select} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">所有類型</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "48px", color: "#bbb" }}>
          尚無報價單，點擊右上角「新增報價單」開始
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* 表頭 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 80px",
            padding: "8px 20px",
            fontSize: 11,
            color: "#aaa",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}>
            <div>報價單名稱</div>
            <div>客戶</div>
            <div>日期</div>
            <div>金額（含稅）</div>
            <div>類型</div>
            <div>狀態</div>
            <div></div>
          </div>
          {filtered.map(q => {
            const items = allItems.filter(it => it.quoteId === q.id).map(calcItem);
            const summary = calcQuoteSummary(items, q);
            return (
              <div
                key={q.id}
                style={{
                  ...S.card,
                  padding: "16px 20px",
                  borderRadius: 4,
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 80px",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#ccc"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#e8e8e8"}
                onClick={() => onEdit(q.id)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{q.name}</div>
                  {q.projectName && <div style={{ fontSize: 12, color: "#888" }}>{q.projectName}</div>}
                </div>
                <div style={{ fontSize: 13, color: "#555" }}>{q.clientName || "—"}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{q.date || "—"}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
                  {summary.total > 0 ? `$${fmt(summary.total)}` : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{TYPE_LABELS[q.type]}</div>
                <div>
                  <select
                    value={q.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onStatusChange(q.id, e.target.value); }}
                    style={{
                      ...S.select,
                      fontSize: 12,
                      padding: "4px 8px",
                      color: STATUS_COLORS[q.status],
                      fontWeight: 600,
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    style={{ ...S.btnDanger, padding: "4px 10px", fontSize: 12 }}
                    onClick={e => { e.stopPropagation(); onDelete(q.id); }}
                  >刪除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 報價單編輯頁 ───────────────────────────────────────────
function QuoteEditor({ quote, items, allItems, settings, templates, onBack, onUpdateQuote, onUpdateItems }) {
  const [q, setQ] = useState(quote);
  const [its, setIts] = useState(items);
  const [printMode, setPrintMode] = useState(null); // null | "client" | "internal"
  const [activeSection, setActiveSection] = useState("info"); // info | items | fees | output

  useEffect(() => { setQ(quote); }, [quote]);
  useEffect(() => { setIts(items); }, [items]);

  function updateQ(patch) {
    const next = { ...q, ...patch, updatedAt: now() };
    setQ(next);
    onUpdateQuote(next);
  }

  function updateIts(next) {
    setIts(next);
    onUpdateItems(next);
  }

  const calcedItems = its.map(calcItem);
  const summary = calcQuoteSummary(calcedItems, q);

  // 從模板套用品項
  function applyTemplate(templateId) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    const newItems = tmpl.items.map((ti, i) => ({
      id: genId(),
      quoteId: q.id,
      group: ti.group || "",
      category: ti.category || "",
      position: ti.position || "",
      itemName: ti.itemName || "",
      unit: ti.unit || "式",
      qty: ti.qty || 1,
      cost: ti.cost || 0,
      multiplier: ti.multiplier || 1,
      price: 0,
      priceOverride: false,
      total: 0,
      note: ti.note || "",
      sortOrder: i,
      updatedAt: now(),
    }));
    updateIts([...its, ...newItems]);
  }

  if (printMode) {
    return (
      <PrintView
        quote={q}
        items={calcedItems}
        summary={summary}
        settings={settings}
        mode={printMode}
        onClose={() => setPrintMode(null)}
      />
    );
  }

  const bankAccounts = settings.bank_accounts || [];
  const termTemplates = settings.term_templates || [];
  const selectedBank = bankAccounts.find(b => b.id === q.bankAccountId);

  const tabs = [
    { id: "info", label: "基本資料" },
    { id: "items", label: "品項明細" },
    { id: "fees", label: "費用設定" },
    { id: "output", label: "輸出設定" },
  ];

  return (
    <div>
      {/* 頂部工具列 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={S.btnSecondary} onClick={onBack}>← 返回列表</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{q.name || "（未命名）"}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{TYPE_LABELS[q.type]} · {STATUS_LABELS[q.status]}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnSecondary} onClick={() => setPrintMode("internal")}>內部版預覽</button>
          <button style={S.btn} onClick={() => setPrintMode("client")}>客戶版列印</button>
        </div>
      </div>

      {/* 分頁 Tab */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #eee" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSection(t.id)}
            style={{
              background: "none", border: "none", borderBottom: activeSection === t.id ? "2px solid #333" : "2px solid transparent",
              padding: "10px 20px", fontSize: 13, cursor: "pointer",
              color: activeSection === t.id ? "#333" : "#888",
              fontWeight: activeSection === t.id ? 600 : 400,
              fontFamily: "inherit", marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
        {/* 即時總計 */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, paddingBottom: 8 }}>
          <span style={{ fontSize: 12, color: "#888" }}>含稅總計</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>${fmt(summary.total)}</span>
        </div>
      </div>

      {/* 基本資料 */}
      {activeSection === "info" && (
        <div style={{ ...S.card, maxWidth: 720 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 28px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>報價單名稱</label>
              <input style={S.input} value={q.name} onChange={e => updateQ({ name: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>客戶姓名 / 公司</label>
              <input style={S.input} value={q.clientName} onChange={e => updateQ({ clientName: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>日期</label>
              <input style={{ ...S.input }} type="date" value={q.date} onChange={e => updateQ({ date: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>專案名稱</label>
              <input style={S.input} value={q.projectName} onChange={e => updateQ({ projectName: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>工程地址</label>
              <input style={S.input} value={q.projectAddress} onChange={e => updateQ({ projectAddress: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>報價類型</label>
              <select style={{ ...S.select, width: "100%" }} value={q.type} onChange={e => updateQ({ type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>狀態</label>
              <select style={{ ...S.select, width: "100%" }} value={q.status} onChange={e => updateQ({ status: e.target.value })}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>內部備註（不顯示於客戶版）</label>
              <textarea
                style={{ ...S.input, height: 80, resize: "vertical" }}
                value={q.internalNote}
                onChange={e => updateQ({ internalNote: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* 品項明細 */}
      {activeSection === "items" && (
        <ItemsEditor
          quote={q}
          items={its}
          settings={settings}
          templates={templates}
          onChange={updateIts}
          onApplyTemplate={applyTemplate}
        />
      )}

      {/* 費用設定 */}
      {activeSection === "fees" && (
        <div style={{ ...S.card, maxWidth: 600 }}>
          <h3 style={{ margin: "0 0 24px", fontSize: 15, fontWeight: 600 }}>費用設定</h3>

          {/* 工程管理費 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>工程管理費</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              <div>
                <label style={S.label}>計算方式</label>
                <select style={{ ...S.select, width: "100%" }} value={q.managementFeeMode} onChange={e => updateQ({ managementFeeMode: e.target.value, managementFeeOverride: null })}>
                  <option value="percent">百分比</option>
                  <option value="fixed">固定金額</option>
                  <option value="none">不收取</option>
                </select>
              </div>
              {q.managementFeeMode !== "none" && (
                <div>
                  <label style={S.label}>{q.managementFeeMode === "percent" ? "百分比 (%)" : "金額"}</label>
                  <input
                    style={S.input} type="number"
                    value={q.managementFeeValue}
                    onChange={e => updateQ({ managementFeeValue: toNum(e.target.value), managementFeeOverride: null })}
                  />
                </div>
              )}
              {q.managementFeeMode !== "none" && (
                <>
                  <div>
                    <label style={S.label}>計算後金額</label>
                    <div style={{ padding: "8px 12px", fontSize: 14, color: "#333" }}>
                      ${fmt(summary.managementFeeRaw)}
                      {q.managementFeeMode === "percent" && <span style={{ fontSize: 11, color: "#aaa" }}> ({q.managementFeeValue}%)</span>}
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>整價後金額（留空則不整價）</label>
                    <input
                      style={S.input}
                      type="number"
                      placeholder={fmt(summary.managementFeeRaw)}
                      value={q.managementFeeOverride ?? ""}
                      onChange={e => updateQ({ managementFeeOverride: e.target.value === "" ? null : toNum(e.target.value) })}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={q.showManagementFeeInClient} onChange={e => updateQ({ showManagementFeeInClient: e.target.checked })} />
                      <span style={{ fontSize: 13, color: "#555" }}>在客戶版顯示工程管理費</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 稅率 */}
          <div style={{ marginBottom: 28, borderTop: "1px solid #f0f0f0", paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>稅率</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" name="tax" checked={q.taxRate === 5} onChange={() => updateQ({ taxRate: 5 })} />含稅 5%
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" name="tax" checked={q.taxRate === 0} onChange={() => updateQ({ taxRate: 0 })} />未稅 (0%)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" name="tax" checked={q.taxRate !== 5 && q.taxRate !== 0} onChange={() => updateQ({ taxRate: 3 })} />自訂
              </label>
              {q.taxRate !== 5 && q.taxRate !== 0 && (
                <input style={{ ...S.input, width: 80 }} type="number" value={q.taxRate} onChange={e => updateQ({ taxRate: toNum(e.target.value) })} />
              )}
            </div>
          </div>

          {/* 整價 */}
          <div style={{ marginBottom: 24, borderTop: "1px solid #f0f0f0", paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>整價（未稅合計）</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              <div>
                <label style={S.label}>整價模式</label>
                <select style={{ ...S.select, width: "100%" }} value={q.roundingMode} onChange={e => updateQ({ roundingMode: e.target.value, roundingTarget: 0 })}>
                  <option value="none">不整價</option>
                  <option value="pretax">未稅整價</option>
                  <option value="total">含稅整價</option>
                </select>
              </div>
              {q.roundingMode !== "none" && (
                <div>
                  <label style={S.label}>整價金額</label>
                  <input style={S.input} type="number" value={q.roundingTarget || ""} onChange={e => updateQ({ roundingTarget: toNum(e.target.value) })} />
                </div>
              )}
            </div>
          </div>

          {/* 小計預覽 */}
          <div style={{ background: "#f9f9f9", borderRadius: 4, padding: "16px 20px", fontSize: 13 }}>
            <SummaryPreview summary={summary} quote={q} />
          </div>
        </div>
      )}

      {/* 輸出設定 */}
      {activeSection === "output" && (
        <div style={{ ...S.card, maxWidth: 600 }}>
          <h3 style={{ margin: "0 0 24px", fontSize: 15, fontWeight: 600 }}>輸出設定</h3>

          {/* 備註條款 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>備註條款</div>
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>套用模板</label>
              <select
                style={{ ...S.select, width: "100%" }}
                value={q.termTemplateId}
                onChange={e => {
                  const tmpl = termTemplates.find(t => t.id === e.target.value);
                  updateQ({ termTemplateId: e.target.value, terms: tmpl ? tmpl.content : q.terms });
                }}
              >
                <option value="">自訂</option>
                {termTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <textarea
              style={{ ...S.input, height: 140, resize: "vertical" }}
              value={q.terms}
              onChange={e => updateQ({ terms: e.target.value, termTemplateId: "" })}
              placeholder="輸入備註條款…"
            />
          </div>

          {/* 匯款帳戶 */}
          <div style={{ marginBottom: 24, borderTop: "1px solid #f0f0f0", paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>匯款帳戶</div>
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>選擇帳戶</label>
              <select style={{ ...S.select, width: "100%" }} value={q.bankAccountId} onChange={e => updateQ({ bankAccountId: e.target.value })}>
                <option value="">不顯示</option>
                {(settings.bank_accounts || []).map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={q.showBankAccount} onChange={e => updateQ({ showBankAccount: e.target.checked })} />
              <span style={{ fontSize: 13, color: "#555" }}>在列印版顯示匯款帳戶</span>
            </label>
          </div>

          {/* 其他顯示選項 */}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>其他顯示選項</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={q.showChineseAmount} onChange={e => updateQ({ showChineseAmount: e.target.checked })} />
              <span style={{ fontSize: 13, color: "#555" }}>顯示中文大寫金額</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 品項摘要預覽 ────────────────────────────────────────────
function SummaryPreview({ summary, quote }) {
  const rows = [
    ["工程項目合計", summary.subtotal],
  ];
  if (quote.managementFeeMode !== "none") {
    if (summary.managementFeeDiscount !== 0) {
      rows.push([`工程管理費 (${quote.managementFeeValue}%)`, summary.managementFeeRaw]);
      rows.push(["整價優惠", -summary.managementFeeDiscount]);
    } else {
      rows.push([`工程管理費 (${quote.managementFeeMode === "percent" ? quote.managementFeeValue + "%" : "固定"})`, summary.managementFee]);
    }
  }
  rows.push(["未稅合計", summary.beforeTax]);
  if (summary.roundingDiscount !== 0) {
    rows.push(["整價調整", -summary.roundingDiscount]);
    rows.push(["整價後未稅", summary.roundedBeforeTax]);
  }
  if (quote.taxRate > 0) rows.push([`稅金 (${quote.taxRate}%)`, summary.taxAmount]);
  rows.push(["含稅總計", summary.total]);

  return (
    <div>
      {rows.map(([label, val], i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between",
          padding: "5px 0",
          borderTop: (label === "含稅總計") ? "1px solid #ddd" : "none",
          fontWeight: label === "含稅總計" ? 700 : 400,
          fontSize: label === "含稅總計" ? 15 : 13,
          color: label === "含稅總計" ? "#333" : "#555",
          marginTop: label === "含稅總計" ? 4 : 0,
        }}>
          <span>{label}</span>
          <span style={{ color: val < 0 ? "#c0675a" : "inherit" }}>
            {val < 0 ? `-$${fmt(-val)}` : `$${fmt(val)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 品項編輯器 ─────────────────────────────────────────────
function ItemsEditor({ quote, items, settings, templates, onChange, onApplyTemplate }) {
  const isIntegrated = quote.type === "integrated";
  const groups = settings.engineering_groups || [];
  const categories = settings.engineering_categories || [];

  function addItem(group, category) {
    const newItem = {
      id: genId(),
      quoteId: quote.id,
      group: group || "",
      category: category || "",
      position: "",
      itemName: "",
      unit: "式",
      qty: 1,
      cost: 0,
      multiplier: 1,
      price: 0,
      priceOverride: false,
      total: 0,
      note: "",
      sortOrder: items.length,
      updatedAt: now(),
    };
    onChange([...items, newItem]);
  }

  function updateItem(id, patch) {
    onChange(items.map(it => it.id === id ? { ...it, ...patch, updatedAt: now() } : it));
  }

  function removeItem(id) {
    onChange(items.filter(it => it.id !== id));
  }

  function moveItem(id, dir) {
    const idx = items.findIndex(it => it.id === id);
    if (idx < 0) return;
    const next = [...items];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next.map((it, i) => ({ ...it, sortOrder: i })));
  }

  // 獨立品項：直接顯示列表
  if (!isIntegrated) {
    const showPosition = true;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "#888" }}>共 {items.length} 個品項</div>
          <div style={{ display: "flex", gap: 10 }}>
            {templates.filter(t => t.type === "independent").length > 0 && (
              <select
                style={S.select}
                defaultValue=""
                onChange={e => { if (e.target.value) { onApplyTemplate(e.target.value); e.target.value = ""; } }}
              >
                <option value="">套用模板</option>
                {templates.filter(t => t.type === "independent").map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <button style={S.btn} onClick={() => addItem("", "")}>＋ 新增品項</button>
          </div>
        </div>
        <ItemTable
          items={items.map(calcItem)}
          showPosition={showPosition}
          showGroupCategory={false}
          onUpdate={updateItem}
          onRemove={removeItem}
          onMove={moveItem}
        />
      </div>
    );
  }

  // 整合式：按群組/大項分層
  const activeCategories = categories.filter(c => c.active !== false);
  const itemsByCategory = {};
  items.forEach(it => {
    const key = `${it.group}||${it.category}`;
    if (!itemsByCategory[key]) itemsByCategory[key] = [];
    itemsByCategory[key].push(it);
  });

  // 找出有品項的群組
  const usedGroups = new Set(items.map(it => it.group));
  const usedCategories = new Set(items.map(it => `${it.group}||${it.category}`));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#888" }}>共 {items.length} 個品項</div>
        {templates.filter(t => t.type === "integrated").length > 0 && (
          <select
            style={S.select}
            defaultValue=""
            onChange={e => { if (e.target.value) { onApplyTemplate(e.target.value); e.target.value = ""; } }}
          >
            <option value="">套用模板</option>
            {templates.filter(t => t.type === "integrated").map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {groups.map(g => {
        const gCats = activeCategories.filter(c => c.groupId === g.id);
        const gItems = items.filter(it => it.group === g.id);
        const gTotal = gItems.map(calcItem).reduce((s, it) => s + it.total, 0);

        return (
          <div key={g.id} style={{ marginBottom: 32 }}>
            {/* 群組標題 */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 16px",
              background: "#f0f0ee",
              borderRadius: 4,
              marginBottom: 12,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>{g.name}</div>
              <div style={{ fontSize: 13, color: "#555" }}>小計 ${fmt(gTotal)}</div>
            </div>

            {gCats.map(cat => {
              const key = `${g.id}||${cat.id}`;
              const catItems = (itemsByCategory[key] || []).map(calcItem);
              const catTotal = catItems.reduce((s, it) => s + it.total, 0);

              return (
                <div key={cat.id} style={{ marginBottom: 20, marginLeft: 12 }}>
                  {/* 大項標題 */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 12px",
                    borderLeft: "3px solid #ddd",
                    marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#444" }}>{cat.name}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {catItems.length > 0 && <span style={{ fontSize: 12, color: "#888" }}>${fmt(catTotal)}</span>}
                      <button
                        style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => addItem(g.id, cat.id)}
                      >＋ 新增</button>
                    </div>
                  </div>

                  {catItems.length > 0 && (
                    <ItemTable
                      items={catItems}
                      showPosition={false}
                      showGroupCategory={false}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      onMove={moveItem}
                    />
                  )}
                </div>
              );
            })}

            {/* 不在預設大項的品項（群組下直接新增） */}
            {gItems.filter(it => !gCats.find(c => c.id === it.category)).length > 0 && (
              <ItemTable
                items={gItems.filter(it => !gCats.find(c => c.id === it.category)).map(calcItem)}
                showPosition={false}
                showGroupCategory={false}
                onUpdate={updateItem}
                onRemove={removeItem}
                onMove={moveItem}
              />
            )}
          </div>
        );
      })}

      {/* 不在任何群組的品項 */}
      {items.filter(it => !groups.find(g => g.id === it.group)).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ padding: "10px 16px", background: "#f5f5f5", marginBottom: 12, fontWeight: 600, fontSize: 13 }}>其他品項</div>
          <ItemTable
            items={items.filter(it => !groups.find(g => g.id === it.group)).map(calcItem)}
            showPosition={false}
            showGroupCategory={false}
            onUpdate={updateItem}
            onRemove={removeItem}
            onMove={moveItem}
          />
        </div>
      )}

      {/* 在此群組外新增 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {groups.map(g => (
          <button key={g.id} style={S.btnSecondary} onClick={() => addItem(g.id, "")}>
            ＋ {g.name}
          </button>
        ))}
        <button style={S.btnSecondary} onClick={() => addItem("", "")}>＋ 其他品項</button>
      </div>
    </div>
  );
}

// ─── 品項表格 ───────────────────────────────────────────────
function ItemTable({ items, showPosition, showGroupCategory, onUpdate, onRemove, onMove }) {
  const colWidths = showPosition
    ? "60px 60px 1fr 60px 80px 90px 90px 90px 90px 80px 50px"
    : "60px 1fr 60px 80px 90px 90px 90px 90px 80px 50px";

  const headers = [
    ...(showPosition ? ["位置"] : []),
    "項次", "工程細項", "單位", "數量", "成本", "倍率", "單價", "金額", "備註", "",
  ];

  return (
    <div style={{ fontSize: 13 }}>
      {/* 表頭 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: colWidths,
        padding: "6px 8px",
        fontSize: 11,
        color: "#aaa",
        fontWeight: 600,
        borderBottom: "1px solid #eee",
        gap: 6,
      }}>
        {showPosition && <div>位置</div>}
        <div>#</div>
        <div>工程細項</div>
        <div>單位</div>
        <div style={{ textAlign: "right" }}>數量</div>
        <div style={{ textAlign: "right" }}>成本</div>
        <div style={{ textAlign: "right" }}>倍率</div>
        <div style={{ textAlign: "right" }}>單價</div>
        <div style={{ textAlign: "right" }}>金額</div>
        <div>備註</div>
        <div></div>
      </div>

      {items.map((it, idx) => (
        <ItemRow
          key={it.id}
          item={it}
          index={idx + 1}
          showPosition={showPosition}
          colWidths={colWidths}
          onUpdate={(patch) => onUpdate(it.id, patch)}
          onRemove={() => onRemove(it.id)}
          onMoveUp={() => onMove(it.id, "up")}
          onMoveDown={() => onMove(it.id, "down")}
        />
      ))}

      {items.length === 0 && (
        <div style={{ padding: "16px 8px", color: "#ccc", fontSize: 12, textAlign: "center" }}>
          尚無品項
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, index, showPosition, colWidths, onUpdate, onRemove, onMoveUp, onMoveDown }) {
  const [hover, setHover] = useState(false);
  const inputStyle = {
    border: "1px solid transparent",
    borderRadius: 3,
    padding: "4px 6px",
    fontSize: 13,
    fontFamily: "inherit",
    background: "transparent",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    color: "#333",
    transition: "border-color 0.1s",
  };
  const numStyle = { ...inputStyle, textAlign: "right" };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: colWidths,
        padding: "4px 8px",
        alignItems: "center",
        borderBottom: "1px solid #f5f5f5",
        background: hover ? "#fafafa" : "transparent",
        gap: 6,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {showPosition && (
        <input
          style={inputStyle}
          value={item.position}
          onChange={e => onUpdate({ position: e.target.value })}
          onFocus={e => e.target.style.borderColor = "#ddd"}
          onBlur={e => e.target.style.borderColor = "transparent"}
          placeholder="—"
        />
      )}
      <div style={{ color: "#bbb", fontSize: 12, textAlign: "center" }}>{index}</div>
      <input
        style={inputStyle}
        value={item.itemName}
        onChange={e => onUpdate({ itemName: e.target.value })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
        placeholder="工程細項名稱"
      />
      <input
        style={inputStyle}
        value={item.unit}
        onChange={e => onUpdate({ unit: e.target.value })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
      />
      <input
        style={numStyle}
        type="number"
        value={item.qty}
        onChange={e => onUpdate({ qty: toNum(e.target.value) })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
      />
      <input
        style={numStyle}
        type="number"
        value={item.cost || ""}
        onChange={e => onUpdate({ cost: toNum(e.target.value), priceOverride: false })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
        placeholder="0"
      />
      <input
        style={numStyle}
        type="number"
        step="0.1"
        value={item.multiplier || ""}
        onChange={e => onUpdate({ multiplier: toNum(e.target.value), priceOverride: false })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
        placeholder="1"
      />
      <input
        style={{
          ...numStyle,
          color: item.priceOverride ? "#6a96b0" : "#333",
          fontWeight: item.priceOverride ? 600 : 400,
        }}
        type="number"
        value={item.price || ""}
        onChange={e => onUpdate({ price: toNum(e.target.value), priceOverride: true })}
        onFocus={e => { e.target.style.borderColor = "#ddd"; }}
        onBlur={e => e.target.style.borderColor = "transparent"}
        title={item.priceOverride ? "手動覆寫（點擊重設）" : "自動計算"}
        placeholder="0"
      />
      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: "#333" }}>
        {item.total > 0 ? fmt(item.total) : "—"}
      </div>
      <input
        style={inputStyle}
        value={item.note}
        onChange={e => onUpdate({ note: e.target.value })}
        onFocus={e => e.target.style.borderColor = "#ddd"}
        onBlur={e => e.target.style.borderColor = "transparent"}
        placeholder="備註"
      />
      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
        {item.priceOverride && (
          <button
            title="重設為自動計算"
            onClick={() => onUpdate({ priceOverride: false })}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 11, padding: "2px 4px" }}
          >↺</button>
        )}
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "2px 4px" }}
          onMouseEnter={e => e.target.style.color = "#c0675a"}
          onMouseLeave={e => e.target.style.color = "#ccc"}
        >✕</button>
      </div>
    </div>
  );
}

// ─── 列印版面 ───────────────────────────────────────────────
function PrintView({ quote, items, summary, settings, mode, onClose }) {
  const isClient = mode === "client";
  const isIntegrated = quote.type === "integrated";
  const groups = settings.engineering_groups || [];
  const categories = settings.engineering_categories || [];
  const bankAccount = (settings.bank_accounts || []).find(b => b.id === quote.bankAccountId);

  // ─── 即時調整面板 state ───────────────────────────────────
  const [showAdjust, setShowAdjust] = useState(false);
  const [adj, setAdj] = useState({
    logoWidth: 175,
    logoGap: 14,
    companyFontSize: 17,
    companyLetterSpacing: 4,
    titleFontSize: 17,
    titleLetterSpacing: 8,
    headerMarginBottom: 16,
  });
  function setA(key, val) { setAdj(prev => ({ ...prev, [key]: Number(val) })); }

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        body { margin: 0; }
        .print-page { margin: 0; padding: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const ps = {
    fontFamily: '"Noto Serif TC","思源宋體","Source Han Serif TC",serif',
    color: "#333",
    fontSize: 13,
  };
  const bodyFont = '"微軟正黑體","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';

  function PrintHeader({ showType = true }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: adj.headerMarginBottom }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: adj.logoGap }}>
            <img
              src="/whatis-logo.png"
              alt="whatis"
              style={{ width: adj.logoWidth, height: "auto", objectFit: "contain" }}
            />
            <div style={{ fontSize: adj.companyFontSize, fontWeight: 400, letterSpacing: adj.companyLetterSpacing, color: "#333" }}>
              {settings.company_name || "何為設計有限公司"}
            </div>
          </div>
          {showType && (
            <div style={{ fontSize: adj.titleFontSize, fontWeight: 400, letterSpacing: adj.titleLetterSpacing, color: "#333" }}>
              工 程 報 價 單
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #ccc", marginBottom: 14 }} />
        <div style={{ fontSize: 13, lineHeight: 1.9, fontFamily: bodyFont }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ color: "#888", width: 70, flexShrink: 0 }}>工程名稱</span>
            <span style={{ color: "#888", marginRight: 12 }}>/</span>
            <span style={{ fontWeight: 600 }}>{quote.projectName || quote.name}</span>
          </div>
          {quote.projectAddress && (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ color: "#888", width: 70, flexShrink: 0 }}>工程地址</span>
              <span style={{ color: "#888", marginRight: 12 }}>/</span>
              <span>{quote.projectAddress}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#888", marginTop: 8, fontFamily: bodyFont }}>
          {quote.date ? `${quote.date.replace(/-/g, "/")}` : ""}
        </div>
      </div>
    );
  }

  // 整合式：計算各大項小計
  function buildIntegratedSummary() {
    const result = [];
    groups.forEach(g => {
      const gItems = items.filter(it => it.group === g.id);
      if (gItems.length === 0) return;
      const cats = [];
      const catIds = [...new Set(gItems.map(it => it.category))];
      catIds.forEach(catId => {
        const cat = categories.find(c => c.id === catId);
        const catItems = gItems.filter(it => it.category === catId);
        const catTotal = catItems.reduce((s, it) => s + it.total, 0);
        cats.push({ cat, catItems, catTotal });
      });
      const gTotal = gItems.reduce((s, it) => s + it.total, 0);
      result.push({ group: g, cats, gTotal });
    });
    return result;
  }

  const integratedData = isIntegrated ? buildIntegratedSummary() : null;

  // 整合式第一頁：總表
  function SummaryPage() {
    const label = { padding: "6px 10px", fontSize: 13, borderBottom: "1px solid #eee", fontFamily: bodyFont };
    const amount = { padding: "6px 10px", textAlign: "right", fontSize: 13, borderBottom: "1px solid #eee", fontFamily: bodyFont };
    const letters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

    return (
      <div style={{ ...ps, maxWidth: 780, margin: "0 auto" }}>
        <PrintHeader showType={false} />
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, letterSpacing: 4, marginBottom: 20, color: "#333" }}>
          工 程 估 價 總 表
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", fontSize: 12, color: "#666" }}>
              <th style={{ ...label, width: 50, textAlign: "center" }}>項目</th>
              <th style={label}>工程項目</th>
              <th style={{ ...amount, width: 140 }}>金額</th>
              <th style={{ ...label, width: 120 }}>備註</th>
            </tr>
          </thead>
          <tbody>
            {integratedData.map((gd, gi) => {
              const catRows = [];
              gd.cats.forEach((cd, ci) => {
                catRows.push(
                  <tr key={`${gi}-${ci}`}>
                    <td style={{ ...label, textAlign: "center", color: "#888" }}>{letters[catRows.length + gi]}</td>
                    <td style={label}>{cd.cat ? cd.cat.name : "其他"}</td>
                    <td style={amount}>${fmt(cd.catTotal)}</td>
                    <td style={label}></td>
                  </tr>
                );
              });
              return (
                <>
                  {catRows}
                  {gd.cats.length > 1 && (
                    <tr key={`g${gi}-total`} style={{ background: "#fafafa" }}>
                      <td colSpan={2} style={{ ...label, paddingLeft: 20, color: "#888", fontWeight: 600 }}>
                        {gd.group.name}小計
                      </td>
                      <td style={{ ...amount, fontWeight: 600 }}>${fmt(gd.gTotal)}</td>
                      <td style={label}></td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* 工程管理費 */}
            {quote.managementFeeMode !== "none" && (
              <tr style={{ background: "#f9f9f9" }}>
                <td style={{ ...label, textAlign: "center", color: "#888" }}>M</td>
                <td style={label}>
                  工程管理費({quote.managementFeeValue}{quote.managementFeeMode === "percent" ? "%" : ""})
                  {summary.managementFeeDiscount > 0 && <span style={{ color: "#888" }}>（折扣）</span>}
                </td>
                <td style={amount}>
                  {summary.managementFeeDiscount > 0 ? (
                    <span>
                      <span style={{ textDecoration: "line-through", color: "#aaa", marginRight: 8 }}>
                        ${fmt(summary.managementFeeRaw)}
                      </span>
                      ${fmt(summary.managementFee)}
                    </span>
                  ) : `$${fmt(summary.managementFee)}`}
                </td>
                <td style={label}>
                  {summary.managementFeeDiscount > 0 && `整價後 $${fmt(summary.managementFee)}`}
                </td>
              </tr>
            )}

            {/* 合計列 */}
            <tr style={{ background: "#f5f5f5", fontWeight: 600 }}>
              <td colSpan={2} style={{ ...label, textAlign: "right" }}>工程項目合計</td>
              <td style={amount}>${fmt(summary.subtotal)}</td>
              <td style={label}></td>
            </tr>
          </tbody>
        </table>

        {/* 總計區 */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <table style={{ width: 300, borderCollapse: "collapse" }}>
            <tbody>
              {summary.roundingDiscount !== 0 && (
                <tr>
                  <td style={{ ...label, color: "#888" }}>整價</td>
                  <td style={amount}>${fmt(summary.roundedBeforeTax)}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...label }}>未稅</td>
                <td style={amount}>${fmt(summary.roundedBeforeTax || summary.beforeTax)}</td>
              </tr>
              {quote.taxRate > 0 && (
                <tr>
                  <td style={{ ...label }}>稅金</td>
                  <td style={amount}>${fmt(summary.taxAmount)}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700, fontSize: 15 }}>
                <td style={{ ...label, borderTop: "2px solid #333" }}>含稅</td>
                <td style={{ ...amount, borderTop: "2px solid #333", color: "#c0522a" }}>${fmt(summary.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {quote.showChineseAmount && (
          <div style={{ fontSize: 12, color: "#555", marginTop: 8, textAlign: "right" }}>
            合計新台幣：{toChineseAmount(summary.total)}
          </div>
        )}
      </div>
    );
  }

  // 明細頁
  function DetailPage({ groupData }) {
    const cellBase = { padding: "8px 6px", fontSize: 12, borderBottom: "1px solid #eee", verticalAlign: "middle", fontFamily: bodyFont };
    const cellCenter = { ...cellBase, textAlign: "center" };
    const cellLeft = { ...cellBase, textAlign: "left" };
    const cellRight = { ...cellBase, textAlign: "right" };

    return (
      <div style={{ ...ps, maxWidth: 780, margin: "0 auto" }}>
        <PrintHeader />
        {groupData.map((gd, gi) => (
          <div key={gi} style={{ marginBottom: 28 }}>
            {/* 群組標題 */}
            <div style={{ background: "#f0f0ee", padding: "6px 12px", fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 1 }}>
              {gd.group.name}
            </div>

            {gd.cats.map((cd, ci) => (
              <div key={ci} style={{ marginBottom: 16, marginLeft: 8 }}>
                {/* 大項標題 */}
                <div style={{ fontWeight: 600, fontSize: 13, padding: "4px 8px", borderLeft: "3px solid #ccc", marginBottom: 6 }}>
                  {cd.cat ? `${cd.cat.name}` : "其他"}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 32 }} />
                    <col />
                    <col style={{ width: 44 }} />
                    <col style={{ width: 52 }} />
                    <col style={{ width: 74 }} />
                    <col style={{ width: 86 }} />
                    <col style={{ width: 110 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ fontSize: 11, color: "#888", background: "#fafafa" }}>
                      <th style={cellCenter}>#</th>
                      <th style={cellLeft}>工程細項</th>
                      <th style={cellCenter}>單位</th>
                      <th style={cellCenter}>數量</th>
                      <th style={cellRight}>單價</th>
                      <th style={cellRight}>金額</th>
                      <th style={cellRight}>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cd.catItems.map((it, i) => (
                      <tr key={it.id}>
                        <td style={{ ...cellCenter, color: "#aaa" }}>{i + 1}</td>
                        <td style={cellLeft}>{it.itemName}</td>
                        <td style={cellCenter}>{it.unit}</td>
                        <td style={cellCenter}>{it.qty}</td>
                        <td style={cellRight}>{fmt(it.price)}</td>
                        <td style={cellRight}>{fmt(it.total)}</td>
                        <td style={cellRight}>{it.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, background: "#fafafa" }}>
                      <td colSpan={5} style={{ ...cellRight, color: "#888" }}>小計</td>
                      <td style={cellRight}>${fmt(cd.catTotal)}</td>
                      <td style={cellRight}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // 獨立品項列印
  function IndependentPage() {
    const cellBase = { padding: "10px 8px", fontSize: 13, borderBottom: "1px solid #eee", verticalAlign: "middle", fontFamily: bodyFont };
    const cellCenter = { ...cellBase, textAlign: "center" };
    const cellLeft = { ...cellBase, textAlign: "left" };
    const cellRight = { ...cellBase, textAlign: "right" };
    const showCost = !isClient;

    return (
      <div style={{ ...ps, maxWidth: 780, margin: "0 auto" }}>
        <PrintHeader />

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 56 }} />
            <col />
            <col style={{ width: 48 }} />
            <col style={{ width: 56 }} />
            {showCost && <col style={{ width: 64 }} />}
            {showCost && <col style={{ width: 48 }} />}
            <col style={{ width: 78 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr style={{ fontSize: 11, color: "#888", background: "#f5f5f5" }}>
              <th style={cellCenter}>項次</th>
              <th style={cellCenter}>位置</th>
              <th style={cellLeft}>工程細項</th>
              <th style={cellCenter}>單位</th>
              <th style={cellCenter}>數量</th>
              {showCost && <th style={cellRight}>成本</th>}
              {showCost && <th style={cellCenter}>倍率</th>}
              <th style={cellRight}>單價</th>
              <th style={cellRight}>金額</th>
              <th style={cellRight}>備註</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td style={{ ...cellCenter, color: "#aaa" }}>{i + 1}</td>
                <td style={cellCenter}>{it.position || ""}</td>
                <td style={cellLeft}>{it.itemName}</td>
                <td style={cellCenter}>{it.unit}</td>
                <td style={cellCenter}>{it.qty}</td>
                {showCost && <td style={cellRight}>{it.cost ? fmt(it.cost) : ""}</td>}
                {showCost && <td style={cellCenter}>{it.multiplier || ""}</td>}
                <td style={cellRight}>{fmt(it.price)}</td>
                <td style={cellRight}>{fmt(it.total)}</td>
                <td style={cellRight}>{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 金額區 */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <table style={{ width: 280, borderCollapse: "collapse", fontSize: 13, fontFamily: bodyFont }}>
            <tbody>
              <tr>
                <td style={{ padding: "5px 10px", color: "#555" }}>項目小記</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(summary.subtotal)}</td>
              </tr>
              {quote.managementFeeMode !== "none" && (isClient ? quote.showManagementFeeInClient : true) && (
                <tr>
                  <td style={{ padding: "5px 10px", color: "#555" }}>
                    工程管理費用({quote.managementFeeValue}{quote.managementFeeMode === "percent" ? "%" : ""})
                  </td>
                  <td style={{ padding: "5px 10px", textAlign: "right" }}>{fmt(summary.managementFee)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "5px 10px", fontWeight: 600 }}>合計</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(summary.beforeTax)}</td>
              </tr>
              {quote.taxRate > 0 && (
                <tr>
                  <td style={{ padding: "5px 10px", color: "#555" }}>稅金</td>
                  <td style={{ padding: "5px 10px", textAlign: "right" }}>{fmt(summary.taxAmount)}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ padding: "6px 10px", borderTop: "2px solid #333" }}>總計</td>
                <td style={{ padding: "6px 10px", textAlign: "right", borderTop: "2px solid #333", fontSize: 16, color: "#c0522a" }}>
                  {fmt(summary.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {quote.showChineseAmount && (
          <div style={{ fontSize: 12, color: "#555", marginBottom: 12, fontFamily: bodyFont }}>
            合計新台幣：{toChineseAmount(summary.total)}
          </div>
        )}

        <PrintFooter quote={quote} settings={settings} bankAccount={bankAccount} isClient={isClient} />
      </div>
    );
  }

  function PrintFooter({ quote, settings, bankAccount, isClient }) {
    return (
      <div style={{ borderTop: "1px solid #ddd", paddingTop: 16, marginTop: 8, fontFamily: bodyFont }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12, marginBottom: 32 }}>
          {/* 備註 */}
          {quote.terms && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>備註</div>
              <div style={{ color: "#555", whiteSpace: "pre-line", lineHeight: 1.8 }}>{quote.terms}</div>
            </div>
          )}

          {/* 右側：公司資訊、匯款 */}
          <div>
            {/* 公司資訊 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>公司資訊</div>
              <div style={{ color: "#555", lineHeight: 1.8 }}>
                {settings.company_name} / {settings.company_tax_id}<br />
                {settings.company_address} / {settings.company_phone}
                {settings.company_email && <><br />{settings.company_email}</>}
              </div>
            </div>

            {/* 匯款帳戶 */}
            {quote.showBankAccount && bankAccount && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>匯款帳戶</div>
                <div style={{ color: "#555", lineHeight: 1.8 }}>
                  {bankAccount.bankName} {bankAccount.branchName}({bankAccount.bankCode})<br />
                  戶名：{bankAccount.accountName}<br />
                  帳號：{bankAccount.accountNumber}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 客戶簽章 / 經辦人（獨立於下方，留簽名空間）*/}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>客戶簽章</div>
            <div style={{ height: 70, border: "1px solid #ddd", borderRadius: 4, background: "#fafafa" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>經辦人</div>
            <div style={{ height: 70, border: "1px solid #ddd", borderRadius: 4, background: "#fafafa" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f0ee", minHeight: "100vh", padding: "24px 0" }}>
      {/* 工具列 */}
      <div className="no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0,
        background: "#fff", borderBottom: "1px solid #e0e0e0",
        display: "flex", alignItems: "center", gap: 16,
        padding: "12px 32px", zIndex: 100,
      }}>
        <button style={S.btnSecondary} onClick={onClose}>← 返回編輯</button>
        <span style={{ fontSize: 13, color: "#888" }}>
          {isClient ? "客戶版" : "內部版"} · {quote.name}
        </span>
        <button
          style={{ ...S.btnSecondary, marginLeft: "auto", background: showAdjust ? "#f5f5f5" : "transparent" }}
          onClick={() => setShowAdjust(!showAdjust)}
        >⚙ 調整版面</button>
        <button style={S.btn} onClick={() => window.print()}>
          列印 / 儲存 PDF
        </button>
      </div>

      {/* 調整面板 */}
      {showAdjust && (
        <div className="no-print" style={{
          position: "fixed", top: 53, right: 0,
          background: "#fff", borderLeft: "1px solid #e0e0e0", borderBottom: "1px solid #e0e0e0",
          padding: "20px 24px", zIndex: 99, width: 280,
          boxShadow: "-2px 4px 12px rgba(0,0,0,0.06)",
          maxHeight: "calc(100vh - 53px)", overflowY: "auto",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 16, letterSpacing: 0.5 }}>抬頭版面調整</div>

          {[
            { key: "logoWidth", label: "LOGO 寬度", min: 80, max: 300, unit: "px" },
            { key: "logoGap", label: "LOGO 與公司名稱間距", min: 0, max: 60, unit: "px" },
            { key: "companyFontSize", label: "公司名稱字體大小", min: 10, max: 32, unit: "px" },
            { key: "companyLetterSpacing", label: "公司名稱字距", min: 0, max: 20, unit: "px" },
            { key: "titleFontSize", label: "「工程報價單」字體大小", min: 10, max: 32, unit: "px" },
            { key: "titleLetterSpacing", label: "「工程報價單」字距", min: 0, max: 20, unit: "px" },
            { key: "headerMarginBottom", label: "抬頭下方間距", min: 0, max: 48, unit: "px" },
          ].map(({ key, label, min, max, unit }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{adj[key]}{unit}</span>
              </div>
              <input
                type="range" min={min} max={max} value={adj[key]}
                onChange={e => setA(key, e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          ))}

          <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>調整滿意後，把以下數值貼給 Claude：</div>
            <textarea
              readOnly
              value={JSON.stringify(adj, null, 2)}
              style={{ width: "100%", height: 160, fontSize: 10, color: "#555", border: "1px solid #eee", borderRadius: 4, padding: 8, resize: "none", fontFamily: "monospace", boxSizing: "border-box" }}
              onClick={e => e.target.select()}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 60 }}>
        {/* 整合式：總表 + 明細各自一頁 */}
        {isIntegrated ? (
          <>
            <div style={{ background: "#fff", width: 794, margin: "0 auto 24px", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <SummaryPage />
            </div>
            <div style={{ background: "#fff", width: 794, margin: "0 auto", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <DetailPage groupData={integratedData} />
            </div>
          </>
        ) : (
          <div style={{ background: "#fff", width: 794, margin: "0 auto", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <IndependentPage />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 設定頁 ─────────────────────────────────────────────────
function SettingsPage({ settings, onSave }) {
  const [s, setS] = useState(settings);
  const [activeTab, setActiveTab] = useState("company");

  function update(key, val) {
    setS(prev => ({ ...prev, [key]: val }));
  }

  const tabs = [
    { id: "company", label: "公司資訊" },
    { id: "banks", label: "匯款帳戶" },
    { id: "engineering", label: "工程大項" },
    { id: "terms", label: "備註條款模板" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>系統設定</h1>
        <button style={S.btn} onClick={() => onSave(s)}>儲存設定</button>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #eee" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: "none", border: "none",
            borderBottom: activeTab === t.id ? "2px solid #333" : "2px solid transparent",
            padding: "10px 20px", fontSize: 13, cursor: "pointer",
            color: activeTab === t.id ? "#333" : "#888",
            fontWeight: activeTab === t.id ? 600 : 400,
            fontFamily: "inherit", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* 公司資訊 */}
      {activeTab === "company" && (
        <div style={{ ...S.card, maxWidth: 560 }}>
          {[
            { key: "company_name", label: "公司名稱" },
            { key: "company_tax_id", label: "統一編號" },
            { key: "company_address", label: "地址" },
            { key: "company_phone", label: "電話" },
            { key: "company_email", label: "Email" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={S.label}>{f.label}</label>
              <input style={S.input} value={s[f.key] || ""} onChange={e => update(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {/* 匯款帳戶 */}
      {activeTab === "banks" && (
        <BankAccountsEditor
          accounts={s.bank_accounts || []}
          onChange={v => update("bank_accounts", v)}
        />
      )}

      {/* 工程大項 */}
      {activeTab === "engineering" && (
        <EngineeringEditor
          groups={s.engineering_groups || []}
          categories={s.engineering_categories || []}
          onChangeGroups={v => update("engineering_groups", v)}
          onChangeCategories={v => update("engineering_categories", v)}
        />
      )}

      {/* 備註條款模板 */}
      {activeTab === "terms" && (
        <TermTemplatesEditor
          templates={s.term_templates || []}
          onChange={v => update("term_templates", v)}
        />
      )}
    </div>
  );
}

function BankAccountsEditor({ accounts, onChange }) {
  function add() {
    onChange([...accounts, { id: genId(), label: "", bankName: "", branchName: "", bankCode: "", accountName: "", accountNumber: "" }]);
  }
  function update(id, patch) {
    onChange(accounts.map(a => a.id === id ? { ...a, ...patch } : a));
  }
  function remove(id) {
    if (!confirm("確定刪除此帳戶？")) return;
    onChange(accounts.filter(a => a.id !== id));
  }

  return (
    <div>
      {accounts.map(a => (
        <div key={a.id} style={{ ...S.card, marginBottom: 16, maxWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>帳戶標籤（顯示名稱）</label>
              <input style={S.input} value={a.label} onChange={e => update(a.id, { label: e.target.value })} placeholder="例：中信市政分行" />
            </div>
            <div><label style={S.label}>銀行名稱</label><input style={S.input} value={a.bankName} onChange={e => update(a.id, { bankName: e.target.value })} /></div>
            <div><label style={S.label}>分行名稱</label><input style={S.input} value={a.branchName} onChange={e => update(a.id, { branchName: e.target.value })} /></div>
            <div><label style={S.label}>銀行代碼</label><input style={S.input} value={a.bankCode} onChange={e => update(a.id, { bankCode: e.target.value })} /></div>
            <div><label style={S.label}>戶名</label><input style={S.input} value={a.accountName} onChange={e => update(a.id, { accountName: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>帳號</label>
              <input style={S.input} value={a.accountNumber} onChange={e => update(a.id, { accountNumber: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={S.btnDanger} onClick={() => remove(a.id)}>刪除此帳戶</button>
          </div>
        </div>
      ))}
      <button style={S.btnSecondary} onClick={add}>＋ 新增帳戶</button>
    </div>
  );
}

function EngineeringEditor({ groups, categories, onChangeGroups, onChangeCategories }) {
  function toggleCat(id) {
    onChangeCategories(categories.map(c => c.id === id ? { ...c, active: !c.active } : c));
  }

  return (
    <div>
      {groups.map(g => {
        const gCats = categories.filter(c => c.groupId === g.id);
        return (
          <div key={g.id} style={{ ...S.card, marginBottom: 16, maxWidth: 560 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{g.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {gCats.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 4,
                    border: "1px solid",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: c.active !== false ? "#333" : "transparent",
                    color: c.active !== false ? "#fff" : "#aaa",
                    borderColor: c.active !== false ? "#333" : "#e0e0e0",
                    transition: "all 0.15s",
                  }}
                >{c.name}</button>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>點擊切換工程大項啟用 / 停用狀態</div>
    </div>
  );
}

function TermTemplatesEditor({ templates, onChange }) {
  function add() {
    onChange([...templates, { id: genId(), name: "", content: "" }]);
  }
  function update(id, patch) {
    onChange(templates.map(t => t.id === id ? { ...t, ...patch } : t));
  }
  function remove(id) {
    if (!confirm("確定刪除此模板？")) return;
    onChange(templates.filter(t => t.id !== id));
  }

  return (
    <div>
      {templates.map(t => (
        <div key={t.id} style={{ ...S.card, marginBottom: 16, maxWidth: 640 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>模板名稱</label>
            <input style={S.input} value={t.name} onChange={e => update(t.id, { name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>條款內容</label>
            <textarea style={{ ...S.input, height: 120, resize: "vertical" }} value={t.content} onChange={e => update(t.id, { content: e.target.value })} />
          </div>
          <button style={S.btnDanger} onClick={() => remove(t.id)}>刪除</button>
        </div>
      ))}
      <button style={S.btnSecondary} onClick={add}>＋ 新增模板</button>
    </div>
  );
}

// ─── 模板頁 ─────────────────────────────────────────────────
function TemplatesPage({ templates, settings, onSave }) {
  const [tmplts, setTmplts] = useState(templates);

  function add(type) {
    const newT = { id: genId(), name: "新模板", type, items: [], createdAt: now() };
    const next = [...tmplts, newT];
    setTmplts(next);
    onSave(next);
  }

  function remove(id) {
    if (!confirm("確定刪除此模板？")) return;
    const next = tmplts.filter(t => t.id !== id);
    setTmplts(next);
    onSave(next);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>工程模板</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnSecondary} onClick={() => add("independent")}>＋ 獨立品項模板</button>
          <button style={S.btn} onClick={() => add("integrated")}>＋ 整合式模板</button>
        </div>
      </div>

      {tmplts.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 48, color: "#bbb" }}>
          尚無模板，點擊右上角新增
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tmplts.map(t => (
            <div key={t.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                  {TYPE_LABELS[t.type]} · {t.items.length} 個品項
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={S.btnDanger} onClick={() => remove(t.id)}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
