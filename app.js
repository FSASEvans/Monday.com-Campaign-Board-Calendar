const DATA_FILE_PATH = "./data/latest-export.xlsx";
const state = { campaigns: [], validationIssues: [], currentDate: new Date(), selectedCampaign: null, viewMode: "month", filters: { brand: new Set(), offerType: new Set(), audience: new Set(), searchText: "" } };
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const brandColumnCandidates = ["Brand", "Brand Name", "Business Unit"];
const el = {
  monthView: document.getElementById("monthView"), quarterView: document.getElementById("quarterView"), currentRangeLabel: document.getElementById("currentRangeLabel"),
  resultCountLabel: document.getElementById("resultCountLabel"), brandFilter: document.getElementById("brandFilter"), offerTypeFilter: document.getElementById("offerTypeFilter"),
  audienceFilter: document.getElementById("audienceFilter"), searchInput: document.getElementById("searchInput"), resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  validationSummary: document.getElementById("validationSummary"), refreshInfo: document.getElementById("refreshInfo"), detailsContent: document.getElementById("detailsContent"),
  prevMonthBtn: document.getElementById("prevMonthBtn"), nextMonthBtn: document.getElementById("nextMonthBtn"), todayBtn: document.getElementById("todayBtn"), viewToggleBtn: document.getElementById("viewToggleBtn")
};
document.addEventListener("DOMContentLoaded", async () => { bindEvents(); await loadWorkbook(); refreshView(); });
function bindEvents() {
  el.brandFilter.addEventListener("change", () => { state.filters.brand = getSelectedValues(el.brandFilter); refreshView(); });
  el.offerTypeFilter.addEventListener("change", () => { state.filters.offerType = getSelectedValues(el.offerTypeFilter); refreshView(); });
  el.audienceFilter.addEventListener("change", () => { state.filters.audience = getSelectedValues(el.audienceFilter); refreshView(); });
  el.searchInput.addEventListener("input", () => { state.filters.searchText = (el.searchInput.value || "").trim().toLowerCase(); refreshView(); });
  el.resetFiltersBtn.addEventListener("click", () => { clearMultiSelect(el.brandFilter); clearMultiSelect(el.offerTypeFilter); clearMultiSelect(el.audienceFilter); el.searchInput.value = ""; state.filters.brand.clear(); state.filters.offerType.clear(); state.filters.audience.clear(); state.filters.searchText = ""; refreshView(); });
  el.prevMonthBtn.addEventListener("click", () => { state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1); refreshView(); });
  el.nextMonthBtn.addEventListener("click", () => { state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1); refreshView(); });
  el.todayBtn.addEventListener("click", () => { state.currentDate = new Date(); refreshView(); });
  el.viewToggleBtn.addEventListener("click", () => { state.viewMode = state.viewMode === "month" ? "quarter" : "month"; el.viewToggleBtn.textContent = state.viewMode === "month" ? "Quarter View" : "Month View"; refreshView(); });
}
async function loadWorkbook() {
  try {
    const response = await fetch(DATA_FILE_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load data file. Add latest-export.xlsx to /data.");
    const lastModified = response.headers.get("last-modified");
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
    const parsed = parseRows(rows);
    state.validationIssues = parsed.validationIssues;
    state.campaigns = parsed.campaigns.filter((c) => !c.invalidDate);
    hydrateFilters();
    const loadedAt = new Date().toLocaleString();
    el.refreshInfo.textContent = `Last refreshed: ${loadedAt}${lastModified ? ` | Source file modified: ${new Date(lastModified).toLocaleString()}` : ""}`;
    el.validationSummary.textContent = state.validationIssues.length ? `Data quality check: ${state.validationIssues.length} rows had missing/invalid dates and were excluded.` : "Data quality check: no blocking issues found.";
  } catch (error) {
    el.currentRangeLabel.textContent = "Data Load Error";
    el.resultCountLabel.textContent = error.message;
  }
}
function parseRows(rows) {
  const result = { campaigns: [], validationIssues: [] };
  const headerIdx = rows.findIndex((row) => {
    const n = row.map((cell) => String(cell || "").trim().toLowerCase());
    return n.includes("name") && n.includes("stage") && n.includes("status") && n.includes("in market - start") && n.includes("in market - end");
  });
  if (headerIdx === -1) return result;
  const headers = rows[headerIdx].map((v) => String(v || "").trim());
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => c === "" || c === null || typeof c === "undefined")) continue;
    const mapped = {}; headers.forEach((h, idx) => { mapped[h] = row[idx]; });
    const name = textValue(mapped.Name); if (!name) continue;
    const startDate = parseDate(mapped["In Market - Start"]), endDate = parseDate(mapped["In Market - End"]), targetLaunch = parseDate(mapped["Target Launch"]);
    const campaign = {
      id: `${name}-${i}`, name, subitems: textValue(mapped.Subitems) || "Unspecified", stage: textValue(mapped.Stage) || "Unspecified", status: textValue(mapped.Status) || "Unspecified",
      assigned: splitTokens(mapped.Assigned), offerSubtype: textValue(mapped["Offer Subtype"]) || "Unspecified", offerType: textValue(mapped["Offer Type"]) || "Unspecified",
      productService: splitTokens(mapped["Product/Service"]), audience: splitTokens(mapped.Audience).length ? splitTokens(mapped.Audience) : ["Unspecified"],
      brand: resolveBrand(mapped), startDate: startDate || targetLaunch, endDate: endDate || targetLaunch || startDate, targetLaunch
    };
    campaign.invalidDate = !campaign.startDate || !campaign.endDate;
    if (campaign.invalidDate) result.validationIssues.push(`Invalid date for "${name}"`);
    result.campaigns.push(campaign);
  }
  return result;
}
function resolveBrand(m) { for (const key of brandColumnCandidates) if (m[key]) return textValue(m[key]); return "Unspecified"; }
function parseDate(v) { if (!v) return null; if (v instanceof Date && !Number.isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate()); const p = new Date(v); return Number.isNaN(p.getTime()) ? null : new Date(p.getFullYear(), p.getMonth(), p.getDate()); }
function splitTokens(v) { return textValue(v).split(",").map((x) => x.trim()).filter(Boolean); }
function textValue(v) { return v === null || typeof v === "undefined" ? "" : String(v).trim(); }
function hydrateFilters() { fillSelect(el.brandFilter, unique(state.campaigns.map((c) => c.brand))); fillSelect(el.offerTypeFilter, unique(state.campaigns.map((c) => c.offerType))); fillSelect(el.audienceFilter, unique(state.campaigns.flatMap((c) => c.audience))); }
function fillSelect(selectEl, values) { selectEl.innerHTML = ""; values.forEach((value) => { const o = document.createElement("option"); o.value = value; o.textContent = value; selectEl.appendChild(o); }); }
function unique(v) { return [...new Set(v.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function getSelectedValues(selectEl) { return new Set(Array.from(selectEl.selectedOptions).map((o) => o.value)); }
function clearMultiSelect(selectEl) { Array.from(selectEl.options).forEach((o) => { o.selected = false; }); }
function applyFilters(campaigns) { return campaigns.filter((c) => (state.filters.brand.size === 0 || state.filters.brand.has(c.brand)) && (state.filters.offerType.size === 0 || state.filters.offerType.has(c.offerType)) && (state.filters.audience.size === 0 || c.audience.some((a) => state.filters.audience.has(a))) && (!state.filters.searchText || c.name.toLowerCase().includes(state.filters.searchText))); }
function refreshView() {
  const filtered = applyFilters(state.campaigns);
  state.selectedCampaign = filtered.find((x) => x.id === state.selectedCampaign?.id) || null;
  el.currentRangeLabel.textContent = state.viewMode === "month" ? state.currentDate.toLocaleString(undefined, { month: "long", year: "numeric" }) : `Q${Math.floor(state.currentDate.getMonth() / 3) + 1} ${state.currentDate.getFullYear()}`;
  el.resultCountLabel.textContent = `${filtered.length} campaign${filtered.length === 1 ? "" : "s"} shown`;
  renderMonthView(filtered); renderQuarterView(filtered); renderDetails(state.selectedCampaign);
  el.monthView.classList.toggle("hidden", state.viewMode !== "month"); el.quarterView.classList.toggle("hidden", state.viewMode !== "quarter");
}
function renderMonthView(campaigns) {
  el.monthView.innerHTML = ""; dayNames.forEach((day) => { const h = document.createElement("div"); h.className = "day-head"; h.textContent = day; el.monthView.appendChild(h); });
  const monthStart = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1); const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - monthStart.getDay());
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    const cell = document.createElement("div"); cell.className = "day-cell"; if (d.getMonth() !== state.currentDate.getMonth()) cell.classList.add("is-outside");
    const label = document.createElement("div"); label.className = "day-label"; label.textContent = String(d.getDate()); cell.appendChild(label);
    const onDay = campaigns.filter((c) => d >= c.startDate && d <= c.endDate); onDay.slice(0, 4).forEach((campaign) => cell.appendChild(renderCampaignChip(campaign)));
    if (onDay.length > 4) { const overflow = document.createElement("div"); overflow.className = "chip-meta"; overflow.textContent = `+${onDay.length - 4} more`; cell.appendChild(overflow); }
    el.monthView.appendChild(cell);
  }
}
function renderQuarterView(campaigns) {
  el.quarterView.innerHTML = ""; const year = state.currentDate.getFullYear(); const startMonth = Math.floor(state.currentDate.getMonth() / 3) * 3;
  for (let offset = 0; offset < 3; offset += 1) {
    const month = startMonth + offset; const m = document.createElement("article"); m.className = "quarter-month";
    const title = document.createElement("h3"); title.textContent = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" }); m.appendChild(title);
    const list = document.createElement("div"); list.className = "quarter-list";
    const monthStart = new Date(year, month, 1), monthEnd = new Date(year, month + 1, 0);
    campaigns.filter((c) => c.endDate >= monthStart && c.startDate <= monthEnd).sort((a, b) => a.startDate - b.startDate).slice(0, 20).forEach((campaign) => list.appendChild(renderCampaignChip(campaign)));
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "subtle"; empty.textContent = "No campaigns in this month."; list.appendChild(empty); }
    m.appendChild(list); el.quarterView.appendChild(m);
  }
}
function renderCampaignChip(campaign) {
  const chip = document.createElement("button"); chip.type = "button"; chip.className = "campaign-chip";
  chip.innerHTML = `${escapeHtml(campaign.name)}<span class="chip-meta">${escapeHtml(campaign.offerType)} | ${escapeHtml(campaign.brand)}</span>`;
  chip.addEventListener("click", () => { state.selectedCampaign = campaign; renderDetails(campaign); });
  return chip;
}
function renderDetails(campaign) {
  if (!campaign) { el.detailsContent.innerHTML = `<p class="subtle">Select a campaign to view details.</p>`; return; }
  const rows = [["Campaign", campaign.name], ["Date Range", `${formatDate(campaign.startDate)} to ${formatDate(campaign.endDate)}`], ["Target Launch", campaign.targetLaunch ? formatDate(campaign.targetLaunch) : "N/A"], ["Brand", campaign.brand], ["Offer Type", campaign.offerType], ["Offer Subtype", campaign.offerSubtype], ["Audience", campaign.audience.join(", ")], ["Product/Service", campaign.productService.join(", ") || "N/A"], ["Stage", campaign.stage], ["Status", campaign.status], ["Assigned", campaign.assigned.join(", ") || "N/A"], ["Subitems", campaign.subitems]];
  el.detailsContent.innerHTML = rows.map(([label, value]) => `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`).join("");
}
function formatDate(date) { return date ? date.toLocaleDateString() : "N/A"; }
function escapeHtml(input) { return String(input).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;"); }
