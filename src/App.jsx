// whatis Quote | 工程估價與報價管理系統
// 何為設計有限公司 whatis ARCH DESIGN
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import XLSXStyle from "xlsx-js-style";

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

async function searchPriceDB(keyword) {
  return gasAction("searchPriceDB", { keyword });
}

async function savePriceDB(items) {
  return gasAction("savePriceDB", { items });
}

// ─── 資料轉換 ───────────────────────────────────────────────
function rowsToProjects(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  const idx = (k) => h.indexOf(k);
  return rows.slice(1).filter(r => r[idx("id")]).map(r => ({
    id: r[idx("id")],
    name: r[idx("name")] || "",
    color: r[idx("color")] || "#888888",
    sortOrder: toNum(r[idx("sortOrder")]),
    createdAt: r[idx("createdAt")] || "",
    updatedAt: r[idx("updatedAt")] || "",
  }));
}

function projectsToRows(projects) {
  const h = ["id", "name", "color", "sortOrder", "createdAt", "updatedAt"];
  return [h, ...projects.map(p => [
    p.id, p.name, p.color, p.sortOrder, p.createdAt, p.updatedAt,
  ])];
}

function rowsToQuotes(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  const idx = (k) => h.indexOf(k);
  return rows.slice(1).filter(r => r[idx("id")]).map(r => ({
    id: r[idx("id")],
    name: r[idx("name")] || "",
    type: r[idx("type")] || "independent",
    status: r[idx("status")] || "draft",
    projectId: r[idx("projectId")] || "",
    locked: r[idx("locked")] === "TRUE",
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
    "id","name","type","status","projectId","locked","clientName","projectName","projectAddress","date",
    "managementFeeMode","managementFeeValue","managementFeeBase","managementFeeOverride",
    "taxRate","roundingMode","roundingTarget","showChineseAmount","showBankAccount",
    "bankAccountId","termTemplateId","terms","internalNote","showManagementFeeInClient",
    "createdAt","updatedAt"
  ];
  return [h, ...quotes.map(q => [
    q.id, q.name, q.type, q.status, q.projectId || "", q.locked ? "TRUE" : "FALSE", q.clientName, q.projectName, q.projectAddress, q.date,
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
    tag: r[idx("tag")] || null,
    tagMemo: r[idx("tagMemo")] || null,
    updatedAt: r[idx("updatedAt")] || "",
  }));
}

function itemsToRows(items) {
  const h = [
    "id","quoteId","group","category","position","itemName","unit","qty",
    "cost","multiplier","price","priceOverride","total","note","sortOrder","tag","tagMemo","updatedAt"
  ];
  return [h, ...items.map(it => [
    it.id, it.quoteId, it.group, it.category, it.position,
    it.itemName, it.unit, it.qty, it.cost, it.multiplier,
    it.price, it.priceOverride ? "TRUE" : "FALSE",
    it.total, it.note, it.sortOrder,
    it.tag || "", it.tagMemo || "",
    it.updatedAt,
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
  if (item.unit === "__section__") return { ...item, price: 0, total: 0, margin: null };
  const cost = toNum(item.cost);
  const multiplier = toNum(item.multiplier) || 1;
  const qty = toNum(item.qty) || 1;
  const price = item.priceOverride ? toNum(item.price) : Math.round(cost * multiplier);
  const total = Math.round(price * qty);
  const margin = cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  return { ...item, price, total, margin };
}

function calcQuoteSummary(items, quote) {
  const subtotal = items
    .filter(it => it.unit !== "__section__")
    .reduce((s, it) => s + toNum(it.total), 0);

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
  archived: "未選擇（封存）",
};
const STATUS_COLORS = {
  draft: "#bbbbbb",
  quoted: "#6a96b0",
  confirmed: "#6aaa8a",
  addendum: "#c9a84c",
  closed: "#888888",
  archived: "#cccccc",
};
const TYPE_LABELS = {
  independent: "獨立品項",
  integrated: "整合式工程",
  template: "快速模板",
  addendum: "追加減帳",
};

// ─── 樣式常數 ───────────────────────────────────────────────
// ─── Excel 匯出 ──────────────────────────────────────────────
function exportQuoteExcel(quote, items, settings) {
  const wb = XLSXStyle.utils.book_new();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // 字體與樣式
  const _F = (sz = 10, bold = false, color = "333333") => ({
    name: "微軟正黑體", sz, bold, color: { rgb: color }
  });
  const _FB = (sz = 10, color = "FFFFFF") => _F(sz, true, color);

  const ST = {
    sectionTitle: {
      font: _FB(11, "FFFFFF"),
      fill: { fgColor: { rgb: "4A4A4A" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: { bottom: { style: "thin", color: { rgb: "CCCCCC" } } }
    },
    colHeader: {
      font: _FB(10, "333333"),
      fill: { fgColor: { rgb: "E8E8E8" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "thin", color: { rgb: "CCCCCC" } } }
    },
    colHeaderR: {
      font: _FB(10, "333333"),
      fill: { fgColor: { rgb: "E8E8E8" } },
      alignment: { horizontal: "right", vertical: "center" },
    },
    dataWhite: { font: _F(10), fill: { fgColor: { rgb: "FFFFFF" } } },
    dataGray:  { font: _F(10), fill: { fgColor: { rgb: "F8F8F8" } } },
    total:     { font: _FB(10, "333333"), fill: { fgColor: { rgb: "F0F0F0" } } },
    totalR:    { font: _FB(10, "333333"), fill: { fgColor: { rgb: "F0F0F0" } }, alignment: { horizontal: "right" }, numFmt: "#,##0" },
    section:   { font: _FB(11, "555555"), fill: { fgColor: { rgb: "F0F0EE" } }, alignment: { horizontal: "left" } },
    profitPos: { font: _FB(10, "2D7A2D"), fill: { fgColor: { rgb: "F0F8F4" } }, alignment: { horizontal: "right" }, numFmt: "#,##0" },
    profitNeg: { font: _FB(10, "C0675A"), fill: { fgColor: { rgb: "FDF0EE" } }, alignment: { horizontal: "right" }, numFmt: "#,##0" },
    numR:      { font: _F(10), alignment: { horizontal: "right" }, numFmt: "#,##0" },
    numC:      { font: _F(10), alignment: { horizontal: "center" } },
  };

  function c(v, s, z) {
    const cell = typeof v === "number" ? { t: "n", v } : { t: "s", v: String(v ?? "") };
    if (s) cell.s = s;
    if (z) cell.z = z;
    return cell;
  }

  function setColWidths(ws, widths) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  }

  function safeSheetName(wb, name) {
    let safe = (name || "工作表").replace(/[\\\/\?\*\[\]:]/g, "_").substring(0, 28);
    let final = safe; let n = 1;
    while (wb.SheetNames.includes(final)) final = safe.substring(0, 25) + "_" + n++;
    return final;
  }

  const calcedItems = items.map(calcItem);
  const summary = calcQuoteSummary(calcedItems, quote);
  const clientItems = calcedItems.filter(it => it.unit !== "__section__");
  const groups = settings.engineering_groups || [];
  const categories = settings.engineering_categories || [];
  const isIntegrated = quote.type === "integrated";

  // ── 工作表一：客戶版報價 ──────────────────────────────────
  function buildClientSheet() {
    const aoa = [];
    // 基本資訊
    aoa.push(["工程報價單"]);
    aoa.push(["工程名稱", quote.projectName || quote.name]);
    aoa.push(["工程地址", quote.projectAddress || ""]);
    aoa.push(["業主", quote.clientName || ""]);
    aoa.push(["日期", quote.date || ""]);
    aoa.push([]);

    if (isIntegrated) {
      // 整合式：先總表再明細
      const sortedGroups = [...groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      aoa.push(["項目", "工程大項", "", "", "金額", "備註"]);

      let alphaIdx = 0;
      const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      sortedGroups.forEach(g => {
        const gItems = clientItems.filter(it => it.group === g.id);
        if (!gItems.length) return;
        const catIds = [...new Set(gItems.map(it => it.category))].sort((a, b) => {
          const ca = categories.find(c => c.id === a);
          const cb = categories.find(c => c.id === b);
          return (ca?.sortOrder || 999) - (cb?.sortOrder || 999);
        });
        catIds.forEach(catId => {
          const cat = categories.find(c2 => c2.id === catId);
          const catTotal = gItems.filter(it => it.category === catId).reduce((s, it) => s + it.total, 0);
          aoa.push([alpha[alphaIdx++ % 26], cat?.name || "其他", "", "", catTotal, ""]);
        });
      });
      aoa.push([]);
      aoa.push(["", "", "", "", summary.subtotal, ""]);
      if (summary.managementFee > 0) aoa.push(["", `工程管理費(${quote.managementFeeValue}%)`, "", "", summary.managementFee, ""]);
      aoa.push([]);
      if (quote.taxRate > 0) {
        aoa.push(["", "", "", "", "未稅", summary.beforeTax]);
        aoa.push(["", "", "", "", "稅金", summary.taxAmount]);
      }
      aoa.push(["", "", "", "", quote.taxRate > 0 ? "總價" : "工程承攬總價", summary.total]);

      aoa.push([]);
      aoa.push([]);
      aoa.push(["品項明細"]);

      sortedGroups.forEach(g => {
        const gItems = calcedItems.filter(it => it.group === g.id);
        if (!gItems.length) return;
        aoa.push([g.name]);
        const catIds = [...new Set(gItems.map(it => it.category))].sort((a, b) => {
          const ca = categories.find(c => c.id === a);
          const cb = categories.find(c => c.id === b);
          return (ca?.sortOrder || 999) - (cb?.sortOrder || 999);
        });
        catIds.forEach(catId => {
          const cat = categories.find(c2 => c2.id === catId);
          const catItems2 = gItems.filter(it => it.category === catId);
          aoa.push([cat?.name || "其他"]);
          aoa.push(["#", "工程細項", "單位", "數量", "單價", "金額", "備註"]);
          let rowIdx = 0;
          catItems2.forEach(it => {
            if (it.unit === "__section__") { aoa.push(["", it.itemName]); return; }
            rowIdx++;
            aoa.push([rowIdx, it.itemName, it.unit, it.qty, it.price, it.total, it.note || ""]);
          });
          const catTotal = catItems2.filter(it => it.unit !== "__section__").reduce((s, it) => s + it.total, 0);
          aoa.push(["", "", "", "", "小計", catTotal, ""]);
          aoa.push([]);
        });
      });
    } else {
      // 獨立品項
      aoa.push(["#", "位置", "工程細項", "單位", "數量", "單價", "金額", "備註"]);
      let idx = 0;
      calcedItems.forEach(it => {
        if (it.unit === "__section__") { aoa.push(["", "", it.itemName]); return; }
        idx++;
        aoa.push([idx, it.position || "", it.itemName, it.unit, it.qty, it.price, it.total, it.note || ""]);
      });
      aoa.push([]);
      aoa.push(["", "", "", "", "", "小計", summary.subtotal, ""]);
      if (summary.managementFee > 0) aoa.push(["", "", "", "", "", `管理費(${quote.managementFeeValue}%)`, summary.managementFee, ""]);
      if (quote.taxRate > 0) {
        aoa.push(["", "", "", "", "", "未稅", summary.beforeTax, ""]);
        aoa.push(["", "", "", "", "", "稅金", summary.taxAmount, ""]);
      }
      aoa.push(["", "", "", "", "", quote.taxRate > 0 ? "總價" : "工程承攬總價", summary.total, ""]);
    }

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    setColWidths(ws, isIntegrated ? [6, 20, 10, 10, 14, 16] : [6, 12, 20, 8, 8, 12, 14, 16]);
    return ws;
  }

  // ── 工作表二：內部成本分析 ───────────────────────────────
  function buildInternalSheet() {
    const totalCost = clientItems.reduce((s, it) => s + toNum(it.cost) * toNum(it.qty), 0);
    const totalRevenue = clientItems.reduce((s, it) => s + it.total, 0);
    const totalProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    const aoa = [];
    aoa.push(["INTERNAL USE ONLY — 成本利潤分析表"]);
    aoa.push(["工程名稱", quote.projectName || quote.name]);
    aoa.push(["業主", quote.clientName || ""]);
    aoa.push(["日期", quote.date || ""]);
    aoa.push([]);
    aoa.push(["報價合計（未稅）", summary.subtotal, "成本合計", totalCost, "毛利", totalProfit, "毛利率", `${marginPct}%`]);
    aoa.push([]);
    aoa.push(["#", "品項", "單位", "數量", "成本單價", "倍率", "報價單價", "成本小計", "毛利", "毛利率"]);

    let idx = 0;

    function pushItemRow(it, i) {
      const costTotal = Math.round(toNum(it.cost) * toNum(it.qty));
      const profit = it.total - costTotal;
      const pct = it.total > 0 ? Math.round((profit / it.total) * 100) : 0;
      aoa.push([
        i, it.itemName, it.unit, it.qty,
        it.cost || 0, it.multiplier || "",
        it.price, costTotal,
        profit, `${pct}%`
      ]);
    }

    if (isIntegrated) {
      const sortedGroups = [...groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      sortedGroups.forEach(g => {
        const gItems = calcedItems.filter(it => it.group === g.id);
        if (!gItems.length) return;
        aoa.push([g.name]);
        const catIds = [...new Set(gItems.map(it => it.category))].sort((a, b) => {
          const ca = categories.find(c => c.id === a);
          const cb = categories.find(c => c.id === b);
          return (ca?.sortOrder || 999) - (cb?.sortOrder || 999);
        });
        catIds.forEach(catId => {
          const cat = categories.find(c2 => c2.id === catId);
          const catItems2 = gItems.filter(it => it.category === catId);
          aoa.push([cat?.name || "其他"]);
          catItems2.forEach(it => {
            if (it.unit === "__section__") { aoa.push(["", it.itemName]); return; }
            idx++;
            pushItemRow(it, idx);
          });
        });
      });
    } else {
      calcedItems.forEach(it => {
        if (it.unit === "__section__") { aoa.push(["", it.itemName]); return; }
        idx++;
        pushItemRow(it, idx);
      });
    }

    aoa.push([]);
    aoa.push(["合計", "", "", "", "", "", summary.subtotal, totalCost, totalProfit, `${marginPct}%`]);
    if (summary.managementFee > 0) {
      aoa.push([`管理費(${quote.managementFeeValue}%)`, "", "", "", "", "", summary.managementFee]);
    }
    if (quote.taxRate > 0) {
      aoa.push(["稅金", "", "", "", "", "", summary.taxAmount]);
    }
    aoa.push(["總價", "", "", "", "", "", summary.total]);

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    setColWidths(ws, [6, 22, 8, 8, 12, 8, 12, 12, 12, 10]);
    return ws;
  }

  const clientWs = buildClientSheet();
  const internalWs = buildInternalSheet();

  XLSXStyle.utils.book_append_sheet(wb, clientWs, safeSheetName(wb, "客戶版報價"));
  XLSXStyle.utils.book_append_sheet(wb, internalWs, safeSheetName(wb, "內部成本分析"));

  const fileName = `何為設計_${(quote.projectName || quote.name).replace(/[\\\/\?\*\[\]:]/g, "_").substring(0, 20)}_${today}.xlsx`;
  XLSXStyle.writeFile(wb, fileName);
}

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
  const [page, setPage] = useState("list");
  const [quotes, setQuotes] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editQuoteId, setEditQuoteId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 螢幕寬度偵測
  const [screenW, setScreenW] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const isPhone = screenW < 768;
  const isTablet = screenW >= 768 && screenW < 1200;
  const isDesktop = screenW >= 1200;

  const latestState = useRef({ quotes, allItems, templates, settings });
  useEffect(() => {
    latestState.current = { quotes, allItems, templates, settings };
  }, [quotes, allItems, templates, settings]);

  const saveTimer = useRef(null);

  // 讀取全部資料
  useEffect(() => {
    const CACHE_KEY = "whatis_quote_cache";
    const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

    function parseSettings(s) {
      ["bank_accounts","engineering_groups","engineering_categories","term_templates"].forEach(k => {
        if (s[k]) try { s[k] = JSON.parse(s[k]); } catch { s[k] = []; }
      });
      if (s.print_layout) try { s.print_layout = JSON.parse(s.print_layout); } catch { s.print_layout = null; }
      return s;
    }

    async function fetchFromGAS() {
      const [qRows, iRows, tRows, sRows, pRows] = await Promise.all([
        sheetGet("Quotes"),
        sheetGet("QuoteItems"),
        sheetGet("Templates"),
        sheetGet("Settings"),
        sheetGet("Projects"),
      ]);
      const s = parseSettings(rowsToSettings(sRows));
      return {
        quotes: rowsToQuotes(qRows),
        allItems: rowsToItems(iRows),
        templates: rowsToTemplates(tRows),
        settings: s,
        projects: rowsToProjects(pRows),
        cachedAt: Date.now(),
      };
    }

    async function loadAll() {
      // 先嘗試讀取快取
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          const age = Date.now() - (data.cachedAt || 0);
          // 快取未過期：立即顯示快取，背景靜默更新
          setQuotes(data.quotes || []);
          setAllItems(data.allItems || []);
          setTemplates(data.templates || []);
          setSettings(data.settings || {});
          setProjects(data.projects || []);
          setLoading(false);

          if (age < CACHE_TTL) {
            // 快取還新鮮，背景靜默更新
            fetchFromGAS().then(fresh => {
              setQuotes(fresh.quotes);
              setAllItems(fresh.allItems);
              setTemplates(fresh.templates);
              setSettings(fresh.settings);
              setProjects(fresh.projects || []);
              localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
            }).catch(() => {});
            return;
          }
          // 快取過期，背景更新但不阻塞
          fetchFromGAS().then(fresh => {
            setQuotes(fresh.quotes);
            setAllItems(fresh.allItems);
            setTemplates(fresh.templates);
            setSettings(fresh.settings);
              setProjects(fresh.projects || []);
            localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
          }).catch(e => setNotification({ msg: "背景更新失敗：" + e.message, type: "error" }));
          return;
        }
      } catch (e) {
        // 快取讀取失敗，繼續從 GAS 讀取
      }

      // 無快取，直接從 GAS 讀取
      try {
        const fresh = await fetchFromGAS();
        setQuotes(fresh.quotes);
        setAllItems(fresh.allItems);
        setTemplates(fresh.templates);
        setSettings(fresh.settings);
              setProjects(fresh.projects || []);
        localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch (e) {
        setNotification({ msg: "載入失敗：" + e.message, type: "error" });
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  // 儲存
  const scheduleSave = useCallback((newQuotes, newItems, newSettings, newProjects) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const { quotes: q, allItems: ai, settings: s } = latestState.current;
        const saveQ = newQuotes ?? q;
        const saveI = newItems ?? ai;
        const saveS = newSettings ?? s;

        const serialSettings = { ...saveS };
        ["bank_accounts","engineering_groups","engineering_categories","term_templates"].forEach(k => {
          if (Array.isArray(serialSettings[k])) {
            serialSettings[k] = JSON.stringify(serialSettings[k]);
          }
        });

        const ops = [sheetPut("Quotes", quotesToRows(saveQ))];
        if (newItems !== undefined) ops.push(sheetPut("QuoteItems", itemsToRows(saveI)));
        if (newSettings !== undefined) ops.push(sheetPut("Settings", settingsToRows(serialSettings)));
        if (newProjects !== undefined) ops.push(sheetPut("Projects", projectsToRows(newProjects)));

        const results = await Promise.all(ops);
        localStorage.removeItem("whatis_quote_cache");

        // 驗證每個工作表的寫入結果
        const failed = results.filter(r => r && r.success === false);
        if (failed.length > 0) {
          showNotif("⚠ 儲存異常：" + failed.map(r => r.error || r.sheet).join("、") + "，請勿關閉頁面", "error");
          setTimeout(() => setNotification(null), 10000); // 顯示 10 秒
          return;
        }

        // 顯示確認筆數
        const itemResult = results.find(r => r && r.sheet === "QuoteItems");
        if (itemResult && itemResult.rows !== undefined) {
          showNotif(`✓ 已儲存｜品項確認 ${itemResult.rows} 筆`, "success");
        } else {
          showNotif("✓ 已儲存", "success");
        }
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

      {/* ── 手機版（唯讀） ── */}
      {isPhone && (
        <MobileView
          quotes={quotes}
          allItems={allItems}
          projects={projects}
          settings={settings}
        />
      )}

      {/* ── iPad / 桌面版 ── */}
      {!isPhone && (
        <>
          {/* 側邊欄遮罩（iPad 展開時） */}
          {isTablet && sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9 }}
            />
          )}

          {/* 側邊欄 */}
          <div id="sidebar" style={{
            ...S.sidebar,
            transform: isTablet && !sidebarOpen ? "translateX(-220px)" : "translateX(0)",
            transition: "transform 0.2s ease",
          }}>
            {/* iPad 收折按鈕 */}
            {isTablet && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ position: "absolute", right: -36, top: 16, background: "#fff", border: "1px solid #e0e0e0", borderRadius: "0 4px 4px 0", padding: "6px 10px", cursor: "pointer", fontSize: 14, color: "#888" }}
              >✕</button>
            )}
            <Sidebar page={page} setPage={(p) => { setPage(p); if (isTablet) setSidebarOpen(false); }} />
          </div>

          {/* 主內容 */}
          <div id="main-content" style={{
            ...S.main,
            marginLeft: isTablet ? 0 : 220,
            padding: isTablet ? "20px 24px" : "40px 48px",
          }}>
            {/* iPad 選單按鈕 */}
            {isTablet && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{ ...S.btnSecondary, marginBottom: 20, padding: "8px 14px", fontSize: 13 }}
              >☰ 選單</button>
            )}
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
            onDuplicate={(id) => {
              const original = quotes.find(q => q.id === id);
              if (!original) return;
              const newId = genId();
              const newQ = {
                ...original,
                id: newId,
                name: original.name + "_複本",
                status: "draft",
                createdAt: now(),
                updatedAt: now(),
              };
              const originalItems = allItems.filter(it => it.quoteId === id);
              const newItems = originalItems.map(it => ({
                ...it,
                id: genId(),
                quoteId: newId,
                updatedAt: now(),
              }));
              const nextQ = [...quotes, newQ];
              const nextI = [...allItems, ...newItems];
              setQuotes(nextQ);
              setAllItems(nextI);
              scheduleSave(nextQ, nextI);
              showNotif(`已複製為「${newQ.name}」`, "success");
            }}
            onStatusChange={(id, status) => {
              const next = quotes.map(q => q.id === id ? { ...q, status, updatedAt: now() } : q);
              updateQuotes(next);
            }}
            projects={projects}
            onProjectsChange={(newProjects) => {
              setProjects(newProjects);
              scheduleSave(undefined, undefined, undefined, newProjects);
            }}
            onMoveToProject={(quoteId, projectId) => {
              const next = quotes.map(q => q.id === quoteId ? { ...q, projectId, updatedAt: now() } : q);
              setQuotes(next);
              scheduleSave(next);
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
      {!isPhone && notification && (
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
        </>
      )}
    </div>
  );
}

// ─── 手機唯讀模式 ───────────────────────────────────────────
function MobileView({ quotes, allItems, projects, settings }) {
  const [view, setView] = useState("list"); // list | detail | print
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  const selectedQuote = quotes.find(q => q.id === selectedId);
  const selectedItems = allItems.filter(it => it.quoteId === selectedId).map(calcItem);
  const summary = selectedQuote ? calcQuoteSummary(selectedItems, selectedQuote) : null;

  const filtered = quotes.filter(q =>
    !search || q.name.includes(search) || (q.clientName || "").includes(search) || (q.projectName || "").includes(search)
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const bodyFont = '"微軟正黑體","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';

  const STATUS_BG = {
    draft: "#f5f5f5", quoted: "#fdf6e3", confirmed: "#f0f8f4",
    addendum: "#eef3fd", closed: "#f5f5f5",
  };

  if (view === "print" && selectedQuote) {
    return (
      <div style={{ fontFamily: bodyFont, padding: 16, background: "#fff", minHeight: "100vh" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setView("detail")}
            style={{ ...S.btnSecondary, fontSize: 13 }}>← 返回</button>
          <button onClick={() => window.print()}
            style={{ ...S.btn, fontSize: 13 }}>列印 / 存 PDF</button>
        </div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
          列印前建議橫向並設定邊距最小值
        </div>
        <iframe
          src={`${window.location.href}`}
          style={{ width: "100%", height: "80vh", border: "1px solid #e0e0e0", borderRadius: 4 }}
          title="列印預覽"
        />
      </div>
    );
  }

  if (view === "detail" && selectedQuote) {
    const bankAccount = (settings.bank_accounts || []).find(b => b.id === selectedQuote.bankAccountId);
    return (
      <div style={{ fontFamily: bodyFont, background: "#f7f7f5", minHeight: "100vh" }}>
        {/* 頂部導覽 */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setView("list")}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedQuote.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{selectedQuote.clientName}</div>
          </div>
          <button onClick={() => setView("print")}
            style={{ ...S.btn, fontSize: 12, padding: "6px 12px" }}>列印</button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 基本資訊 */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {[
                { label: "工程名稱", value: selectedQuote.projectName },
                { label: "工程地址", value: selectedQuote.projectAddress },
                { label: "業主", value: selectedQuote.clientName },
                { label: "日期", value: selectedQuote.date },
                { label: "類型", value: TYPE_LABELS[selectedQuote.type] },
                { label: "狀態", value: STATUS_LABELS[selectedQuote.status] },
              ].map(f => f.value ? (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontWeight: 500 }}>{f.value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* 金額摘要 */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#555" }}>金額摘要</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>小計</span>
                <span>${fmt(summary.subtotal)}</span>
              </div>
              {summary.managementFee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#888" }}>管理費</span>
                  <span>${fmt(summary.managementFee)}</span>
                </div>
              )}
              {selectedQuote.taxRate > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#888" }}>工程承攬未稅金額</span>
                    <span>${fmt(summary.beforeTax)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#888" }}>稅金（{selectedQuote.taxRate}%）</span>
                    <span>${fmt(summary.taxAmount)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "2px solid #333", paddingTop: 8, marginTop: 4 }}>
                <span>{selectedQuote.taxRate > 0 ? "總價" : "工程承攬總價"}</span>
                <span style={{ color: "#4a8fa8" }}>${fmt(summary.total)}</span>
              </div>
            </div>
          </div>

          {/* 品項列表 */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#555" }}>品項明細（{selectedItems.filter(it => it.unit !== "__section__").length} 項）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {selectedItems.map((it, i) => {
                if (it.unit === "__section__") {
                  return (
                    <div key={it.id} style={{ background: "#f0f0ee", padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#555", marginTop: 8 }}>
                      {it.itemName}
                    </div>
                  );
                }
                return (
                  <div key={it.id} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <div style={{ fontWeight: 500, flex: 1, marginRight: 8 }}>{it.itemName}</div>
                      <div style={{ fontWeight: 700, color: "#333", whiteSpace: "nowrap" }}>${fmt(it.total)}</div>
                    </div>
                    <div style={{ color: "#aaa", fontSize: 11 }}>
                      {it.unit} × {it.qty} = ${fmt(it.price)}/單位
                      {it.note ? ` · ${it.note}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 備註條款 */}
          {selectedQuote.terms && (
            <div style={{ ...S.card, padding: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#555" }}>備註條款</div>
              <div style={{ color: "#666", whiteSpace: "pre-line", lineHeight: 1.7 }}>{selectedQuote.terms}</div>
            </div>
          )}

          {/* 匯款帳戶 */}
          {selectedQuote.showBankAccount && bankAccount && (
            <div style={{ ...S.card, padding: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#555" }}>匯款帳戶</div>
              <div style={{ color: "#666", lineHeight: 1.8 }}>
                {bankAccount.bankName} {bankAccount.branchName}（{bankAccount.bankCode}）<br />
                戶名：{bankAccount.accountName}<br />
                帳號：{bankAccount.accountNumber}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 列表頁
  return (
    <div style={{ fontFamily: bodyFont, background: "#f7f7f5", minHeight: "100vh" }}>
      {/* 頂部 */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>報價單</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>何為設計</div>
        </div>
        <input
          style={{ ...S.input, fontSize: 14 }}
          placeholder="搜尋案件名稱、客戶…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* 列表 */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#bbb", fontSize: 14 }}>沒有符合的報價單</div>
        ) : filtered.map(q => {
          const items = allItems.filter(it => it.quoteId === q.id).map(calcItem);
          const sum = calcQuoteSummary(items, q);
          return (
            <div
              key={q.id}
              onClick={() => { setSelectedId(q.id); setView("detail"); }}
              style={{
                background: "#fff",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                padding: "14px 16px",
                cursor: "pointer",
                borderLeft: `4px solid ${STATUS_BG[q.status] === "#f5f5f5" ? "#ccc" : "#6aaa8a"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 15, flex: 1, marginRight: 8 }}>{q.name}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#4a8fa8", whiteSpace: "nowrap" }}>
                  {sum.total > 0 ? `$${fmt(sum.total)}` : "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#888" }}>
                {q.clientName && <span>{q.clientName}</span>}
                {q.date && <span>· {q.date}</span>}
                <span style={{
                  marginLeft: "auto",
                  background: STATUS_BG[q.status] || "#f5f5f5",
                  padding: "2px 8px", borderRadius: 10, fontSize: 11,
                }}>
                  {STATUS_LABELS[q.status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div style={{ textAlign: "center", padding: "20px 16px", color: "#ccc", fontSize: 12 }}>
        手機版為唯讀模式，編輯請使用電腦或 iPad
      </div>
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
    <div id="sidebar" style={S.sidebar}>
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

// ─── 報價單列（獨立元件）────────────────────────────────────
function QuoteRow({ q, allItems, settings, sortedProjects, showProjectMenu, setShowProjectMenu, onEdit, onStatusChange, onMoveToProject, onDuplicate, onDelete }) {
  const items = allItems.filter(it => it.quoteId === q.id).map(calcItem);
  const summary = calcQuoteSummary(items, q);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showMenu]);

  return (
    <div
      style={{
        ...S.card, padding: "14px 20px", borderRadius: 4,
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 40px",
        alignItems: "center", gap: 8, cursor: "pointer", transition: "border-color 0.15s", marginBottom: 1,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#ccc"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#e8e8e8"}
      onClick={() => onEdit(q.id)}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          {q.locked && <span title="已鎖定" style={{ fontSize: 12 }}>🔒</span>}
          {q.name}
        </div>
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
          style={{ ...S.select, fontSize: 12, padding: "4px 8px", color: STATUS_COLORS[q.status], fontWeight: 600 }}
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* 三點選單 */}
      <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }} ref={menuRef}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", padding: "2px 6px", borderRadius: 4 }}
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
          onMouseEnter={e => e.target.style.background = "#f0f0f0"}
          onMouseLeave={e => e.target.style.background = "none"}
        >⋯</button>
        {showMenu && (
          <div style={{
            position: "absolute", right: 0, top: 28, zIndex: 50,
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, overflow: "hidden",
          }} onClick={e => e.stopPropagation()}>

            {/* 移至資料夾 */}
            <div style={{ padding: "6px 12px", fontSize: 11, color: "#aaa", borderBottom: "1px solid #f0f0f0" }}>移至資料夾</div>
            <div style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { onMoveToProject(q.id, ""); setShowMenu(false); }}
            >未分類</div>
            {sortedProjects.map(p => (
              <div key={p.id}
                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onClick={() => { onMoveToProject(q.id, p.id); setShowMenu(false); }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                {p.name}
                {q.projectId === p.id && <span style={{ fontSize: 10, color: "#aaa" }}>（目前）</span>}
              </div>
            ))}

            <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 4 }} />

            {/* 複製 */}
            <div style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { onDuplicate(q.id); setShowMenu(false); }}
            >複製報價單</div>

            {/* 匯出 */}
            <div style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => {
                const qItems = allItems.filter(it => it.quoteId === q.id);
                exportQuoteExcel(q, qItems, settings);
                setShowMenu(false);
              }}
            >匯出 Excel</div>

            <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 4 }} />

            {/* 刪除 */}
            <div style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: "#c0675a" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fdf0ee"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { onDelete(q.id); setShowMenu(false); }}
            >刪除</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 報價單列表 ─────────────────────────────────────────────
function QuoteList({ quotes, allItems, settings, onEdit, onNew, onDelete, onDuplicate, onStatusChange, projects, onProjectsChange, onMoveToProject }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [showProjectMenu, setShowProjectMenu] = useState(null); // quoteId
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const PROJECT_COLORS = ["#888", "#6a96b0", "#6aaa8a", "#c9a84c", "#c0675a", "#a06ab0"];

  function toggleProject(id) {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function addProject() {
    if (!newProjectName.trim()) return;
    const newP = {
      id: genId(),
      name: newProjectName.trim(),
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      sortOrder: projects.length + 1,
      createdAt: now(),
      updatedAt: now(),
    };
    onProjectsChange([...projects, newP]);
    setNewProjectName("");
    setShowAddProject(false);
    setExpandedProjects(prev => ({ ...prev, [newP.id]: true }));
  }

  function removeProject(id) {
    if (!confirm("確定刪除此資料夾？報價單會移至未分類。")) return;
    onProjectsChange(projects.filter(p => p.id !== id));
    // 將該資料夾的報價單移至未分類
    quotes.filter(q => q.projectId === id).forEach(q => onMoveToProject(q.id, ""));
  }

  function updateProjectName(id, name) {
    onProjectsChange(projects.map(p => p.id === id ? { ...p, name, updatedAt: now() } : p));
  }

  // 年份排序：名稱開頭的 4 位數字視為年份；無年份的排最下面
  const [yearSortDir, setYearSortDir] = useState(() => localStorage.getItem("whatis_project_sort") || "desc");
  function toggleYearSort() {
    const next = yearSortDir === "desc" ? "asc" : "desc";
    setYearSortDir(next);
    localStorage.setItem("whatis_project_sort", next);
  }
  function extractYear(name) {
    const m = (name || "").trim().match(/^(\d{4})/);
    return m ? Number(m[1]) : null;
  }
  const sortedProjects = [...projects].sort((a, b) => {
    const ya = extractYear(a.name);
    const yb = extractYear(b.name);
    if (ya !== null && yb !== null) {
      if (ya !== yb) return yearSortDir === "desc" ? yb - ya : ya - yb;
      return a.name.localeCompare(b.name, "zh-Hant");
    }
    if (ya !== null) return -1; // 有年份的在前
    if (yb !== null) return 1;  // 無年份的在後
    return a.name.localeCompare(b.name, "zh-Hant");
  });
  const uncategorized = quotes.filter(q => !q.projectId || !projects.find(p => p.id === q.projectId));

  const filtered = quotes.filter(q => {
    const matchSearch = !search || q.name.includes(search) || q.clientName.includes(search) || q.projectName.includes(search);
    const matchStatus = filterStatus === "all" || q.status === filterStatus;
    const matchType = filterType === "all" || q.type === filterType;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const tableHeader = (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 40px",
      padding: "8px 20px", fontSize: 11, color: "#aaa", fontWeight: 600, letterSpacing: 0.5,
    }}>
      <div>報價單名稱</div><div>客戶</div><div>日期</div>
      <div>金額（含稅）</div><div>類型</div><div>狀態</div><div></div>
    </div>
  );

  return (
    <div onClick={() => { setShowNewMenu(false); setShowProjectMenu(null); }}>
      {/* 標題列 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>報價單列表</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>共 {quotes.length} 張</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={S.btnSecondary}
            onClick={e => { e.stopPropagation(); toggleYearSort(); }}
            title="切換資料夾年份排序方向"
          >
            {yearSortDir === "desc" ? "年份 新 → 舊" : "年份 舊 → 新"}
          </button>
          <button style={S.btnSecondary} onClick={e => { e.stopPropagation(); setShowAddProject(!showAddProject); }}>
            ＋ 新增資料夾
          </button>
          <div style={{ position: "relative" }}>
            <button style={S.btn} onClick={e => { e.stopPropagation(); setShowNewMenu(!showNewMenu); }}>
              ＋ 新增報價單
            </button>
            {showNewMenu && (
              <div style={{
                position: "absolute", right: 0, top: 40,
                background: "#fff", border: "1px solid #e0e0e0",
                borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                zIndex: 100, minWidth: 180, overflow: "hidden",
              }} onClick={e => e.stopPropagation()}>
                {[
                  { type: "independent", label: "獨立品項報價" },
                  { type: "integrated", label: "整合式工程報價" },
                  { type: "template", label: "從模板新增" },
                  { type: "addendum", label: "追加減帳報價" },
                ].map(opt => (
                  <button key={opt.type} onClick={() => { setShowNewMenu(false); onNew(opt.type); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 16px", border: "none", background: "transparent", fontSize: 13, color: "#333", cursor: "pointer", fontFamily: "inherit", borderBottom: "1px solid #f0f0f0" }}
                    onMouseEnter={e => e.target.style.background = "#f5f5f5"}
                    onMouseLeave={e => e.target.style.background = "transparent"}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新增資料夾輸入框 */}
      {showAddProject && (
        <div style={{ ...S.card, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <input
            autoFocus
            style={{ ...S.input, flex: 1 }}
            placeholder="資料夾名稱"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addProject(); if (e.key === "Escape") setShowAddProject(false); }}
          />
          <button style={S.btn} onClick={addProject}>建立</button>
          <button style={S.btnSecondary} onClick={() => setShowAddProject(false)}>取消</button>
        </div>
      )}

      {/* 篩選列 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input style={{ ...S.input, width: 260 }} placeholder="搜尋報價單名稱、客戶、專案…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">所有狀態</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select style={S.select} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">所有類型</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* 搜尋結果：不分資料夾顯示 */}
      {search || filterStatus !== "all" || filterType !== "all" ? (
        <div>
          {tableHeader}
          {filtered.length === 0
            ? <div style={{ ...S.card, textAlign: "center", padding: 48, color: "#bbb" }}>沒有符合條件的報價單</div>
            : filtered.map(q => (
                <QuoteRow key={q.id} q={q}
                  allItems={allItems} settings={settings} sortedProjects={sortedProjects}
                  showProjectMenu={showProjectMenu} setShowProjectMenu={setShowProjectMenu}
                  onEdit={onEdit} onStatusChange={onStatusChange} onMoveToProject={onMoveToProject}
                  onDuplicate={onDuplicate} onDelete={onDelete}
                />
              ))
          }
        </div>
      ) : (
        <div>
          {/* 資料夾列表 */}
          {sortedProjects.map(p => {
            const pQuotes = quotes.filter(q => q.projectId === p.id && q.status !== "archived").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            const isOpen = expandedProjects[p.id];
            return (
              <div key={p.id} style={{ marginBottom: 12 }}>
                {/* 資料夾標題 */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: "#f5f5f5",
                    borderRadius: isOpen ? "6px 6px 0 0" : 6,
                    border: "1px solid #e8e8e8",
                    cursor: "pointer", userSelect: "none",
                  }}
                  onClick={() => toggleProject(p.id)}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  {editingProjectId === p.id ? (
                    <input
                      autoFocus
                      style={{ ...S.input, fontSize: 14, fontWeight: 600, flex: 1, padding: "2px 8px" }}
                      value={p.name}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateProjectName(p.id, e.target.value)}
                      onBlur={() => setEditingProjectId(null)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingProjectId(null); }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}
                      onDoubleClick={e => { e.stopPropagation(); setEditingProjectId(p.id); }}
                      title="雙擊修改名稱"
                    >{p.name}</div>
                  )}
                  <div style={{ fontSize: 12, color: "#888" }}>{pQuotes.length} 張</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{isOpen ? "▲" : "▼"}</div>
                  <button
                    style={{ ...S.btnSecondary, padding: "2px 8px", fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); setEditingProjectId(p.id); }}
                  >重命名</button>
                  <button
                    style={{ ...S.btnDanger, padding: "2px 8px", fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); removeProject(p.id); }}
                  >刪除</button>
                </div>

                {/* 資料夾內容 */}
                {isOpen && (
                  <div style={{ border: "1px solid #e8e8e8", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                    {pQuotes.length === 0
                      ? <div style={{ padding: "20px", textAlign: "center", color: "#bbb", fontSize: 13 }}>此資料夾尚無報價單</div>
                      : <>
                          {tableHeader}
                          {pQuotes.map(q => (
                            <QuoteRow key={q.id} q={q}
                              allItems={allItems} settings={settings} sortedProjects={sortedProjects}
                              showProjectMenu={showProjectMenu} setShowProjectMenu={setShowProjectMenu}
                              onEdit={onEdit} onStatusChange={onStatusChange} onMoveToProject={onMoveToProject}
                              onDuplicate={onDuplicate} onDelete={onDelete}
                            />
                          ))}
                        </>
                    }
                  </div>
                )}
              </div>
            );
          })}

          {/* 未分類 */}
          {(() => {
            const isOpen = expandedProjects["__uncategorized__"] !== false;
            const uncategorizedActive = uncategorized.filter(q => q.status !== "archived");
            return (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: "#f9f9f7",
                    borderRadius: isOpen && uncategorizedActive.length > 0 ? "6px 6px 0 0" : 6,
                    border: "1px solid #e8e8e8",
                    cursor: "pointer", userSelect: "none",
                  }}
                  onClick={() => setExpandedProjects(prev => ({ ...prev, __uncategorized__: !isOpen }))}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#bbb", flexShrink: 0 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, flex: 1, color: "#888" }}>未分類</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{uncategorizedActive.length} 張</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{isOpen ? "▲" : "▼"}</div>
                </div>
                {isOpen && uncategorizedActive.length > 0 && (
                  <div style={{ border: "1px solid #e8e8e8", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                    {tableHeader}
                    {uncategorizedActive.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(q => (
                      <QuoteRow key={q.id} q={q}
                        allItems={allItems} settings={settings} sortedProjects={sortedProjects}
                        showProjectMenu={showProjectMenu} setShowProjectMenu={setShowProjectMenu}
                        onEdit={onEdit} onStatusChange={onStatusChange} onMoveToProject={onMoveToProject}
                        onDuplicate={onDuplicate} onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 封存區（未選擇） */}
          {(() => {
            const archivedQuotes = quotes.filter(q => q.status === "archived")
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            if (archivedQuotes.length === 0) return null;
            const isOpen = expandedProjects["__archived__"] === true;
            return (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: "#f5f5f5",
                    borderRadius: isOpen ? "6px 6px 0 0" : 6,
                    border: "1px solid #e8e8e8",
                    cursor: "pointer", userSelect: "none",
                  }}
                  onClick={() => setExpandedProjects(prev => ({ ...prev, __archived__: !isOpen }))}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ccc", flexShrink: 0 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, flex: 1, color: "#aaa" }}>封存（未選擇）</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{archivedQuotes.length} 張</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{isOpen ? "▲" : "▼"}</div>
                </div>
                {isOpen && (
                  <div style={{ border: "1px solid #e8e8e8", borderTop: "none", borderRadius: "0 0 6px 6px", opacity: 0.6 }}>
                    {tableHeader}
                    {archivedQuotes.map(q => (
                      <QuoteRow key={q.id} q={q}
                        allItems={allItems} settings={settings} sortedProjects={sortedProjects}
                        showProjectMenu={showProjectMenu} setShowProjectMenu={setShowProjectMenu}
                        onEdit={onEdit} onStatusChange={onStatusChange} onMoveToProject={onMoveToProject}
                        onDuplicate={onDuplicate} onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
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

  const LOCK_PASSWORD = "82825494";
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockPw, setUnlockPw] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const isLocked = q.locked === true;

  function handleLock() {
    const next = { ...q, locked: true, updatedAt: now() };
    setQ(next);
    onUpdateQuote(next);
  }

  function handleUnlock() {
    if (unlockPw === LOCK_PASSWORD) {
      const next = { ...q, locked: false, updatedAt: now() };
      setQ(next);
      onUpdateQuote(next);
      setShowUnlockInput(false);
      setUnlockPw("");
      setUnlockError("");
    } else {
      setUnlockError("密碼錯誤");
    }
  }
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  async function verifyAndSave() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      // 從 Sheets 讀取目前的 QuoteItems
      const rows = await sheetGet("QuoteItems");
      const sheetsItems = rows.slice(1).filter(r => r[1] === quote.id); // quoteId 在第二欄
      const localItems = its.filter(it => it.quoteId === quote.id);
      const ok = sheetsItems.length === localItems.length;
      setVerifyResult({ ok, sheetsRows: sheetsItems.length, localRows: localItems.length });
    } catch (e) {
      setVerifyResult({ ok: false, sheetsRows: -1, localRows: its.length, error: e.message });
    } finally {
      setVerifying(false);
    }
  }

  async function forceSave() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await sheetPut("QuoteItems", itemsToRows(its));
      if (result.success) {
        setVerifyResult({ ok: true, sheetsRows: result.rows, localRows: its.filter(it => it.quoteId === quote.id).length, forced: true });
        localStorage.removeItem("whatis_quote_cache");
      } else {
        setVerifyResult({ ok: false, error: result.error || "強制儲存失敗", sheetsRows: -1, localRows: its.length });
      }
    } catch (e) {
      setVerifyResult({ ok: false, error: e.message, sheetsRows: -1, localRows: its.length });
    } finally {
      setVerifying(false);
    }
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
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* 鎖定狀態提示 */}
          {isLocked && (
            <div style={{ fontSize: 12, color: "#c9a84c", background: "#fdf6e3", border: "1px solid #f0e0a0", borderRadius: 4, padding: "6px 12px", fontWeight: 600 }}>
              🔒 已鎖定（唯讀）
            </div>
          )}

          {/* 解鎖輸入框 */}
          {showUnlockInput && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                autoFocus
                type="password"
                placeholder="輸入密碼解鎖"
                value={unlockPw}
                onChange={e => { setUnlockPw(e.target.value); setUnlockError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleUnlock(); if (e.key === "Escape") { setShowUnlockInput(false); setUnlockPw(""); setUnlockError(""); } }}
                style={{ ...S.input, width: 140, fontSize: 12, padding: "6px 10px" }}
              />
              <button style={{ ...S.btn, fontSize: 12, padding: "6px 12px" }} onClick={handleUnlock}>確認</button>
              <button style={{ ...S.btnSecondary, fontSize: 12 }} onClick={() => { setShowUnlockInput(false); setUnlockPw(""); setUnlockError(""); }}>取消</button>
              {unlockError && <span style={{ fontSize: 11, color: "#c0675a" }}>{unlockError}</span>}
            </div>
          )}

          {/* 鎖定/解鎖按鈕 */}
          {!showUnlockInput && (
            isLocked ? (
              <button
                style={{ ...S.btnSecondary, fontSize: 12 }}
                onClick={() => setShowUnlockInput(true)}
              >🔓 解鎖編輯</button>
            ) : (
              <button
                style={{ ...S.btnSecondary, fontSize: 12 }}
                onClick={handleLock}
              >🔒 鎖定</button>
            )
          )}

          {/* 驗證結果顯示 */}
          {verifyResult && (
            <div style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 4,
              background: verifyResult.ok ? "#f0f8f4" : "#fdf0ee",
              color: verifyResult.ok ? "#5a8f6a" : "#c0675a",
              border: `1px solid ${verifyResult.ok ? "#c0e0cc" : "#f0c0b8"}`,
              maxWidth: 280,
            }}>
              {verifyResult.ok
                ? `✓ ${verifyResult.forced ? "強制儲存成功" : "驗證通過"}｜Sheets ${verifyResult.sheetsRows} 筆`
                : verifyResult.error
                  ? `⚠ ${verifyResult.error}`
                  : `⚠ 不一致｜Sheets ${verifyResult.sheetsRows} 筆，畫面 ${verifyResult.localRows} 筆`
              }
              {!verifyResult.ok && (
                <button
                  onClick={forceSave}
                  disabled={verifying}
                  style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", border: "1px solid #c0675a", borderRadius: 3, background: "#c0675a", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                >強制儲存</button>
              )}
            </div>
          )}
          {!isLocked && (
            <button
              style={{ ...S.btnSecondary, fontSize: 12 }}
              onClick={verifyAndSave}
              disabled={verifying}
            >{verifying ? "驗證中…" : "驗證儲存"}</button>
          )}
          <button style={S.btnSecondary} onClick={() => setPrintMode("internal")}>內部版預覽</button>
          <button style={S.btn} onClick={() => setPrintMode("client")}>客戶版列印</button>
        </div>
      </div>

      {/* 鎖定時的唯讀遮罩提示 */}
      {isLocked && (
        <div style={{
          background: "#fdf6e3",
          border: "1px solid #f0e0a0",
          borderRadius: 6,
          padding: "10px 16px",
          marginBottom: 20,
          fontSize: 13,
          color: "#c9a84c",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          🔒 此報價單已鎖定，目前為唯讀模式。點右上角「解鎖編輯」並輸入密碼才能修改。
        </div>
      )}

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
        <div style={{ ...S.card, maxWidth: 720, opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? "none" : "auto" }}>
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
          onChange={isLocked ? () => {} : updateIts}
          onApplyTemplate={isLocked ? () => {} : applyTemplate}
          isLocked={isLocked}
        />
      )}

      {/* 費用設定 */}
      {activeSection === "fees" && (
        <div style={{ ...S.card, maxWidth: 600, opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? "none" : "auto" }}>
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
        <div style={{ ...S.card, maxWidth: 600, opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? "none" : "auto" }}>
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

// ─── AI 詢問面板 ─────────────────────────────────────────────
function AiQueryPanel({ categoryName, groupName, onAddItems, onClose }) {
  const [query, setQuery] = useState(`${groupName} / ${categoryName} / `);
  const [pasteText, setPasteText] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState("");
  const [step, setStep] = useState("query"); // query | paste | review
  const [selectedAi, setSelectedAi] = useState("Claude");

  const AI_OPTIONS = [
    { name: "Claude",  url: "https://claude.ai",          color: "#c9693a", bg: "#fdf3ee" },
    { name: "ChatGPT", url: "https://chatgpt.com",         color: "#10a37f", bg: "#edfaf5" },
    { name: "Gemini",  url: "https://gemini.google.com",   color: "#4285f4", bg: "#eef3fd" },
  ];

  // 各 AI 的提示詞
  const promptTexts = {
    Claude: `我是台灣室內設計師，需要報價以下品項，請用表格回覆，欄位為：品項名稱、單位、數量、成本單價（台灣市場2024-2025行情）、建議利潤乘數（1.3~1.6之間）、備註。

品項：${query}

要求：
1. 拆解成完整的施工細項（例如桶身、門片、五金、安裝工資等）
2. 成本單價為台灣市場實際行情（不含利潤）
3. 建議乘數依工種難度設定（簡單工種1.3、中等1.4、複雜1.5-1.6）
4. 只輸出表格，不要其他說明文字`,

    ChatGPT: `我是台灣室內設計師，需要報價以下品項，請嚴格按照格式輸出表格，不得有任何額外說明、前言、後記或格式符號。

品項：${query}

輸出格式（每欄用 | 分隔，不要用 Markdown 的 --- 分隔線，不要用 code block）：
品項名稱 | 單位 | 數量 | 成本單價 | 建議乘數 | 備註

嚴格規則：
1. 第一行輸出欄位標題，之後每行一個施工細項
2. 拆解成完整施工細項（桶身、門片、五金、安裝工資等）
3. 成本單價為台灣市場2024-2025實際行情（不含利潤）
4. 建議乘數：簡單工種1.3、中等1.4、複雜1.5-1.6
5. 所有數字去除千分位逗號，只輸出純數字
6. 不要輸出任何表格以外的文字，不要使用 Markdown 格式
7. 使用繁體中文`,

    Gemini: `我是台灣室內設計師，需要報價以下品項，請使用繁體中文，輸出純文字格式的表格。

品項：${query}

輸出格式（用 | 符號分隔每個欄位）：
品項名稱 | 單位 | 數量 | 成本單價 | 建議乘數 | 備註

處理規則：
1. 第一行是欄位標題，之後每行一個施工細項
2. 拆解成完整施工細項（桶身、門片、五金、安裝工資等）
3. 成本單價為台灣市場2024-2025實際行情（不含利潤）
4. 建議乘數：簡單工種1.3、中等1.4、複雜1.5-1.6
5. 數字去掉千分位逗號，只保留純數字
6. 只輸出表格內容，不要任何前言、說明或結語
7. 不要用 Markdown 的 \`\`\` 包住輸出，全程使用繁體中文`,
  };

  function handleCopyAndOpen(aiName, aiUrl) {
    const prompt = promptTexts[aiName] || promptTexts.Claude;
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open(aiUrl, "_blank");
    setSelectedAi(aiName);
    setStep("paste");
  }

  function handleParse() {
    setParseError("");
    const lines = pasteText.trim().split("\n").filter(l => l.trim() && !l.startsWith("---"));
    const items = [];

    for (const line of lines) {
      const parts = line.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length < 4) continue;
      // 跳過表頭行
      if (parts[0].includes("品項") || parts[0].includes("名稱") || parts[0] === "#") continue;

      const itemName = parts[0] || "";
      const unit = parts[1] || "式";
      const qty = parseFloat(parts[2]) || 1;
      const cost = parseFloat(parts[3]?.replace(/,/g, "")) || 0;
      const multiplier = parseFloat(parts[4]) || 1.4;
      const note = parts[5] || "";

      if (itemName && cost > 0) {
        items.push({
          id: genId(),
          itemName,
          unit,
          qty,
          cost,
          multiplier,
          price: Math.round(cost * multiplier),
          priceOverride: false,
          note,
          selected: true,
        });
      }
    }

    if (items.length === 0) {
      setParseError("無法解析表格，請確認格式是否為以 | 分隔的表格");
      return;
    }
    setParsedItems(items);
    setStep("review");
  }

  function toggleItem(id) {
    setParsedItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  }

  function updateParsedItem(id, patch) {
    setParsedItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  function handleAddSelected() {
    const selected = parsedItems.filter(it => it.selected);
    if (selected.length === 0) return;
    onAddItems(selected);
    onClose();
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
      background: "#fff", borderLeft: "1px solid #e0e0e0",
      boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
      zIndex: 200, display: "flex", flexDirection: "column",
      fontFamily: '"微軟正黑體","Microsoft JhengHei","PingFang TC",sans-serif',
    }}>
      {/* 標題列 */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>報價參考詢問</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{groupName} / {categoryName}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", padding: "4px 8px" }}>✕</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>

        {/* Step 1：輸入品項 */}
        {step === "query" && (
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              描述你要詢問的品項（位置 / 工種 / 品項名稱 + 尺寸規格）
            </div>
            <textarea
              style={{
                ...S.input, height: 80, resize: "none", marginBottom: 12,
                fontSize: 13, lineHeight: 1.6,
              }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`例：主臥室 / 系統櫃工程 / 高櫃體 W90×H240×D60`}
            />
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16, padding: "10px 12px", background: "#f9f9f9", borderRadius: 4, lineHeight: 1.7 }}>
              選擇 AI 後，系統自動複製提示詞並開啟該平台。
              貼上提示詞（Ctrl+V）→ 取得回覆 → 複製表格回來。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AI_OPTIONS.map(ai => (
                <button
                  key={ai.name}
                  style={{
                    width: "100%", padding: "10px 16px",
                    borderRadius: 4, border: `1px solid ${ai.color}`,
                    background: ai.bg, color: ai.color,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", textAlign: "left",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                  onClick={() => handleCopyAndOpen(ai.name, ai.url)}
                >
                  <span>開始詢問 + 開啟 {ai.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2：貼上回覆 */}
        {step === "paste" && (
          <div>
            <div style={{ fontSize: 12, color: "#6aaa8a", marginBottom: 12, padding: "10px 12px", background: "#f0f8f4", borderRadius: 4 }}>
              ✓ 提示詞已複製，請到 {selectedAi} 貼上後，把回覆的表格複製回來
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>將 {selectedAi} 回覆的表格貼到下方：</div>
            <textarea
              style={{ ...S.input, height: 200, resize: "vertical", fontSize: 12, fontFamily: "monospace" }}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"品項名稱 | 單位 | 數量 | 成本單價 | 建議乘數 | 備註\n桶身（塑合板） | 才 | 48 | 280 | 1.4 | ...\n..."}
            />
            {parseError && <div style={{ fontSize: 12, color: "#c0675a", marginTop: 6 }}>{parseError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={S.btnSecondary} onClick={() => setStep("query")}>← 重新詢問</button>
              <button style={{ ...S.btn, flex: 1 }} onClick={handleParse} disabled={!pasteText.trim()}>
                解析表格
              </button>
            </div>
          </div>
        )}

        {/* Step 3：確認品項 */}
        {step === "review" && (
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              解析出 {parsedItems.length} 個品項，勾選要加入的，可直接修改數值：
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {parsedItems.map(it => (
                <div key={it.id} style={{
                  border: `1px solid ${it.selected ? "#ccc" : "#f0f0f0"}`,
                  borderRadius: 4, padding: "10px 12px",
                  background: it.selected ? "#fff" : "#fafafa",
                  opacity: it.selected ? 1 : 0.5,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={it.selected} onChange={() => toggleItem(it.id)} />
                    <input
                      style={{ ...S.input, fontSize: 13, fontWeight: 600 }}
                      value={it.itemName}
                      onChange={e => updateParsedItem(it.id, { itemName: e.target.value })}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { label: "單位", key: "unit", type: "text" },
                      { label: "數量", key: "qty", type: "number" },
                      { label: "成本單價", key: "cost", type: "number" },
                      { label: "乘數", key: "multiplier", type: "number" },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>{f.label}</div>
                        <input
                          style={{ ...S.input, fontSize: 12, padding: "4px 8px" }}
                          type={f.type}
                          value={it[f.key]}
                          onChange={e => updateParsedItem(it.id, { [f.key]: f.type === "number" ? toNum(e.target.value) : e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                    報價單價：${fmt(Math.round(toNum(it.cost) * toNum(it.multiplier)))} · 備註：{it.note || "—"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={S.btnSecondary} onClick={() => setStep("paste")}>← 重新貼上</button>
              <button
                style={{ ...S.btn, flex: 1 }}
                onClick={handleAddSelected}
                disabled={!parsedItems.some(it => it.selected)}
              >
                加入報價單（{parsedItems.filter(it => it.selected).length} 項）
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 匯入廠商報價面板 ────────────────────────────────────────
function ImportQuotePanel({ categoryName, groupName, onAddItems, onClose }) {
  const [pasteText, setPasteText] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState("");
  const [step, setStep] = useState("guide"); // guide | paste | review
  const [batchMultiplier, setBatchMultiplier] = useState("");
  const [selectedAi, setSelectedAi] = useState("Claude");

  const AI_OPTIONS = [
    { name: "Claude",  url: "https://claude.ai",          color: "#c9693a", bg: "#fdf3ee" },
    { name: "ChatGPT", url: "https://chatgpt.com",         color: "#10a37f", bg: "#edfaf5" },
    { name: "Gemini",  url: "https://gemini.google.com",   color: "#4285f4", bg: "#eef3fd" },
  ];

  const promptTexts = {
    Claude: `請解析以下附件（廠商報價單），將所有品項整理成表格輸出。

輸出格式（用 | 分隔欄位）：
品項名稱 | 單位 | 數量 | 單價 | 總價 | 備註

規則：
1. 如果只有總價沒有單價，請自動計算：單價 = 總價 ÷ 數量
2. 如果只有單價沒有總價，請自動計算：總價 = 單價 × 數量
3. 數字去除千分位符號（逗號），只輸出純數字
4. 第一行輸出欄位標題，之後每行一個品項
5. 只輸出表格，不要其他說明文字`,

    ChatGPT: `請解析附件中的廠商報價單，嚴格按照以下格式輸出，不得有任何額外說明、前言、後記或格式符號。

輸出格式（每欄用 | 分隔，不要用 Markdown 的 --- 分隔線，不要用 code block）：
品項名稱 | 單位 | 數量 | 單價 | 總價 | 備註

嚴格規則：
1. 第一行輸出欄位標題，之後每行一個品項
2. 如果只有總價沒有單價：單價 = 總價 ÷ 數量（四捨五入到整數）
3. 如果只有單價沒有總價：總價 = 單價 × 數量
4. 所有數字去除千分位逗號，只輸出純數字
5. 不要輸出任何表格以外的文字
6. 不要使用 Markdown 格式
7. 使用繁體中文`,

    Gemini: `請分析附件中的廠商報價單，使用繁體中文，輸出純文字格式的表格。

輸出格式（用 | 符號分隔每個欄位）：
品項名稱 | 單位 | 數量 | 單價 | 總價 | 備註

處理規則：
1. 第一行是欄位標題，之後每行代表一個報價品項
2. 如果只有總價沒有單價：計算 單價 = 總價 ÷ 數量
3. 如果只有單價沒有總價：計算 總價 = 單價 × 數量
4. 數字去掉千分位逗號，只保留純數字
5. 只輸出表格內容，不要任何前言、說明或結語
6. 不要用 Markdown 的 \`\`\` 包住輸出
7. 全程使用繁體中文`,
  };

  function handleCopyAndOpen(aiName, aiUrl) {
    const prompt = promptTexts[aiName] || promptTexts.Claude;
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open(aiUrl, "_blank");
    setSelectedAi(aiName);
    setStep("paste");
  }

  function handleParse() {
    setParseError("");
    const lines = pasteText.trim().split("\n").filter(l => l.trim());
    const items = [];

    for (const line of lines) {
      const parts = line.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) continue;
      // 跳過表頭
      if (parts[0].includes("品項") || parts[0].includes("名稱") || parts[0] === "#") continue;

      const itemName = parts[0] || "";
      const unit = parts[1] || "式";
      const qty = parseFloat(parts[2]?.replace(/,/g, "")) || 1;
      let cost = parseFloat(parts[3]?.replace(/,/g, "")) || 0;
      const totalPrice = parseFloat(parts[4]?.replace(/,/g, "")) || 0;
      const note = parts[5] || "";

      // 只有總價沒有單價時，自動計算
      if (!cost && totalPrice && qty) {
        cost = Math.round(totalPrice / qty);
      }

      if (itemName && (cost > 0 || totalPrice > 0)) {
        items.push({
          id: genId(),
          itemName,
          unit,
          qty,
          originalQty: qty,
          cost,
          multiplier: "",
          note,
          selected: true,
        });
      }
    }

    if (items.length === 0) {
      setParseError("無法解析表格，請確認格式是否為以 | 分隔的表格，或重新複製 Claude 的回覆");
      return;
    }
    setParsedItems(items);
    setStep("review");
  }

  function toggleItem(id) {
    setParsedItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  }

  function updateItem(id, patch) {
    setParsedItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, ...patch };
      // 數量有修改時，備註加上原廠數量
      if (patch.qty !== undefined && patch.qty !== it.originalQty) {
        const base = it.note.replace(/（原廠數量：[\d.]+）/, "").trim();
        updated.note = base ? `${base}（原廠數量：${it.originalQty}）` : `原廠數量：${it.originalQty}`;
      }
      return updated;
    }));
  }

  function applyBatchMultiplier() {
    const m = parseFloat(batchMultiplier);
    if (!m || m <= 0) return;
    setParsedItems(prev => prev.map(it => ({ ...it, multiplier: m })));
  }

  function handleAddSelected() {
    const selected = parsedItems.filter(it => it.selected);
    if (selected.length === 0) return;
    onAddItems(selected);
    onClose();
  }

  const panelStyle = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 500,
    background: "#fff", borderLeft: "1px solid #e0e0e0",
    boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
    zIndex: 200, display: "flex", flexDirection: "column",
    fontFamily: '"微軟正黑體","Microsoft JhengHei","PingFang TC",sans-serif',
  };

  return (
    <div style={panelStyle}>
      {/* 標題列 */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>匯入廠商報價</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{groupName} / {categoryName}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", padding: "4px 8px" }}>✕</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>

        {/* Step 1：說明 */}
        {step === "guide" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#555" }}>使用步驟</div>
            {[
              "點下方按鈕，系統自動複製解析提示詞並開啟 Claude.ai",
              "在 Claude.ai 上傳廠商報價單（圖片、PDF 或 Excel 截圖）",
              "貼上提示詞（Ctrl+V）送出",
              "複製 Claude 回覆的表格，回到這裡貼上",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#333", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, paddingTop: 2 }}>{s}</div>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: "12px", background: "#f9f9f7", borderRadius: 4, fontSize: 11, color: "#aaa", lineHeight: 1.7 }}>
              支援格式：圖片（JPG/PNG）、PDF、Excel 截圖<br />
              不論廠商格式如何，AI 都能自動識別欄位
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>選擇 AI 平台：</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {AI_OPTIONS.map(ai => (
                  <button
                    key={ai.name}
                    style={{
                      width: "100%", padding: "10px 16px",
                      borderRadius: 4, border: `1px solid ${ai.color}`,
                      background: ai.bg, color: ai.color,
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                    onClick={() => handleCopyAndOpen(ai.name, ai.url)}
                  >
                    <span>複製提示詞 + 開啟 {ai.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2：貼上回覆 */}
        {step === "paste" && (
          <div>
            <div style={{ fontSize: 12, color: "#6aaa8a", marginBottom: 12, padding: "10px 12px", background: "#f0f8f4", borderRadius: 4 }}>
              ✓ 提示詞已複製，請上傳廠商報價單到 {selectedAi}，取得回覆後把表格複製回來
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>將 Claude 回覆的表格貼到下方：</div>
            <textarea
              style={{ ...S.input, height: 220, resize: "vertical", fontSize: 12, fontFamily: "monospace" }}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"品項名稱 | 單位 | 數量 | 單價 | 總價 | 備註\n矽酸鈣板 9mm | 才 | 120 | 35 | 4200 | 防火\n輕鋼架 | 支 | 30 | 85 | 2550 |\n..."}
            />
            {parseError && (
              <div style={{ fontSize: 12, color: "#c0675a", marginTop: 6, padding: "8px 12px", background: "#fdf0ee", borderRadius: 4 }}>
                {parseError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={S.btnSecondary} onClick={() => setStep("guide")}>← 返回</button>
              <button
                style={{ ...S.btn, flex: 1 }}
                onClick={handleParse}
                disabled={!pasteText.trim()}
              >解析表格</button>
            </div>
          </div>
        )}

        {/* Step 3：預覽和編輯 */}
        {step === "review" && (
          <div>
            {/* 批次設定乘數 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "10px 12px", background: "#f9f9f7", borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: "#555", whiteSpace: "nowrap" }}>批次設定乘數：</span>
              <input
                style={{ ...S.input, width: 80, padding: "6px 10px", fontSize: 13 }}
                type="number"
                step="0.1"
                placeholder="1.3"
                value={batchMultiplier}
                onChange={e => setBatchMultiplier(e.target.value)}
              />
              <button
                style={{ ...S.btnSecondary, padding: "6px 14px", fontSize: 12, whiteSpace: "nowrap" }}
                onClick={applyBatchMultiplier}
                disabled={!batchMultiplier}
              >套用全部</button>
            </div>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              解析出 {parsedItems.length} 個品項，勾選要加入的項目：
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {parsedItems.map(it => (
                <div key={it.id} style={{
                  border: `1px solid ${it.selected ? "#ddd" : "#f0f0f0"}`,
                  borderRadius: 4, padding: "10px 12px",
                  background: it.selected ? "#fff" : "#fafafa",
                  opacity: it.selected ? 1 : 0.5,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={it.selected} onChange={() => toggleItem(it.id)} />
                    <input
                      style={{ ...S.input, fontSize: 13, fontWeight: 500 }}
                      value={it.itemName}
                      onChange={e => updateItem(it.id, { itemName: e.target.value })}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { label: "單位", key: "unit", type: "text" },
                      { label: "數量", key: "qty", type: "number" },
                      { label: "成本單價", key: "cost", type: "number" },
                      { label: "乘數", key: "multiplier", type: "number" },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>{f.label}</div>
                        <input
                          style={{ ...S.input, fontSize: 12, padding: "4px 8px" }}
                          type={f.type}
                          value={it[f.key]}
                          placeholder={f.key === "multiplier" ? "待設定" : ""}
                          onChange={e => updateItem(it.id, { [f.key]: f.type === "number" ? toNum(e.target.value) : e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  {it.note && (
                    <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>備註：{it.note}</div>
                  )}
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                    報價單價：${fmt(Math.round(toNum(it.cost) * (toNum(it.multiplier) || 1)))}
                    {it.multiplier ? ` （乘數 ${it.multiplier}）` : "（乘數待設定）"}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={S.btnSecondary} onClick={() => setStep("paste")}>← 重新貼上</button>
              <button
                style={{ ...S.btn, flex: 1 }}
                onClick={handleAddSelected}
                disabled={!parsedItems.some(it => it.selected)}
              >
                加入報價單（{parsedItems.filter(it => it.selected).length} 項）
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 品項編輯器 ─────────────────────────────────────────────
function ItemsEditor({ quote, items, settings, templates, onChange, onApplyTemplate }) {
  const isIntegrated = quote.type === "integrated";
  const groups = settings.engineering_groups || [];
  const categories = settings.engineering_categories || [];

  // AI 詢問面板狀態
  const [aiPanel, setAiPanel] = useState(null);
  // 匯入廠商報價面板狀態
  const [importPanel, setImportPanel] = useState(null);
  // 批次倍率輸入狀態 { [catKey]: value }
  const [batchMultipliers, setBatchMultipliers] = useState({});

  function applyBatchMultiplier(groupId, catId) {
    const key = `${groupId}||${catId}`;
    const val = parseFloat(batchMultipliers[key]);
    if (!val || val <= 0) return;
    const updated = items.map(it => {
      if (it.group === groupId && it.category === catId && it.unit !== "__section__") {
        return { ...it, multiplier: val, priceOverride: false, updatedAt: now() };
      }
      return it;
    });
    onChange(updated);
    setBatchMultipliers(prev => ({ ...prev, [key]: "" }));
  } // { groupName, categoryName, groupId, categoryId }

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

  function addSection(group, category) {
    const newSection = {
      id: genId(),
      quoteId: quote.id,
      group: group || "",
      category: category || "",
      position: "",
      itemName: "新標題",
      unit: "__section__",
      qty: 0,
      cost: 0,
      multiplier: 0,
      price: 0,
      priceOverride: false,
      total: 0,
      note: "",
      sortOrder: items.length,
      updatedAt: now(),
    };
    onChange([...items, newSection]);
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

  function reorderItem(sourceId, targetId) {
    const srcIdx = items.findIndex(it => it.id === sourceId);
    const tgtIdx = items.findIndex(it => it.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return;
    const next = [...items];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    onChange(next.map((it, i) => ({ ...it, sortOrder: i })));
  }

  function insertItemAfter(afterId) {
    const idx = items.findIndex(it => it.id === afterId);
    const afterItem = items[idx];
    const newItem = {
      id: genId(),
      quoteId: quote.id,
      group: afterItem?.group || "",
      category: afterItem?.category || "",
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
      sortOrder: 0,
      updatedAt: now(),
    };
    const next = [...items];
    next.splice(idx + 1, 0, newItem);
    onChange(next.map((it, i) => ({ ...it, sortOrder: i })));
  }

  // 獨立品項：直接顯示列表
  if (!isIntegrated) {
    const showPosition = true;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#888" }}>共 {items.length} 個品項</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* 批次倍率 */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                step="0.1"
                placeholder="批次倍率"
                value={batchMultipliers["__independent__"] || ""}
                onChange={e => setBatchMultipliers(prev => ({ ...prev, "__independent__": e.target.value }))}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = parseFloat(batchMultipliers["__independent__"]);
                    if (!val || val <= 0) return;
                    const updated = items.map(it =>
                      it.unit !== "__section__" ? { ...it, multiplier: val, priceOverride: false, updatedAt: now() } : it
                    );
                    onChange(updated);
                    setBatchMultipliers(prev => ({ ...prev, "__independent__": "" }));
                  }
                }}
                style={{ ...S.input, width: 90, padding: "6px 8px", fontSize: 12 }}
              />
              <button
                style={{ ...S.btnSecondary, padding: "6px 10px", fontSize: 12 }}
                onClick={() => {
                  const val = parseFloat(batchMultipliers["__independent__"]);
                  if (!val || val <= 0) return;
                  const updated = items.map(it =>
                    it.unit !== "__section__" ? { ...it, multiplier: val, priceOverride: false, updatedAt: now() } : it
                  );
                  onChange(updated);
                  setBatchMultipliers(prev => ({ ...prev, "__independent__": "" }));
                }}
                title="套用此倍率到所有品項"
              >套用</button>
            </div>
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
            <button
              style={S.btnSecondary}
              onClick={() => setAiPanel({ groupName: "獨立品項", categoryName: "報價參考", groupId: "", categoryId: "" })}
            >詢問</button>
            <button
              style={S.btnSecondary}
              onClick={() => setImportPanel({ groupName: "獨立品項", categoryName: "廠商報價", groupId: "", categoryId: "" })}
            >匯入廠商報價</button>
            <button style={S.btnSecondary} onClick={() => addSection("", "")}>＋ 分隔標題</button>
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
          onReorder={reorderItem}
          onInsertAfter={insertItemAfter}
        />

        {/* AI 詢問面板 */}
        {aiPanel && (
          <AiQueryPanel
            groupName={aiPanel.groupName}
            categoryName={aiPanel.categoryName}
            onAddItems={(newItems) => {
              const toAdd = newItems.map((it, i) => ({
                id: genId(), quoteId: quote.id,
                group: "", category: "", position: "",
                itemName: it.itemName, unit: it.unit || "式",
                qty: toNum(it.qty) || 1, cost: toNum(it.cost),
                multiplier: toNum(it.multiplier) || 1.4,
                price: Math.round(toNum(it.cost) * (toNum(it.multiplier) || 1.4)),
                priceOverride: false,
                total: Math.round(toNum(it.cost) * (toNum(it.multiplier) || 1.4) * (toNum(it.qty) || 1)),
                note: it.note || "", sortOrder: items.length + i, updatedAt: now(),
              }));
              onChange([...items, ...toAdd]);
            }}
            onClose={() => setAiPanel(null)}
          />
        )}

        {/* 匯入廠商報價面板 */}
        {importPanel && (
          <ImportQuotePanel
            groupName={importPanel.groupName}
            categoryName={importPanel.categoryName}
            onAddItems={(newItems) => {
              const toAdd = newItems.map((it, i) => ({
                id: genId(), quoteId: quote.id,
                group: "", category: "", position: "",
                itemName: it.itemName, unit: it.unit || "式",
                qty: toNum(it.qty) || 1, cost: toNum(it.cost),
                multiplier: toNum(it.multiplier) || 0,
                price: it.multiplier ? Math.round(toNum(it.cost) * toNum(it.multiplier)) : 0,
                priceOverride: false,
                total: it.multiplier ? Math.round(toNum(it.cost) * toNum(it.multiplier) * (toNum(it.qty) || 1)) : 0,
                note: it.note || "", sortOrder: items.length + i, updatedAt: now(),
              }));
              onChange([...items, ...toAdd]);
            }}
            onClose={() => setImportPanel(null)}
          />
        )}
      </div>
    );
  }

  // 整合式：按群組/大項分層
  const activeCategories = categories
    .filter(c => c.active !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const sortedGroups = [...groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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

      {sortedGroups.map(g => {
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
                      {/* 批次倍率 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="批次倍率"
                          value={batchMultipliers[`${g.id}||${cat.id}`] || ""}
                          onChange={e => setBatchMultipliers(prev => ({ ...prev, [`${g.id}||${cat.id}`]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && applyBatchMultiplier(g.id, cat.id)}
                          style={{ ...S.input, width: 80, padding: "4px 8px", fontSize: 12 }}
                        />
                        <button
                          style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}
                          onClick={() => applyBatchMultiplier(g.id, cat.id)}
                          title="套用此倍率到所有品項"
                        >套用</button>
                      </div>
                      <button
                        style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => setAiPanel({ groupName: g.name, categoryName: cat.name, groupId: g.id, categoryId: cat.id })}
                      >詢問</button>
                      <button
                        style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => setImportPanel({ groupName: g.name, categoryName: cat.name, groupId: g.id, categoryId: cat.id })}
                      >匯入廠商報價</button>
                      <button
                        style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => addSection(g.id, cat.id)}
                      >＋ 分隔標題</button>
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
                      onReorder={reorderItem}
          onInsertAfter={insertItemAfter}
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
                      onReorder={reorderItem}
          onInsertAfter={insertItemAfter}
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
                      onReorder={reorderItem}
          onInsertAfter={insertItemAfter}
          />
        </div>
      )}

      {/* 在此群組外新增 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {sortedGroups.map(g => (
          <button key={g.id} style={S.btnSecondary} onClick={() => addItem(g.id, "")}>
            ＋ {g.name}
          </button>
        ))}
        <button style={S.btnSecondary} onClick={() => addItem("", "")}>＋ 其他品項</button>
      </div>

      {/* AI 詢問面板 */}
      {aiPanel && (
        <AiQueryPanel
          groupName={aiPanel.groupName}
          categoryName={aiPanel.categoryName}
          onAddItems={(newItems) => {
            const toAdd = newItems.map((it, i) => ({
              id: genId(),
              quoteId: quote.id,
              group: aiPanel.groupId,
              category: aiPanel.categoryId,
              position: "",
              itemName: it.itemName,
              unit: it.unit || "式",
              qty: toNum(it.qty) || 1,
              cost: toNum(it.cost),
              multiplier: toNum(it.multiplier) || 1.4,
              price: Math.round(toNum(it.cost) * (toNum(it.multiplier) || 1.4)),
              priceOverride: false,
              total: Math.round(toNum(it.cost) * (toNum(it.multiplier) || 1.4) * (toNum(it.qty) || 1)),
              note: it.note || "",
              sortOrder: items.length + i,
              updatedAt: now(),
            }));
            onChange([...items, ...toAdd]);
          }}
          onClose={() => setAiPanel(null)}
        />
      )}

      {/* 匯入廠商報價面板 */}
      {importPanel && (
        <ImportQuotePanel
          groupName={importPanel.groupName}
          categoryName={importPanel.categoryName}
          onAddItems={(newItems) => {
            const toAdd = newItems.map((it, i) => ({
              id: genId(),
              quoteId: quote.id,
              group: importPanel.groupId,
              category: importPanel.categoryId,
              position: "",
              itemName: it.itemName,
              unit: it.unit || "式",
              qty: toNum(it.qty) || 1,
              cost: toNum(it.cost),
              multiplier: toNum(it.multiplier) || 0,
              price: it.multiplier ? Math.round(toNum(it.cost) * toNum(it.multiplier)) : 0,
              priceOverride: false,
              total: it.multiplier ? Math.round(toNum(it.cost) * toNum(it.multiplier) * (toNum(it.qty) || 1)) : 0,
              note: it.note || "",
              sortOrder: items.length + i,
              updatedAt: now(),
            }));
            onChange([...items, ...toAdd]);
          }}
          onClose={() => setImportPanel(null)}
        />
      )}
    </div>
  );
}

// ─── 品項表格 ───────────────────────────────────────────────
function ItemTable({ items, showPosition, showGroupCategory, onUpdate, onRemove, onMove, onReorder, onInsertAfter }) {
  const colWidths = showPosition
    ? "24px 60px 60px 1fr 60px 80px 90px 90px 90px 90px 80px 50px"
    : "24px 60px 1fr 60px 80px 90px 90px 90px 90px 80px 50px";

  const [dragOverId, setDragOverId] = useState(null);

  function handleDragOver(e, targetId) {
    e.preventDefault();
    setDragOverId(targetId);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("itemId");
    if (sourceId && sourceId !== targetId && onReorder) {
      onReorder(sourceId, targetId);
    }
    setDragOverId(null);
  }

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
        <div></div>
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
        it.unit === "__section__" ? (
          <SectionRow
            key={it.id}
            item={it}
            isDragOver={dragOverId === it.id}
            onUpdate={(patch) => onUpdate(it.id, patch)}
            onRemove={() => onRemove(it.id)}
            onInsertAfter={() => onInsertAfter && onInsertAfter(it.id)}
            onDragOver={(e) => handleDragOver(e, it.id)}
            onDrop={(e) => handleDrop(e, it.id)}
            onDragLeave={() => setDragOverId(null)}
          />
        ) : (
          <ItemRow
            key={it.id}
            item={it}
            index={idx + 1}
            showPosition={showPosition}
            colWidths={colWidths}
            isDragOver={dragOverId === it.id}
            onUpdate={(patch) => onUpdate(it.id, patch)}
            onRemove={() => onRemove(it.id)}
            onMoveUp={() => onMove(it.id, "up")}
            onMoveDown={() => onMove(it.id, "down")}
            onInsertAfter={() => onInsertAfter && onInsertAfter(it.id)}
            onDragOver={(e) => handleDragOver(e, it.id)}
            onDrop={(e) => handleDrop(e, it.id)}
            onDragLeave={() => setDragOverId(null)}
          />
        )
      ))}

      {items.length === 0 && (
        <div style={{ padding: "16px 8px", color: "#ccc", fontSize: 12, textAlign: "center" }}>
          尚無品項
        </div>
      )}
    </div>
  );
}

// ─── 分隔標題列 ─────────────────────────────────────────────
function SectionRow({ item, isDragOver, onUpdate, onRemove, onDragOver, onDrop, onDragLeave, onInsertAfter }) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("itemId", item.id)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: isDragOver ? "#e8e8e6" : "#f0f0ee",
        borderBottom: isDragOver ? "2px solid #888" : "1px solid #e8e8e6",
        borderRadius: 3,
        margin: "8px 0 4px",
        cursor: "grab",
      }}
    >
      {/* 拖拉把手 */}
      <div style={{ color: "#bbb", fontSize: 13, userSelect: "none" }}>⠿</div>

      {/* 標題文字 */}
      {editing ? (
        <input
          autoFocus
          style={{
            flex: 1, border: "none", background: "transparent",
            fontSize: 13, fontWeight: 600, color: "#444",
            outline: "1px solid #ccc", borderRadius: 3, padding: "2px 6px",
            fontFamily: '"微軟正黑體","Microsoft JhengHei","PingFang TC",sans-serif',
          }}
          value={item.itemName}
          onChange={e => onUpdate({ itemName: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={e => e.key === "Enter" && setEditing(false)}
        />
      ) : (
        <div
          style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#444", cursor: "text", letterSpacing: 0.5 }}
          onClick={() => setEditing(true)}
          title="點擊修改標題"
        >
          {item.itemName || "（點擊輸入標題）"}
        </div>
      )}

      {/* 刪除按鈕 */}
      {hover && (
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 14, padding: "2px 6px" }}
          onMouseEnter={e => e.target.style.color = "#c0675a"}
          onMouseLeave={e => e.target.style.color = "#bbb"}
        >✕</button>
      )}
    </div>

    {/* 插入線 */}
    {hover && onInsertAfter && (
      <div
        onClick={onInsertAfter}
        style={{
          position: "absolute", bottom: -1, left: 0, right: 0,
          height: 6, zIndex: 10, cursor: "pointer",
          display: "flex", alignItems: "center",
        }}
        title="在此處插入新品項"
      >
        <div style={{ width: "100%", height: 2, background: "#888", position: "relative", display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", left: 8, width: 16, height: 16, borderRadius: "50%", background: "#888", color: "#fff", fontSize: 14, lineHeight: "16px", textAlign: "center", marginTop: -1 }}>＋</div>
        </div>
      </div>
    )}
    </div>
  );
}

function ItemRow({ item, index, showPosition, colWidths, onUpdate, onRemove, onMoveUp, onMoveDown, onDragOver, onDrop, onDragLeave, isDragOver, onInsertAfter }) {
  const [hover, setHover] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [priceRef, setPriceRef] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [memoText, setMemoText] = useState(item.tagMemo || "");
  const tagMenuRef = useRef(null);
  const priceRefEl = useRef(null);

  const currentTag = ITEM_TAGS.find(t => t.id === item.tag);

  // 點擊外部關閉標籤選單
  useEffect(() => {
    if (!showTagMenu) return;
    function handleOutside(e) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target)) {
        setShowTagMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showTagMenu]);

  // 點擊外部關閉行情下拉
  useEffect(() => {
    if (!priceRef) return;
    function handleOutside(e) {
      if (priceRefEl.current && !priceRefEl.current.contains(e.target)) {
        setPriceRef(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [priceRef]);

  function handleTagSelect(tagId) {
    if (tagId === item.tag) {
      onUpdate({ tag: null, tagMemo: null });
    } else {
      onUpdate({ tag: tagId, tagMemo: tagId === "memo" ? memoText : null });
    }
    if (tagId !== "memo") setShowTagMenu(false);
  }

  function handleMemoSave() {
    onUpdate({ tag: "memo", tagMemo: memoText });
    setShowTagMenu(false);
  }

  async function handleNameBlur(name) {
    if (!name || name.length < 3) return;
    setSearching(true);
    try {
      const res = await searchPriceDB(name);
      if (res.results && res.results.length > 0) {
        setPriceRef(res.results);
      } else {
        setPriceRef(null);
      }
    } catch (e) {
      setPriceRef(null);
    } finally {
      setSearching(false);
    }
  }
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
      style={{ position: "relative" }}
      onMouseEnter={() => setShowInsert(true)}
      onMouseLeave={() => setShowInsert(false)}
    >
      {/* 標籤標示（左側色條） */}
      {currentTag && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: currentTag.color, borderRadius: "2px 0 0 2px",
        }} />
      )}
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("itemId", item.id)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      style={{
        display: "grid",
        gridTemplateColumns: colWidths,
        padding: "4px 8px",
        alignItems: "center",
        borderBottom: isDragOver ? "2px solid #888" : "1px solid #f5f5f5",
        background: isDragOver ? "#f5f5f3" : currentTag ? currentTag.bg : hover ? "#fafafa" : "transparent",
        gap: 6,
        transition: "background 0.1s",
        paddingLeft: currentTag ? 10 : 8,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 拖拉把手 */}
      <div style={{
        cursor: "grab", color: "#ccc", fontSize: 14, textAlign: "center",
        userSelect: "none", lineHeight: 1,
      }} title="拖拉排序">⠿</div>
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
      <div style={{ position: "relative" }}>
        <input
          style={inputStyle}
          value={item.itemName}
          onChange={e => { onUpdate({ itemName: e.target.value }); setPriceRef(null); }}
          onFocus={e => e.target.style.borderColor = "#ddd"}
          onBlur={e => { e.target.style.borderColor = "transparent"; handleNameBlur(e.target.value); }}
          placeholder="工程細項名稱"
        />
        {searching && <span style={{ position: "absolute", right: 4, top: 4, fontSize: 10, color: "#aaa" }}>搜尋中…</span>}
        {priceRef && priceRef.length > 0 && (
          <div ref={priceRefEl} style={{
            position: "absolute", left: 0, top: "100%", zIndex: 50,
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: 320,
            fontSize: 12,
          }}>
            <div style={{ padding: "6px 12px", fontSize: 11, color: "#aaa", borderBottom: "1px solid #f0f0f0" }}>
              行情參考（點擊套用）
            </div>
            {priceRef.map((ref, i) => (
              <div
                key={i}
                style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onClick={() => {
                  onUpdate({
                    itemName: ref.itemName,
                    unit: ref.unit || item.unit,
                    cost: toNum(ref.costAvg) || item.cost,
                    multiplier: toNum(ref.multiplierSuggested) || item.multiplier,
                    priceOverride: false,
                  });
                  setPriceRef(null);
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{ref.itemName}</div>
                <div style={{ color: "#888", fontSize: 11 }}>
                  {ref.unit} · 成本均價 ${fmt(ref.costAvg)}
                  {ref.multiplierSuggested && ` · 建議乘數 ${ref.multiplierSuggested}`}
                  {ref.caseDate && ` · ${ref.caseDate}`}
                </div>
              </div>
            ))}
            <div
              style={{ padding: "6px 12px", fontSize: 11, color: "#aaa", cursor: "pointer", textAlign: "center" }}
              onClick={() => setPriceRef(null)}
            >關閉</div>
          </div>
        )}
      </div>
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
      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end", alignItems: "center", position: "relative" }}>
        {/* 標籤按鈕 */}
        <button
          onClick={() => setShowTagMenu(!showTagMenu)}
          title="設定標籤"
          style={{
            background: currentTag ? currentTag.color : "none",
            border: currentTag ? "none" : "none",
            cursor: "pointer",
            color: currentTag ? "#fff" : "#ddd",
            fontSize: currentTag ? 10 : 13,
            padding: currentTag ? "2px 6px" : "2px 4px",
            borderRadius: 3,
            fontFamily: "inherit",
            fontWeight: currentTag ? 600 : 400,
          }}
          onMouseEnter={e => { if (!currentTag) e.target.style.color = "#888"; }}
          onMouseLeave={e => { if (!currentTag) e.target.style.color = "#ddd"; }}
        >
          {currentTag ? currentTag.label : "🏷"}
        </button>

        {/* 標籤選單 */}
        {showTagMenu && (
          <div ref={tagMenuRef} style={{
            position: "absolute", right: 40, top: 0, zIndex: 100,
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 10, minWidth: 160,
          }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>選擇標籤</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ITEM_TAGS.filter(t => t.id !== "memo").map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTagSelect(t.id)}
                  style={{
                    padding: "5px 10px", borderRadius: 4, border: "none",
                    background: item.tag === t.id ? t.color : t.bg,
                    color: item.tag === t.id ? "#fff" : t.color,
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 600, textAlign: "left",
                    outline: item.tag === t.id ? `2px solid ${t.color}` : "none",
                  }}
                >{t.label}</button>
              ))}
              {/* 備忘輸入 */}
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>備忘文字</div>
                <input
                  style={{ ...{ border: "1px solid #e0e0e0", borderRadius: 4, padding: "4px 8px", fontSize: 12, width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none" } }}
                  value={memoText}
                  onChange={e => setMemoText(e.target.value)}
                  placeholder="輸入備忘內容…"
                  onKeyDown={e => e.key === "Enter" && handleMemoSave()}
                />
                <button
                  onClick={handleMemoSave}
                  style={{ marginTop: 6, width: "100%", padding: "4px", borderRadius: 4, border: "none", background: "#6a96b0", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >儲存備忘</button>
              </div>
              {/* 移除標籤 */}
              {item.tag && (
                <button
                  onClick={() => { onUpdate({ tag: null, tagMemo: null }); setShowTagMenu(false); }}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #eee", background: "transparent", color: "#bbb", fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
                >移除標籤</button>
              )}
            </div>
          </div>
        )}

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

    {/* 備忘文字顯示 */}
    {item.tag === "memo" && item.tagMemo && (
      <div style={{
        paddingLeft: 32, paddingBottom: 4,
        fontSize: 11, color: "#6a96b0", fontStyle: "italic",
      }}>
        💬 {item.tagMemo}
      </div>
    )}

    {/* 插入線 */}
    {showInsert && onInsertAfter && (
      <div
        onClick={onInsertAfter}
        style={{
          position: "absolute", bottom: -1, left: 0, right: 0,
          height: 6, zIndex: 10, cursor: "pointer",
          display: "flex", alignItems: "center",
        }}
        title="在此處插入新品項"
      >
        <div style={{
          width: "100%", height: 2,
          background: "#888",
          position: "relative",
          display: "flex", alignItems: "center",
        }}>
          <div style={{
            position: "absolute", left: 8,
            width: 16, height: 16, borderRadius: "50%",
            background: "#888", color: "#fff",
            fontSize: 14, lineHeight: "16px", textAlign: "center",
            marginTop: -1,
          }}>＋</div>
        </div>
      </div>
    )}
    </div>
  );
}

// ─── 品項標籤常數 ────────────────────────────────────────────
const ITEM_TAGS = [
  { id: "pending",  label: "待確認", color: "#c9a84c", bg: "#fdf6e3" },
  { id: "need_fix", label: "需修改", color: "#c0675a", bg: "#fdf0ee" },
  { id: "done",     label: "已確認", color: "#6aaa8a", bg: "#f0f8f4" },
  { id: "memo",     label: "備忘",   color: "#6a96b0", bg: "#eef4f8" },
];

// ─── 列印版面 ───────────────────────────────────────────────
function PrintView({ quote, items, summary, settings, mode, onClose }) {
  const isClient = mode === "client";
  const isIntegrated = quote.type === "integrated";
  const groups = settings.engineering_groups || [];
  const categories = settings.engineering_categories || [];
  const bankAccount = (settings.bank_accounts || []).find(b => b.id === quote.bankAccountId);

  // ─── 即時調整面板 state ───────────────────────────────────
  const defaultAdj = {
    logoWidth: 170,
    logoGap: 20,
    companyFontSize: 14,
    companyLetterSpacing: 10,
    titleFontSize: 14,
    titleLetterSpacing: 3,
    headerMarginBottom: 19,
    footerColumnGap: 40,
    footerFontSize: 13,
    footerTitleFontSize: 14,
    signatureHeight: 100,
    signatureMarginTop: 35,
    totalColor: "#c0522a",
    printMargin: 10,
    summaryColItem: 12,
    summaryColName: 68,
  };
  const [showAdjust, setShowAdjust] = useState(false);
  const [adj, setAdj] = useState(() => {
    const saved = settings.print_layout;
    if (saved && typeof saved === "object") return { ...defaultAdj, ...saved };
    return defaultAdj;
  });
  const [adjSaving, setAdjSaving] = useState(false);
  function setA(key, val) { setAdj(prev => ({ ...prev, [key]: Number(val) })); }

  async function saveAdj() {
    setAdjSaving(true);
    try {
      const serialSettings = { ...settings };
      ["bank_accounts","engineering_groups","engineering_categories","term_templates"].forEach(k => {
        if (Array.isArray(serialSettings[k])) serialSettings[k] = JSON.stringify(serialSettings[k]);
      });
      serialSettings.print_layout = JSON.stringify(adj);
      await sheetPut("Settings", [["key","value"], ...Object.entries(serialSettings)]);
    } catch(e) {
      console.error(e);
    } finally {
      setAdjSaving(false);
    }
  }

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        body { margin: 0; background: #fff; }
        #sidebar { display: none !important; }
        #main-content { margin-left: 0 !important; padding: 0 !important; }
        .print-content { margin-top: 0 !important; background: #fff !important; padding: 0 !important; }
        .print-card { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 20px !important; box-shadow: none !important; background: #fff !important; box-sizing: border-box !important; }
        .print-card-break { page-break-after: always !important; break-after: page !important; }
        .print-card:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        tfoot { display: table-row-group !important; }
        .print-wrap { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; }
        @page { margin: ${adj.printMargin ?? 10}mm; size: A4 portrait; }
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
            <span style={{ fontWeight: 400 }}>{quote.projectName || quote.name}</span>
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
    const sortedGroups = [...groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    sortedGroups.forEach(g => {
      // 依 sortOrder 排序所有品項（含 section）
      const gAllItems = items
        .filter(it => it.group === g.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      // 不含 section 的品項（用於金額計算和大項分類）
      const gItems = gAllItems.filter(it => it.unit !== "__section__");
      if (gItems.length === 0) return;

      const usedCatIds = [...new Set(gItems.map(it => it.category))];
      const sortedCatIds = usedCatIds.sort((a, b) => {
        const catA = categories.find(c => c.id === a);
        const catB = categories.find(c => c.id === b);
        return (catA?.sortOrder || 999) - (catB?.sortOrder || 999);
      });

      const cats = sortedCatIds.map(catId => {
        const cat = categories.find(c => c.id === catId);
        const catNormalItems = gAllItems.filter(it => it.category === catId && it.unit !== "__section__");
        if (catNormalItems.length === 0) return null;
        const minIdx = Math.min(...catNormalItems.map(it => gAllItems.indexOf(it)));
        const maxIdx = Math.max(...catNormalItems.map(it => gAllItems.indexOf(it)));

        // 往前找緊接在 minIdx 之前的 section（直到遇到非 section 的品項為止）
        let startIdx = minIdx;
        for (let i = minIdx - 1; i >= 0; i--) {
          if (gAllItems[i].unit === "__section__") {
            startIdx = i;
          } else {
            break;
          }
        }

        // 取 startIdx 到 maxIdx 之間的所有品項（含 section）
        const catItems = gAllItems.slice(startIdx, maxIdx + 1).filter(it =>
          it.unit === "__section__" || it.category === catId
        );
        const catTotal = catItems.filter(it => it.unit !== "__section__").reduce((s, it) => s + it.total, 0);
        return { cat, catItems, catTotal };
      }).filter(Boolean);

      const gTotal = gItems.reduce((s, it) => s + it.total, 0);
      result.push({ group: g, cats, gTotal });
    });
    return result;
  }

  const integratedData = isIntegrated ? buildIntegratedSummary() : null;

  // 整合式第一頁：總表
  function SummaryPage() {
    // 計算總大項數，超過 12 個自動縮小
    const totalCatCount = integratedData.reduce((s, gd) => s + gd.cats.length, 0);
    const isCompact = totalCatCount > 12;
    const baseFontSize = isCompact ? 11 : 13;
    const basePadding = isCompact ? "4px 8px" : "6px 10px";

    const label = { padding: basePadding, fontSize: baseFontSize, borderBottom: "1px solid #eee", fontFamily: bodyFont };
    const amount = { padding: basePadding, textAlign: "right", fontSize: baseFontSize, borderBottom: "1px solid #eee", fontFamily: bodyFont };
    const letters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

    return (
      <div style={{ ...ps, maxWidth: 780, margin: "0 auto" }}>
        <PrintHeader showType={false} />
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, letterSpacing: 4, marginBottom: 20, color: "#333" }}>
          工 程 估 價 總 表
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <colgroup>
            <col style={{ width: `${adj.summaryColItem}%` }} />
            <col style={{ width: `${adj.summaryColName}%` }} />
            <col style={{ width: `${100 - adj.summaryColItem - adj.summaryColName}%` }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f5f5f5", fontSize: 12, color: "#666" }}>
              <th style={{ ...label, textAlign: "center" }}>項目</th>
              <th style={{ ...label, textAlign: "left" }}>工程項目</th>
              <th style={{ ...amount }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let globalIdx = 0;
              return integratedData.map((gd, gi) => {
                const rows = [];
                // 群組標題列
                rows.push(
                  <tr key={`group-${gi}`}>
                    <td colSpan={3} style={{
                      ...label,
                      fontWeight: 600,
                      fontSize: isCompact ? 10 : 11,
                      color: "#888",
                      paddingTop: gi === 0 ? 6 : 14,
                      paddingBottom: 4,
                      paddingLeft: 8,
                      borderBottom: "none",
                      letterSpacing: 1,
                    }}>{gd.group.name}</td>
                  </tr>
                );
                // 大項列
                gd.cats.forEach((cd, ci) => {
                  rows.push(
                    <tr key={`cat-${gi}-${ci}`}>
                      <td style={{ ...label, textAlign: "center", color: "#888" }}>{letters[globalIdx++]}</td>
                      <td style={{ ...label, textAlign: "left" }}>{cd.cat ? cd.cat.name : "其他"}</td>
                      <td style={{ ...amount }}>${fmt(cd.catTotal)}</td>
                    </tr>
                  );
                });
                return rows;
              });
            })()}

            {/* 工程項目合計 + 管理費 */}
            <tr style={{ background: "#f5f5f5", fontWeight: 600 }}>
              <td colSpan={2} style={{ ...label, textAlign: "right", borderTop: "1px solid #ccc" }}>工程項目合計</td>
              <td style={{ ...amount, borderTop: "1px solid #ccc" }}>${fmt(summary.subtotal)}</td>
            </tr>
            {quote.managementFeeMode !== "none" && (
              <tr>
                <td colSpan={3} style={{ padding: 0, height: 10, borderBottom: "none" }}></td>
              </tr>
            )}
            {quote.managementFeeMode !== "none" && (
              <tr>
                <td style={{ ...label, textAlign: "center", color: "#888" }}></td>
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
              </tr>
            )}
          </tbody>
        </table>

        {/* 總計區 */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <table style={{ width: 300, borderCollapse: "collapse" }}>
            <tbody>
              {quote.taxRate > 0 ? (
                <>
                  <tr>
                    <td style={{ ...label }}>工程承攬未稅金額</td>
                    <td style={amount}>${fmt(summary.roundedBeforeTax || summary.beforeTax)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...label }}>稅金</td>
                    <td style={amount}>${fmt(summary.taxAmount)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, fontSize: 15 }}>
                    <td style={{ ...label, borderTop: "2px solid #333" }}>總價</td>
                    <td style={{ ...amount, borderTop: "2px solid #333", color: adj.totalColor }}>${fmt(summary.total)}</td>
                  </tr>
                </>
              ) : (
                <tr style={{ fontWeight: 700, fontSize: 15 }}>
                  <td style={{ ...label, borderTop: "2px solid #333", whiteSpace: "nowrap" }}>工程承攬總價</td>
                  <td style={{ ...amount, borderTop: "2px solid #333", color: adj.totalColor }}>${fmt(summary.total)}</td>
                </tr>
              )}
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
                    {(() => {
                      let itemCount = 0;
                      return cd.catItems.map((it) => {
                        if (it.unit === "__section__") {
                          return (
                            <tr key={it.id}>
                              <td colSpan={7} style={{
                                padding: "7px 10px",
                                background: "#f0f0ee",
                                fontWeight: 600,
                                fontSize: 12,
                                color: "#444",
                                letterSpacing: 0.5,
                              }}>{it.itemName}</td>
                            </tr>
                          );
                        }
                        itemCount++;
                        return (
                          <tr key={it.id}>
                            <td style={{ ...cellCenter, color: "#aaa" }}>{itemCount}</td>
                            <td style={cellLeft}>{it.itemName}</td>
                            <td style={cellCenter}>{it.unit}</td>
                            <td style={cellCenter}>{it.qty}</td>
                            <td style={cellRight}>{fmt(it.price)}</td>
                            <td style={cellRight}>{fmt(it.total)}</td>
                            <td style={cellRight}>{it.note}</td>
                          </tr>
                        );
                      });
                    })()}
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
            {(() => {
              let itemCount = 0;
              return items.map((it) => {
                if (it.unit === "__section__") {
                  return (
                    <tr key={it.id}>
                      <td colSpan={showCost ? 10 : 8} style={{
                        padding: "8px 10px",
                        background: "#f0f0ee",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#444",
                        letterSpacing: 0.5,
                      }}>{it.itemName}</td>
                    </tr>
                  );
                }
                itemCount++;
                return (
                  <tr key={it.id}>
                    <td style={{ ...cellCenter, color: "#aaa" }}>{itemCount}</td>
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
                );
              });
            })()}
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
              {quote.taxRate > 0 ? (
                <>
                  <tr>
                    <td style={{ padding: "5px 10px", fontWeight: 600 }}>工程承攬未稅金額</td>
                    <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(summary.beforeTax)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "5px 10px", color: "#555" }}>稅金</td>
                    <td style={{ padding: "5px 10px", textAlign: "right" }}>{fmt(summary.taxAmount)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ padding: "6px 10px", borderTop: "2px solid #333" }}>總價</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", borderTop: "2px solid #333", fontSize: 16, color: adj.totalColor }}>
                      {fmt(summary.total)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: "6px 10px", borderTop: "2px solid #333", whiteSpace: "nowrap" }}>工程承攬總價</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", borderTop: "2px solid #333", fontSize: 16, color: adj.totalColor }}>
                    {fmt(summary.total)}
                  </td>
                </tr>
              )}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: adj.footerColumnGap, fontSize: adj.footerFontSize, marginBottom: 32 }}>
          {/* 備註 */}
          {quote.terms && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: adj.footerTitleFontSize }}>備註</div>
              <div style={{ color: "#555", whiteSpace: "pre-line", lineHeight: 1.8 }}>{quote.terms}</div>
            </div>
          )}

          {/* 右側：公司資訊、匯款 */}
          <div>
            {/* 公司資訊 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: adj.footerTitleFontSize }}>公司資訊</div>
              <div style={{ color: "#555", lineHeight: 1.8 }}>
                {settings.company_name} / {settings.company_tax_id}<br />
                {settings.company_address} / {settings.company_phone}
                {settings.company_email && <><br />{settings.company_email}</>}
              </div>
            </div>

            {/* 匯款帳戶 */}
            {quote.showBankAccount && bankAccount && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: adj.footerTitleFontSize }}>匯款帳戶</div>
                <div style={{ color: "#555", lineHeight: 1.8 }}>
                  {bankAccount.bankName} {bankAccount.branchName}({bankAccount.bankCode})<br />
                  戶名：{bankAccount.accountName}<br />
                  帳號：{bankAccount.accountNumber}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 客戶簽章 / 經辦人 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: adj.signatureMarginTop }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>客戶簽章</div>
            <div style={{ height: adj.signatureHeight, border: "1px solid #ddd", borderRadius: 4, background: "#fafafa" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>經辦人</div>
            <div style={{ height: adj.signatureHeight, border: "1px solid #ddd", borderRadius: 4, background: "#fafafa" }} />
          </div>
        </div>

        {/* 封底頁尾 */}
        <div style={{ marginTop: 24, borderTop: "1px solid #ccc", paddingTop: 8, display: "flex", justifyContent: "flex-end", gap: 24, fontFamily: bodyFont }}>
          <span style={{ fontSize: 11, color: "#aaa", letterSpacing: 0.5 }}>www.whatisarchdesign.com</span>
          <span style={{ fontSize: 11, color: "#aaa", letterSpacing: 0.5 }}>LINE：@whatis</span>
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
            { key: "footerColumnGap", label: "備註與公司資訊間距", min: 8, max: 80, unit: "px" },
            { key: "footerFontSize", label: "底部內文字體大小", min: 10, max: 18, unit: "px" },
            { key: "footerTitleFontSize", label: "底部標題字體大小", min: 10, max: 18, unit: "px" },
            { key: "signatureHeight", label: "簽章框高度", min: 40, max: 150, unit: "px" },
            { key: "signatureMarginTop", label: "簽章區上方間距", min: 0, max: 60, unit: "px" },
            { key: "printMargin", label: "列印頁面邊距", min: 3, max: 20, unit: "mm" },
            { key: "summaryColItem", label: "總表：項目欄寬", min: 5, max: 25, unit: "%" },
            { key: "summaryColName", label: "總表：工程項目欄寬", min: 30, max: 80, unit: "%" },
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

          {/* 總表金額欄（自動計算） */}
          <div style={{ marginBottom: 14, padding: "8px 12px", background: "#f9f9f9", borderRadius: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>總表：金額欄寬（自動）</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>
                {100 - (adj.summaryColItem || 12) - (adj.summaryColName || 68)}%
              </span>
            </div>
          </div>

          {/* 顏色選擇 */}
          <div style={{ marginBottom: 14, borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 10 }}>顏色設定</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#888" }}>總計金額顏色</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 4, background: adj.totalColor, border: "1px solid #ddd" }} />
                <input
                  type="color"
                  value={adj.totalColor}
                  onChange={e => setAdj(prev => ({ ...prev, totalColor: e.target.value }))}
                  style={{ width: 40, height: 28, border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", padding: 2 }}
                />
                <span style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>{adj.totalColor}</span>
              </div>
            </div>
            {/* 快速預設顏色 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["#c0522a","#4a8fa8","#5a8f6a","#7a6fa8","#888888","#2a6496","#4a7c6f"].map(c => (
                <button
                  key={c}
                  onClick={() => setAdj(prev => ({ ...prev, totalColor: c }))}
                  style={{
                    width: 24, height: 24, borderRadius: 4,
                    background: c,
                    border: adj.totalColor === c ? "2px solid #333" : "1px solid #ddd",
                    cursor: "pointer", padding: 0,
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>調整滿意後點下方儲存，設定會同步到所有裝置：</div>
            <button
              onClick={saveAdj}
              disabled={adjSaving}
              style={{
                ...S.btn,
                width: "100%",
                marginBottom: 10,
                background: adjSaving ? "#aaa" : "#333",
                fontSize: 12,
              }}
            >
              {adjSaving ? "儲存中…" : "✓ 儲存版面設定"}
            </button>
            <div style={{ fontSize: 10, color: "#bbb", marginBottom: 8 }}>或把數值複製給 Claude：</div>
            <textarea
              readOnly
              value={JSON.stringify(adj, null, 2)}
              style={{ width: "100%", height: 120, fontSize: 10, color: "#555", border: "1px solid #eee", borderRadius: 4, padding: 8, resize: "none", fontFamily: "monospace", boxSizing: "border-box" }}
              onClick={e => e.target.select()}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 60 }} className="print-content">
        {/* 內部版：成本利潤分析表 */}
        {!isClient ? (
          <div className="print-card" style={{ background: "#fff", width: 794, maxWidth: "100%", margin: "0 auto", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box" }}>
            <InternalCostView quote={quote} items={items} summary={summary} settings={settings} isIntegrated={isIntegrated} />
          </div>
        ) : isIntegrated ? (
          <>
            <div className="print-card print-card-break" style={{ background: "#fff", width: 794, maxWidth: "100%", margin: "0 auto 24px", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box" }}>
              <SummaryPage />
            </div>
            <div className="print-card" style={{ background: "#fff", width: 794, maxWidth: "100%", margin: "0 auto", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box" }}>
              <DetailPage groupData={integratedData} />
            </div>
          </>
        ) : (
          <div className="print-card" style={{ background: "#fff", width: 794, maxWidth: "100%", margin: "0 auto", padding: "40px 48px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box" }}>
            <IndependentPage />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 內部版：成本利潤分析表 ─────────────────────────────────
function InternalCostView({ quote, items, summary, settings, isIntegrated }) {
    const groups = settings.engineering_groups || [];
    const categories = settings.engineering_categories || [];
    const bodyFont = '"微軟正黑體","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
    const cell = { padding: "8px 10px", fontSize: 12, borderBottom: "1px solid #f0f0f0", verticalAlign: "middle", fontFamily: bodyFont };
    const cellR = { ...cell, textAlign: "right" };
    const cellC = { ...cell, textAlign: "center" };

    // 計算整體數字
    const totalCost = items.reduce((s, it) => s + toNum(it.cost) * toNum(it.qty), 0);
    const totalRevenue = items.reduce((s, it) => s + toNum(it.total), 0);
    const totalProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    // 整合式：按群組/大項分組
    function renderIntegratedRows() {
      return groups.map(g => {
        const gItems = items.filter(it => it.group === g.id);
        if (gItems.length === 0) return null;
        const catIds = [...new Set(gItems.map(it => it.category))];
        return (
          <tbody key={g.id}>
            <tr>
              <td colSpan={9} style={{ ...cell, background: "#f0f0ee", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
                {g.name}
              </td>
            </tr>
            {catIds.map(catId => {
              const cat = categories.find(c => c.id === catId);
              const catItems = gItems.filter(it => it.category === catId);
              const rows = [];
              rows.push(
                <tr key={`header-${catId}`}>
                  <td colSpan={9} style={{ ...cell, background: "#fafafa", fontWeight: 600, paddingLeft: 20, color: "#555" }}>
                    {cat ? cat.name : "其他"}
                  </td>
                </tr>
              );
              catItems.forEach((it, i) => rows.push(renderItemRow(it, i)));
              return rows;
            })}
          </tbody>
        );
      });
    }

    function renderItemRow(it, i) {
      const costTotal = Math.round(toNum(it.cost) * toNum(it.qty));
      const profit = toNum(it.total) - costTotal;
      const itemMargin = toNum(it.total) > 0 ? Math.round((profit / toNum(it.total)) * 100) : 0;
      const tag = ITEM_TAGS.find(t => t.id === it.tag);
      return (
        <tr key={it.id} style={{ background: tag ? tag.bg : i % 2 === 0 ? "#fff" : "#fdfdfb" }}>
          <td style={{ ...cell, color: "#aaa", textAlign: "center" }}>{i + 1}</td>
          <td style={cell}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tag && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                  background: tag.color, color: "#fff", whiteSpace: "nowrap",
                }}>{tag.label}</span>
              )}
              {it.itemName}
              {it.tag === "memo" && it.tagMemo && (
                <span style={{ fontSize: 10, color: "#6a96b0", fontStyle: "italic" }}>（{it.tagMemo}）</span>
              )}
            </div>
          </td>
          <td style={cellC}>{it.unit}</td>
          <td style={cellC}>{it.qty}</td>
          <td style={cellR}>{it.cost ? fmt(it.cost) : "—"}</td>
          <td style={cellC}>{it.multiplier || "—"}</td>
          <td style={cellR}>{fmt(it.price)}</td>
          <td style={cellR}>{fmt(costTotal)}</td>
          <td style={{ ...cellR, color: profit >= 0 ? "#5a8f6a" : "#c0675a", fontWeight: 600 }}>
            {profit >= 0 ? "+" : ""}{fmt(profit)}
            <span style={{ fontSize: 10, color: "#aaa", marginLeft: 4 }}>({itemMargin}%)</span>
          </td>
        </tr>
      );
    }

    return (
      <div style={{ fontFamily: bodyFont, color: "#333", fontSize: 13 }}>
        {/* 標題 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 2, marginBottom: 4 }}>INTERNAL USE ONLY</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>成本利潤分析表</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{quote.projectName || quote.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{quote.clientName} · {quote.date}</div>
          </div>
        </div>

        {/* 摘要卡片 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[
            { label: "報價合計（未稅）", value: `$${fmt(totalRevenue)}`, color: "#333" },
            { label: "成本合計", value: `$${fmt(totalCost)}`, color: "#555" },
            { label: "毛利", value: `$${fmt(totalProfit)}`, color: totalProfit >= 0 ? "#5a8f6a" : "#c0675a" },
            { label: "毛利率", value: `${marginPct}%`, color: totalProfit >= 0 ? "#5a8f6a" : "#c0675a" },
          ].map(card => (
            <div key={card.label} style={{ background: "#f9f9f7", border: "1px solid #eee", borderRadius: 6, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* 管理費 & 稅金 */}
        {quote.managementFeeMode !== "none" && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "8px 16px", fontSize: 12, color: "#555" }}>
              工程管理費（{quote.managementFeeValue}{quote.managementFeeMode === "percent" ? "%" : ""}）：${fmt(summary.managementFee)}
              {summary.managementFeeDiscount > 0 && <span style={{ color: "#c0675a", marginLeft: 6 }}>（整價折讓 ${fmt(summary.managementFeeDiscount)}）</span>}
            </div>
            {quote.taxRate > 0 && (
              <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "8px 16px", fontSize: 12, color: "#555" }}>
                稅金（{quote.taxRate}%）：${fmt(summary.taxAmount)}
              </div>
            )}
            <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#333" }}>
              含稅總計：${fmt(summary.total)}
            </div>
          </div>
        )}

        {/* 品項明細表 */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr style={{ background: "#333", color: "#fff", fontSize: 11 }}>
              <th style={{ ...cellC, color: "#fff", background: "#333", width: 30 }}>#</th>
              <th style={{ ...cell, color: "#fff", background: "#333" }}>品項</th>
              <th style={{ ...cellC, color: "#fff", background: "#333", width: 40 }}>單位</th>
              <th style={{ ...cellC, color: "#fff", background: "#333", width: 44 }}>數量</th>
              <th style={{ ...cellR, color: "#fff", background: "#333", width: 70 }}>成本單價</th>
              <th style={{ ...cellC, color: "#fff", background: "#333", width: 44 }}>倍率</th>
              <th style={{ ...cellR, color: "#fff", background: "#333", width: 70 }}>報價單價</th>
              <th style={{ ...cellR, color: "#fff", background: "#333", width: 80 }}>成本小計</th>
              <th style={{ ...cellR, color: "#fff", background: "#333", width: 100 }}>毛利</th>
            </tr>
          </thead>
          {isIntegrated ? renderIntegratedRows() : (
            <tbody>
              {items.map((it, i) => renderItemRow(it, i))}
            </tbody>
          )}
          <tfoot>
            <tr style={{ background: "#f5f5f5", fontWeight: 700 }}>
              <td colSpan={7} style={{ ...cellR, color: "#555", fontWeight: 600 }}>合計</td>
              <td style={{ ...cellR, fontWeight: 700 }}>${fmt(totalCost)}</td>
              <td style={{ ...cellR, fontWeight: 700, color: totalProfit >= 0 ? "#5a8f6a" : "#c0675a" }}>
                +${fmt(totalProfit)} ({marginPct}%)
              </td>
            </tr>
          </tfoot>
        </table>

        {/* 內部備註 */}
        {quote.internalNote && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#fffef5", border: "1px solid #f0e8cc", borderRadius: 4 }}>
            <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: 600, marginBottom: 4 }}>內部備註</div>
            <div style={{ fontSize: 12, color: "#555", whiteSpace: "pre-line" }}>{quote.internalNote}</div>
          </div>
        )}
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
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [dragOverCatId, setDragOverCatId] = useState(null);

  // ── 群組操作 ──
  function addGroup() {
    const newG = { id: genId(), name: "新群組", sortOrder: groups.length + 1 };
    onChangeGroups([...groups, newG]);
  }
  function updateGroup(id, name) {
    onChangeGroups(groups.map(g => g.id === id ? { ...g, name } : g));
  }
  function removeGroup(id) {
    if (!confirm("確定刪除此群組？底下的工程大項也會一併刪除。")) return;
    onChangeGroups(groups.filter(g => g.id !== id));
    onChangeCategories(categories.filter(c => c.groupId !== id));
  }
  function reorderGroup(sourceId, targetId) {
    const srcIdx = groups.findIndex(g => g.id === sourceId);
    const tgtIdx = groups.findIndex(g => g.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return;
    const next = [...groups];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    onChangeGroups(next.map((g, i) => ({ ...g, sortOrder: i + 1 })));
  }

  // ── 大項操作 ──
  function addCategory(groupId) {
    const gCats = categories.filter(c => c.groupId === groupId);
    const newC = { id: genId(), groupId, name: "新工程大項", sortOrder: gCats.length + 1, active: true };
    onChangeCategories([...categories, newC]);
    setEditingCatId(newC.id);
  }
  function updateCategory(id, name) {
    onChangeCategories(categories.map(c => c.id === id ? { ...c, name } : c));
  }
  function toggleCategory(id) {
    onChangeCategories(categories.map(c => c.id === id ? { ...c, active: c.active !== false ? false : true } : c));
  }
  function removeCategory(id) {
    if (!confirm("確定刪除此工程大項？")) return;
    onChangeCategories(categories.filter(c => c.id !== id));
  }
  function reorderCategory(sourceId, targetId, groupId) {
    const gCats = categories.filter(c => c.groupId === groupId);
    const otherCats = categories.filter(c => c.groupId !== groupId);
    const srcIdx = gCats.findIndex(c => c.id === sourceId);
    const tgtIdx = gCats.findIndex(c => c.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return;
    const next = [...gCats];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    onChangeCategories([...otherCats, ...next.map((c, i) => ({ ...c, sortOrder: i + 1 }))]);
  }

  function moveToGroup(catId, newGroupId) {
    const otherCats = categories.filter(c => c.groupId === newGroupId);
    const newSortOrder = otherCats.length + 1;
    onChangeCategories(categories.map(c =>
      c.id === catId ? { ...c, groupId: newGroupId, sortOrder: newSortOrder } : c
    ));
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {groups.map(g => {
        const gCats = categories.filter(c => c.groupId === g.id);
        return (
          <div
            key={g.id}
            draggable
            onDragStart={e => { e.dataTransfer.setData("groupId", g.id); e.dataTransfer.setData("dragType", "group"); }}
            onDragOver={e => { e.preventDefault(); setDragOverGroupId(g.id); }}
            onDragLeave={() => setDragOverGroupId(null)}
            onDrop={e => {
              e.preventDefault();
              setDragOverGroupId(null);
              const dragType = e.dataTransfer.getData("dragType");
              if (dragType === "group") {
                reorderGroup(e.dataTransfer.getData("groupId"), g.id);
              }
            }}
            style={{
              ...S.card, marginBottom: 16,
              borderColor: dragOverGroupId === g.id ? "#888" : "#e8e8e8",
              transition: "border-color 0.15s",
            }}
          >
            {/* 群組標題列 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ color: "#ccc", cursor: "grab", fontSize: 16, userSelect: "none", padding: "0 4px" }} title="拖拉調整群組順序">⠿</div>
              {editingGroupId === g.id ? (
                <input
                  autoFocus
                  style={{ ...S.input, fontSize: 14, fontWeight: 600, flex: 1 }}
                  value={g.name}
                  onChange={e => updateGroup(g.id, e.target.value)}
                  onBlur={() => setEditingGroupId(null)}
                  onKeyDown={e => e.key === "Enter" && setEditingGroupId(null)}
                />
              ) : (
                <div
                  style={{ fontWeight: 600, fontSize: 14, flex: 1, cursor: "pointer" }}
                  onClick={() => setEditingGroupId(g.id)}
                  title="點擊修改群組名稱"
                >{g.name}</div>
              )}
              <button
                style={{ ...S.btnDanger, padding: "3px 10px", fontSize: 11 }}
                onClick={() => removeGroup(g.id)}
              >刪除群組</button>
            </div>

            {/* 大項列表 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {gCats.map(c => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("catId", c.id); e.dataTransfer.setData("dragType", "cat"); e.dataTransfer.setData("groupId", g.id); }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverCatId(c.id); }}
                  onDragLeave={e => { e.stopPropagation(); setDragOverCatId(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverCatId(null);
                    const dragType = e.dataTransfer.getData("dragType");
                    if (dragType === "cat") {
                      reorderCategory(e.dataTransfer.getData("catId"), c.id, g.id);
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 0,
                    outline: dragOverCatId === c.id ? "2px solid #888" : "none",
                    borderRadius: 4,
                  }}
                >
                  {editingCatId === c.id ? (
                    <input
                      autoFocus
                      style={{
                        border: "1px solid #888", borderRadius: "4px 0 0 4px",
                        padding: "5px 10px", fontSize: 12, fontFamily: "inherit",
                        outline: "none", width: 120,
                      }}
                      value={c.name}
                      onChange={e => updateCategory(c.id, e.target.value)}
                      onBlur={() => setEditingCatId(null)}
                      onKeyDown={e => e.key === "Enter" && setEditingCatId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => toggleCategory(c.id)}
                      onDoubleClick={() => setEditingCatId(c.id)}
                      title="點擊啟用/停用，雙擊修改名稱，拖拉調整順序"
                      style={{
                        padding: "5px 12px",
                        borderRadius: "4px 0 0 4px",
                        border: "1px solid",
                        fontSize: 12,
                        cursor: "grab",
                        fontFamily: "inherit",
                        background: c.active !== false ? "#333" : "transparent",
                        color: c.active !== false ? "#fff" : "#aaa",
                        borderColor: c.active !== false ? "#333" : "#e0e0e0",
                        transition: "all 0.15s",
                      }}
                    >{c.name}</button>
                  )}
                  <button
                    onClick={() => removeCategory(c.id)}
                    title="刪除"
                    style={{
                      padding: "5px 7px",
                      borderRadius: "0 4px 4px 0",
                      border: "1px solid",
                      borderLeft: "none",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      background: c.active !== false ? "#444" : "#f5f5f5",
                      color: c.active !== false ? "#ddd" : "#bbb",
                      borderColor: c.active !== false ? "#333" : "#e0e0e0",
                    }}
                  >✕</button>
                  {/* 移至群組 */}
                  <select
                    title="移至其他群組"
                    value={c.groupId}
                    onChange={e => moveToGroup(c.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      marginLeft: 4, padding: "4px 6px", fontSize: 10,
                      border: "1px solid #e0e0e0", borderRadius: 4,
                      background: "#f9f9f9", color: "#888",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {groups.map(gr => (
                      <option key={gr.id} value={gr.id}>{gr.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                style={{ ...S.btnSecondary, padding: "5px 12px", fontSize: 12 }}
                onClick={() => addCategory(g.id)}
              >＋ 新增大項</button>
            </div>

            <div style={{ fontSize: 11, color: "#bbb" }}>
              點擊切換啟用/停用 · 雙擊修改名稱 · 拖拉調整順序 · ✕ 刪除
            </div>
          </div>
        );
      })}

      <button style={S.btnSecondary} onClick={addGroup}>＋ 新增工程群組</button>
      <div style={{ fontSize: 11, color: "#bbb", marginTop: 8 }}>群組卡片也可以拖拉調整順序</div>
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
