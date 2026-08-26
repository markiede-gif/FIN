import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  LayoutGrid, ArrowLeftRight, PiggyBank, TrendingUp, ScrollText,
  HelpCircle, Plus, Trash2, Upload, X, Check, AlertTriangle, Download,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/*  Design tokens                                                          */
/* ---------------------------------------------------------------------- */

const C = {
  bg: "#14181C",
  panel: "#1B2127",
  panel2: "#20262C",
  line: "#30373D",
  text: "#E9E5DC",
  textFaint: "#8D949B",
  textFainter: "#5E656C",
  moss: "#7FA07E",
  mossDim: "#3C4A3D",
  amber: "#CE9A56",
  amberDim: "#4A3F2C",
  rust: "#C15F49",
  rustDim: "#4A2E27",
  gold: "#C9A96B",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

/* ---------------------------------------------------------------------- */
/*  Constants                                                              */
/* ---------------------------------------------------------------------- */

const INCOME_CATEGORIES = ["Salary", "Bonus", "13th Cheque", "14th Cheque", "15th Cheque", "Tax Refund", "Dividends", "Other Income"];
const EXPENSE_CATEGORIES = ["Rent", "Utilities", "Food & Groceries", "Toiletries & Cleaning", "Transport", "Car", "Insurance", "Medical", "Child Maintenance", "Children's Expenses", "School-Related", "Entertainment", "Subscriptions", "Personal Spending", "Legal Costs", "Post-Divorce Setup", "Other"];
const INVESTMENT_CATEGORY = "Investments";
const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, INVESTMENT_CATEGORY];
const TXN_TYPES = ["Recurring", "Variable", "One-off", "Investment", "Debt repayment", "Transfer"];

const ASSET_TYPES = ["Cash", "Emergency Savings", "ETF", "TFSA", "RA", "Company Shares", "Crypto", "Other Investment", "Property", "Other Asset"];
const LIABILITY_TYPES = ["Car Loan", "Other Debt"];
const ACCOUNT_TYPES = [...ASSET_TYPES, ...LIABILITY_TYPES];
const RISK_LEVELS = ["Low", "Medium", "High"];

const DEFAULT_SETTINGS = {
  emergencyFundMonths: 3,
  rentTarget: 28000,
  companyTarget: 7,
  companyMax: 8,
  cryptoTarget: 3,
  allocLow: 25,
  allocMed: 35,
  allocHigh: 40,
};

const CONSTITUTION = [
  "Build financial independence rather than maximising lifestyle.",
  "Current lifestyle must be sustainable on current income.",
  "Future salary increases are upside, not required for today's plan.",
  "Maintain meaningful liquidity during major life transitions.",
  "Avoid unnecessary high-interest debt.",
  "Diversify investments geographically and by asset class.",
  "Do not allow any single speculative investment to threaten financial independence.",
  "Company shares are a controlled \u201cbet on myself,\u201d not the foundation of the portfolio.",
  "Use TFSA and RA tax advantages deliberately.",
  "Use windfalls strategically rather than allowing lifestyle inflation.",
  "Property is optional, not mandatory.",
  "Renting can be financially rational if it preserves flexibility and allows capital to remain invested.",
  "Review major assumptions when circumstances change.",
  "Actual financial data takes precedence over forecasts.",
  "Never make a major fixed financial commitment based solely on expected future income.",
];

const STORAGE_KEY = "fp-state-v1";
const DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  accounts: [],
  transactions: [],
  budgets: {},
  assumptions: [],
  snapshots: [],
};

/* ---------------------------------------------------------------------- */
/*  Helpers                                                                */
/* ---------------------------------------------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fmt = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}R${Math.abs(Math.round(v)).toLocaleString("en-ZA")}`;
};
const pct = (n, d = 1) => `${(Number(n) || 0).toFixed(d)}%`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = (dateStr) => (dateStr || todayStr()).slice(0, 7);
const thisMonthKey = () => todayStr().slice(0, 7);
const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};
const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const isIncomeCat = (cat) => INCOME_CATEGORIES.includes(cat);

function statusColor(variancePct, invert = false) {
  // variancePct: actual vs budget, positive = over budget for expenses
  const v = invert ? -variancePct : variancePct;
  if (v <= 5) return C.moss;
  if (v <= 15) return C.amber;
  return C.rust;
}

/* ---------------------------------------------------------------------- */
/*  Storage hook                                                           */
/* ---------------------------------------------------------------------- */

function useAppState() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...DEFAULT_STATE, ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } });
      }
    } catch (e) {
      // no saved state yet
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error("save failed", e);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded]);

  return [state, setState, loaded];
}

/* ---------------------------------------------------------------------- */
/*  Small UI primitives                                                    */
/* ---------------------------------------------------------------------- */

const Card = ({ children, style, ...rest }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18, ...style }} {...rest}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textFaint, marginBottom: 6 }}>
    {children}
  </div>
);

const Tag = ({ children, tone = "faint" }) => {
  const map = {
    actual: { bg: C.mossDim, fg: C.moss },
    assumption: { bg: C.amberDim, fg: C.amber },
    target: { bg: "#2C3A4A", fg: "#7FA6C9" },
    forecast: { bg: "#3A2E4A", fg: "#B092C9" },
    faint: { bg: C.panel2, fg: C.textFaint },
  };
  const s = map[tone] || map.faint;
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", background: s.bg, color: s.fg, padding: "2px 6px", borderRadius: 3 }}>
      {children}
    </span>
  );
};

const Dot = ({ color }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8, flexShrink: 0 }} />
);

const inputStyle = {
  background: C.bg,
  border: `1px solid ${C.line}`,
  borderRadius: 4,
  color: C.text,
  padding: "7px 9px",
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const Input = (props) => <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
const Select = (props) => (
  <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>
    {props.children}
  </select>
);

const btnBase = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 4,
  padding: "8px 14px",
  cursor: "pointer",
  border: `1px solid ${C.line}`,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
const Button = ({ children, variant = "default", style, ...rest }) => {
  const variants = {
    default: { background: C.panel2, color: C.text },
    primary: { background: C.gold, color: "#1B1710", border: `1px solid ${C.gold}` },
    ghost: { background: "transparent", color: C.textFaint, border: "1px solid transparent" },
    danger: { background: "transparent", color: C.rust, border: `1px solid ${C.rustDim}` },
  };
  return (
    <button {...rest} style={{ ...btnBase, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

/* ---------------------------------------------------------------------- */
/*  Main App                                                               */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [state, setState, loaded] = useAppState();
  const [tab, setTab] = useState("dashboard");
  const [month, setMonth] = useState(thisMonthKey());
  const [importOpen, setImportOpen] = useState(false);

  const patch = useCallback((fn) => setState((s) => fn(s) ?? s), [setState]);

  if (!loaded) {
    return (
      <div style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.textFaint, fontFamily: "'Inter', sans-serif" }}>
        Loading your ledger\u2026
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "budget", label: "Budget", icon: ScrollText },
    { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
    { id: "networth", label: "Net Worth", icon: PiggyBank },
    { id: "investments", label: "Investments", icon: TrendingUp },
    { id: "assumptions", label: "Assumptions", icon: HelpCircle },
    { id: "constitution", label: "Constitution", icon: ScrollText },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; }
        ::selection { background: ${C.gold}; color: #1B1710; }
        .fp-num { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .fp-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .fp-scroll::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 1px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <Header month={month} setMonth={setMonth} state={state} />

      <nav className="fp-scroll" style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: `1px solid ${C.line}`, padding: "0 20px", background: C.panel }}>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                background: "transparent", border: "none", cursor: "pointer",
                padding: "12px 12px", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
                color: active ? C.gold : C.textFaint,
                borderBottom: active ? `2px solid ${C.gold}` : "2px solid transparent",
              }}
            >
              <Icon size={14} /> {n.label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        {tab === "dashboard" && <Dashboard state={state} month={month} setTab={setTab} />}
        {tab === "budget" && <Budget state={state} patch={patch} month={month} setMonth={setMonth} />}
        {tab === "transactions" && <Transactions state={state} patch={patch} month={month} setMonth={setMonth} importOpen={importOpen} setImportOpen={setImportOpen} />}
        {tab === "networth" && <NetWorth state={state} patch={patch} month={month} />}
        {tab === "investments" && <Investments state={state} patch={patch} />}
        {tab === "assumptions" && <Assumptions state={state} patch={patch} />}
        {tab === "constitution" && <Constitution state={state} patch={patch} setState={setState} />}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Header                                                                  */
/* ---------------------------------------------------------------------- */

function Header({ month, setMonth, state }) {
  const totalAssets = state.accounts.filter((a) => !a.isLiability).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalLiab = state.accounts.filter((a) => a.isLiability).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = totalAssets - totalLiab;

  return (
    <header style={{ borderBottom: `1px solid ${C.line}`, padding: "20px 20px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textFainter, marginBottom: 4 }}>
            Financial Position Statement
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 26, margin: 0, color: C.text }}>
            Net worth {fmt(netWorth)}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} style={{ ...btnBase, background: "transparent", padding: "6px 10px" }}>{"\u2190"}</button>
          <div className="fp-num" style={{ fontSize: 13, minWidth: 130, textAlign: "center", color: C.textFaint }}>{monthLabel(month)}</div>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} style={{ ...btnBase, background: "transparent", padding: "6px 10px" }}>{"\u2192"}</button>
          <button onClick={() => setMonth(thisMonthKey())} style={{ ...btnBase, background: "transparent", padding: "6px 10px", fontSize: 11, color: C.textFaint }}>today</button>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard                                                               */
/* ---------------------------------------------------------------------- */

function computeMonthFigures(state, month) {
  const txns = state.transactions.filter((t) => monthKey(t.date) === month);
  const budgetMap = state.budgets[month] || {};

  const incomeActual = txns.filter((t) => isIncomeCat(t.category)).reduce((s, t) => s + Number(t.amount), 0);
  const expenseActual = txns.filter((t) => !isIncomeCat(t.category) && t.category !== INVESTMENT_CATEGORY).reduce((s, t) => s + Number(t.amount), 0);
  const investActual = txns.filter((t) => t.category === INVESTMENT_CATEGORY).reduce((s, t) => s + Number(t.amount), 0);

  const incomeBudget = INCOME_CATEGORIES.reduce((s, c) => s + (Number(budgetMap[c]) || 0), 0);
  const expenseBudget = EXPENSE_CATEGORIES.reduce((s, c) => s + (Number(budgetMap[c]) || 0), 0);
  const investBudget = Number(budgetMap[INVESTMENT_CATEGORY]) || 0;

  const freeCashFlow = incomeActual - expenseActual;
  const remainingCash = freeCashFlow - investActual;
  const surplusDeficit = (incomeActual - expenseActual - investActual) - (incomeBudget - expenseBudget - investBudget);

  return { txns, incomeActual, expenseActual, investActual, incomeBudget, expenseBudget, investBudget, freeCashFlow, remainingCash, surplusDeficit };
}

function buildAlerts(state, month) {
  const alerts = [];
  const { expenseActual, expenseBudget } = computeMonthFigures(state, month);
  const s = state.settings;

  if (expenseBudget > 0 && expenseActual > expenseBudget) {
    alerts.push({ tone: "rust", text: `Spending is ${fmt(expenseActual - expenseBudget)} over budget this month.` });
  }

  const budgetMap = state.budgets[month] || {};
  const rentActual = state.transactions.filter((t) => monthKey(t.date) === month && t.category === "Rent").reduce((sum, t) => sum + Number(t.amount), 0);
  const rentBudget = Number(budgetMap.Rent) || 0;
  const rentFigure = rentActual || rentBudget;
  if (rentFigure > s.rentTarget) {
    alerts.push({ tone: "amber", text: `Rent (${fmt(rentFigure)}) is above your ${fmt(s.rentTarget)} target.` });
  }

  const portfolioAccounts = state.accounts.filter((a) => a.includeInPortfolio && !a.isLiability);
  const portfolioTotal = portfolioAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  if (portfolioTotal > 0) {
    const companyVal = portfolioAccounts.filter((a) => a.type === "Company Shares").reduce((sum, a) => sum + Number(a.balance), 0);
    const cryptoVal = portfolioAccounts.filter((a) => a.type === "Crypto").reduce((sum, a) => sum + Number(a.balance), 0);
    const companyPct = (companyVal / portfolioTotal) * 100;
    const cryptoPct = (cryptoVal / portfolioTotal) * 100;
    if (companyPct > s.companyMax) alerts.push({ tone: "rust", text: `Company shares are ${pct(companyPct)} of portfolio \u2014 above the ${s.companyMax}% constitutional maximum.` });
    else if (companyPct > s.companyTarget) alerts.push({ tone: "amber", text: `Company shares are ${pct(companyPct)} of portfolio, above the ${s.companyTarget}% target.` });
    if (cryptoPct > s.cryptoTarget + 1) alerts.push({ tone: "amber", text: `Crypto is ${pct(cryptoPct)} of portfolio, above the ${s.cryptoTarget}% target.` });

    const low = portfolioAccounts.filter((a) => a.riskCategory === "Low").reduce((sum, a) => sum + Number(a.balance), 0) / portfolioTotal * 100;
    const med = portfolioAccounts.filter((a) => a.riskCategory === "Medium").reduce((sum, a) => sum + Number(a.balance), 0) / portfolioTotal * 100;
    const high = portfolioAccounts.filter((a) => a.riskCategory === "High").reduce((sum, a) => sum + Number(a.balance), 0) / portfolioTotal * 100;
    if (Math.abs(low - s.allocLow) > 10) alerts.push({ tone: "amber", text: `Low-risk allocation (${pct(low)}) has drifted materially from your ${s.allocLow}% target.` });
    if (Math.abs(med - s.allocMed) > 10) alerts.push({ tone: "amber", text: `Medium-risk allocation (${pct(med)}) has drifted materially from your ${s.allocMed}% target.` });
    if (Math.abs(high - s.allocHigh) > 10) alerts.push({ tone: "amber", text: `High-risk allocation (${pct(high)}) has drifted materially from your ${s.allocHigh}% target.` });
  }

  const liquid = state.accounts.filter((a) => !a.isLiability && (a.type === "Cash" || a.type === "Emergency Savings")).reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const monthlyExpenseBase = expenseBudget || expenseActual;
  const emergencyMin = monthlyExpenseBase * s.emergencyFundMonths;
  if (emergencyMin > 0 && liquid < emergencyMin) {
    alerts.push({ tone: "rust", text: `Liquid cash (${fmt(liquid)}) is below your ${s.emergencyFundMonths}-month emergency fund minimum (${fmt(emergencyMin)}).` });
  }

  const carLoan = state.accounts.find((a) => a.type === "Car Loan");
  if (carLoan && carLoan.monthlyPayment) {
    const incomeBudget = INCOME_CATEGORIES.reduce((sum, c) => sum + (Number(budgetMap[c]) || 0), 0) || computeMonthFigures(state, month).incomeActual;
    if (incomeBudget > 0 && Number(carLoan.monthlyPayment) / incomeBudget > 0.2) {
      alerts.push({ tone: "amber", text: `Car repayment is ${pct((Number(carLoan.monthlyPayment) / incomeBudget) * 100)} of income \u2014 high relative to earnings.` });
    }
  }

  const today = new Date();
  state.assumptions.forEach((a) => {
    if (a.reviewDate && !a.actualValue && new Date(a.reviewDate) < today) {
      alerts.push({ tone: "amber", text: `Assumption "${a.name}" is past its review date and may be outdated.` });
    }
  });

  return alerts;
}

function Dashboard({ state, month, setTab }) {
  const fig = computeMonthFigures(state, month);
  const alerts = buildAlerts(state, month);
  const totalAssets = state.accounts.filter((a) => !a.isLiability).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalLiab = state.accounts.filter((a) => a.isLiability).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = totalAssets - totalLiab;

  const sorted = [...state.snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const prevSnap = sorted.filter((s) => s.month < month).slice(-1)[0];
  const yearAgoKey = shiftMonth(month, -12);
  const yearSnap = sorted.filter((s) => s.month <= yearAgoKey).slice(-1)[0];

  const budgetOk = fig.expenseBudget === 0 || fig.expenseActual <= fig.expenseBudget;
  const anyRust = alerts.some((a) => a.tone === "rust");
  const overall = anyRust ? { label: "Attention required", color: C.rust } : alerts.length ? { label: "Mostly on track", color: C.amber } : { label: "On track", color: C.moss };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Five answers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <MiniStat label="Cash available" value={fmt(fig.remainingCash)} sub={`free cash flow ${fmt(fig.freeCashFlow)}`} />
        <MiniStat label="Spent this month" value={fmt(fig.expenseActual)} sub={fig.expenseBudget ? `of ${fmt(fig.expenseBudget)} budgeted` : "no budget set"} color={budgetOk ? C.moss : C.rust} />
        <MiniStat label="Investment allocation" value={fmt(fig.investActual)} sub={fig.investBudget ? `of ${fmt(fig.investBudget)} planned` : "no plan set"} />
        <MiniStat label="Net worth" value={fmt(netWorth)} sub={prevSnap ? `${netWorth - prevSnap.netWorth >= 0 ? "+" : ""}${fmt(netWorth - prevSnap.netWorth)} vs last snapshot` : "no prior snapshot"} />
        <MiniStat label="On track with plan" value={overall.label} color={overall.color} sub={`${alerts.length} item${alerts.length === 1 ? "" : "s"} flagged`} />
      </div>

      {/* Flow strip */}
      <Card>
        <Label>Income \u2192 Expenses \u2192 Free cash flow \u2192 Investment allocation</Label>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          <FlowFigure label="Income" value={fig.incomeActual} budget={fig.incomeBudget} />
          <Arrow />
          <FlowFigure label="Expenses" value={fig.expenseActual} budget={fig.expenseBudget} invert />
          <Arrow />
          <FlowFigure label="Free cash flow" value={fig.freeCashFlow} budget={fig.incomeBudget - fig.expenseBudget} highlight />
          <Arrow />
          <FlowFigure label="Investments" value={fig.investActual} budget={fig.investBudget} />
          <Arrow />
          <FlowFigure label="Remaining" value={fig.remainingCash} highlight />
        </div>
      </Card>

      {/* Net worth trend */}
      {sorted.length > 1 && (
        <Card>
          <Label>Net worth trend</Label>
          <div style={{ height: 180, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sorted.map((s) => ({ month: monthLabel(s.month).slice(0, 3) + " " + s.month.slice(2, 4), netWorth: s.netWorth }))}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="month" stroke={C.textFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis stroke={C.textFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${Math.round(v / 1000)}k`} width={55} />
                <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="netWorth" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Alerts */}
      <Card>
        <Label>Alerts</Label>
        {alerts.length === 0 ? (
          <div style={{ color: C.textFaint, fontSize: 13, marginTop: 6 }}>Nothing flagged \u2014 current position is within your constitutional guardrails.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                <AlertTriangle size={14} color={C[a.tone]} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={() => setTab("budget")}>Review budget \u2192</Button>
        <Button variant="ghost" onClick={() => setTab("transactions")}>Add transactions \u2192</Button>
        <Button variant="ghost" onClick={() => setTab("networth")}>Update accounts \u2192</Button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }) {
  return (
    <Card style={{ padding: 14 }}>
      <Label>{label}</Label>
      <div className="fp-num" style={{ fontSize: 22, fontWeight: 600, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function FlowFigure({ label, value, budget, invert, highlight }) {
  const variance = budget !== undefined && budget !== 0 ? ((value - budget) / Math.abs(budget)) * 100 : null;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 2 }}>{label}</div>
      <div className="fp-num" style={{ fontSize: 17, fontWeight: 600, color: highlight ? C.gold : C.text }}>{fmt(value)}</div>
      {variance !== null && (
        <div className="fp-num" style={{ fontSize: 10, color: statusColor(Math.abs(variance), false) }}>
          {variance >= 0 ? "+" : ""}{pct(variance, 0)} vs plan
        </div>
      )}
    </div>
  );
}
const Arrow = () => <span style={{ color: C.textFainter, fontSize: 16 }}>{"\u2192"}</span>;

/* ---------------------------------------------------------------------- */
/*  Budget                                                                  */
/* ---------------------------------------------------------------------- */

function Budget({ state, patch, month, setMonth }) {
  const budgetMap = state.budgets[month] || {};
  const fig = computeMonthFigures(state, month);

  const setBudget = (cat, val) => {
    patch((s) => ({
      ...s,
      budgets: { ...s.budgets, [month]: { ...(s.budgets[month] || {}), [cat]: val === "" ? undefined : Number(val) } },
    }));
  };

  const Section = ({ title, cats }) => {
    const totalBudget = cats.reduce((sum, c) => sum + (Number(budgetMap[c]) || 0), 0);
    const totalActual = cats.reduce((sum, c) => sum + state.transactions.filter((t) => monthKey(t.date) === month && t.category === c).reduce((a, t) => a + Number(t.amount), 0), 0);
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <Label>{title}</Label>
          <div className="fp-num" style={{ fontSize: 12, color: C.textFaint }}>
            budget {fmt(totalBudget)} &nbsp;\u00b7&nbsp; actual {fmt(totalActual)}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}`, color: C.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <td style={{ padding: "6px 4px" }}>Category</td>
              <td style={{ padding: "6px 4px", width: 120 }}>Budget</td>
              <td style={{ padding: "6px 4px", width: 100, textAlign: "right" }}>Actual</td>
              <td style={{ padding: "6px 4px", width: 100, textAlign: "right" }}>Variance</td>
              <td style={{ padding: "6px 4px", width: 24 }}></td>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const b = Number(budgetMap[c]) || 0;
              const a = state.transactions.filter((t) => monthKey(t.date) === month && t.category === c).reduce((sum, t) => sum + Number(t.amount), 0);
              const varAmt = a - b;
              const varPct = b !== 0 ? (varAmt / b) * 100 : (a > 0 ? 100 : 0);
              const col = b === 0 && a === 0 ? C.textFainter : statusColor(Math.abs(varPct));
              return (
                <tr key={c} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "6px 4px" }}>{c}</td>
                  <td style={{ padding: "4px" }}>
                    <Input type="number" value={budgetMap[c] ?? ""} placeholder="0" onChange={(e) => setBudget(c, e.target.value)} style={{ padding: "5px 8px" }} />
                  </td>
                  <td className="fp-num" style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(a)}</td>
                  <td className="fp-num" style={{ padding: "6px 4px", textAlign: "right", color: col }}>{varAmt >= 0 ? "+" : ""}{fmt(varAmt)}</td>
                  <td style={{ textAlign: "center" }}><Dot color={col} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Budget vs actual \u2014 {monthLabel(month)}</h2>
      </div>
      <Section title="Income" cats={INCOME_CATEGORIES} />
      <Section title="Expenses" cats={EXPENSE_CATEGORIES} />
      <Section title="Investment allocation" cats={[INVESTMENT_CATEGORY]} />
      <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div><Label>Surplus / deficit vs plan this month</Label><div className="fp-num" style={{ fontSize: 20, fontWeight: 600, color: fig.surplusDeficit >= 0 ? C.moss : C.rust }}>{fig.surplusDeficit >= 0 ? "+" : ""}{fmt(fig.surplusDeficit)}</div></div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Transactions + CSV Import                                              */
/* ---------------------------------------------------------------------- */

function Transactions({ state, patch, month, setMonth, importOpen, setImportOpen }) {
  const [form, setForm] = useState({ date: todayStr(), description: "", amount: "", category: "Other", type: "Variable", accountId: "" });
  const monthTxns = state.transactions.filter((t) => monthKey(t.date) === month).sort((a, b) => b.date.localeCompare(a.date));

  const addTxn = () => {
    if (!form.description || !form.amount) return;
    patch((s) => ({ ...s, transactions: [...s.transactions, { id: uid(), ...form, amount: Math.abs(Number(form.amount)) }] }));
    setForm({ date: todayStr(), description: "", amount: "", category: "Other", type: "Variable", accountId: "" });
  };
  const removeTxn = (id) => patch((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Transactions \u2014 {monthLabel(month)}</h2>
        <Button variant="primary" onClick={() => setImportOpen(true)}><Upload size={14} /> Import CSV</Button>
      </div>

      <Card>
        <Label>Quick add</Label>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px 140px 130px 140px auto", gap: 8, alignItems: "center", marginTop: 6 }}>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            <option value="">No account</option>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Button variant="primary" onClick={addTxn}><Plus size={14} /></Button>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="fp-scroll" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}`, color: C.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <td style={{ padding: "10px 12px" }}>Date</td>
                <td style={{ padding: "10px 12px" }}>Description</td>
                <td style={{ padding: "10px 12px" }}>Category</td>
                <td style={{ padding: "10px 12px" }}>Type</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>Amount</td>
                <td style={{ padding: "10px 12px", width: 30 }}></td>
              </tr>
            </thead>
            <tbody>
              {monthTxns.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: C.textFainter }}>No transactions this month yet.</td></tr>
              )}
              {monthTxns.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td className="fp-num" style={{ padding: "8px 12px", color: C.textFaint }}>{t.date}</td>
                  <td style={{ padding: "8px 12px" }}>{t.description}</td>
                  <td style={{ padding: "8px 12px" }}><Tag tone="faint">{t.category}</Tag></td>
                  <td style={{ padding: "8px 12px", color: C.textFaint }}>{t.type}</td>
                  <td className="fp-num" style={{ padding: "8px 12px", textAlign: "right", color: isIncomeCat(t.category) ? C.moss : C.text }}>{isIncomeCat(t.category) ? "+" : "\u2212"}{fmt(t.amount)}</td>
                  <td style={{ padding: "8px 12px" }}><button onClick={() => removeTxn(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textFainter }}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {importOpen && <ImportModal state={state} patch={patch} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function ImportModal({ state, patch, onClose }) {
  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState("");
  const [fields, setFields] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ date: "", description: "", amount: "" });
  const [preview, setPreview] = useState([]);
  const fileInput = useRef(null);

  const parseCsv = (text) => {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    setFields(result.meta.fields || []);
    setRows(result.data || []);
    const guess = (names) => (result.meta.fields || []).find((f) => names.some((n) => f.toLowerCase().includes(n))) || (result.meta.fields || [])[0] || "";
    setMapping({
      date: guess(["date"]),
      description: guess(["desc", "narrat", "memo", "detail"]),
      amount: guess(["amount", "value", "debit", "credit"]),
    });
    setStep(2);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCsv(ev.target.result);
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const built = rows.map((r) => {
      const rawAmt = parseFloat(String(r[mapping.amount] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      return {
        id: uid(),
        date: r[mapping.date] || todayStr(),
        description: r[mapping.description] || "(no description)",
        amount: Math.abs(rawAmt),
        category: rawAmt < 0 ? "Other" : "Other Income",
        type: "Variable",
        accountId: "",
      };
    });
    setPreview(built);
    setStep(3);
  };

  const updateRow = (id, field, val) => setPreview((p) => p.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const removeRow = (id) => setPreview((p) => p.filter((r) => r.id !== id));

  const commit = () => {
    patch((s) => ({ ...s, transactions: [...s.transactions, ...preview] }));
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, width: "100%", maxWidth: 780, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>Import transactions from CSV</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div className="fp-scroll" style={{ padding: 18, overflowY: "auto" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: C.textFaint }}>Upload a bank statement export, or paste CSV text directly.</div>
              <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ fontSize: 13, color: C.textFaint }} />
              <div style={{ fontSize: 12, color: C.textFainter }}>\u2014 or \u2014</div>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="date,description,amount&#10;2026-08-01,Salary,45000&#10;2026-08-02,Woolworths,-1250" rows={8} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }} />
              <div><Button variant="primary" onClick={() => raw && parseCsv(raw)} disabled={!raw}>Parse pasted CSV</Button></div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: C.textFaint }}>Map your columns ({rows.length} rows found).</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
                {["date", "description", "amount"].map((key) => (
                  <div key={key}>
                    <Label>{key}</Label>
                    <Select value={mapping[key]} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}>
                      {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" onClick={buildPreview}>Continue</Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, color: C.textFaint }}>Review and categorise {preview.length} transactions before importing. Amounts are read as positive; income vs expense is set by category.</div>
              <div className="fp-scroll" style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: C.panel2, color: C.textFaint, fontSize: 10, textTransform: "uppercase" }}>
                      <td style={{ padding: "6px 8px" }}>Date</td>
                      <td style={{ padding: "6px 8px" }}>Description</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>Amount</td>
                      <td style={{ padding: "6px 8px" }}>Category</td>
                      <td style={{ padding: "6px 8px" }}>Type</td>
                      <td></td>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td style={{ padding: "5px 8px" }}><Input value={r.date} onChange={(e) => updateRow(r.id, "date", e.target.value)} style={{ padding: "4px 6px", fontSize: 12 }} /></td>
                        <td style={{ padding: "5px 8px", minWidth: 160 }}><Input value={r.description} onChange={(e) => updateRow(r.id, "description", e.target.value)} style={{ padding: "4px 6px", fontSize: 12 }} /></td>
                        <td className="fp-num" style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(r.amount)}</td>
                        <td style={{ padding: "5px 8px" }}>
                          <Select value={r.category} onChange={(e) => updateRow(r.id, "category", e.target.value)} style={{ padding: "4px 6px", fontSize: 12 }}>
                            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          <Select value={r.type} onChange={(e) => updateRow(r.id, "type", e.target.value)} style={{ padding: "4px 6px", fontSize: 12 }}>
                            {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </Select>
                        </td>
                        <td><button onClick={() => removeRow(r.id)} style={{ background: "none", border: "none", color: C.textFainter, cursor: "pointer" }}><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button variant="primary" onClick={commit}><Check size={14} /> Import {preview.length} transactions</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Net Worth                                                               */
/* ---------------------------------------------------------------------- */

function NetWorth({ state, patch, month }) {
  const [form, setForm] = useState(blankAccount());
  function blankAccount() {
    return { name: "", type: "Cash", institution: "", balance: "", isLiability: false, includeInPortfolio: false, riskCategory: "Low", interestRate: "", monthlyPayment: "" };
  }

  const addAccount = () => {
    if (!form.name || form.balance === "") return;
    patch((s) => ({ ...s, accounts: [...s.accounts, { id: uid(), ...form, balance: Number(form.balance) }] }));
    setForm(blankAccount());
  };
  const updateAccount = (id, field, val) => patch((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, [field]: val } : a)) }));
  const removeAccount = (id) => patch((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));

  const assets = state.accounts.filter((a) => !a.isLiability);
  const liabilities = state.accounts.filter((a) => a.isLiability);
  const totalAssets = assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalLiab = liabilities.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = totalAssets - totalLiab;

  const saveSnapshot = () => {
    patch((s) => {
      const others = s.snapshots.filter((sn) => sn.month !== month);
      return { ...s, snapshots: [...others, { id: uid(), month, netWorth, assets: totalAssets, liabilities: totalLiab, date: todayStr() }] };
    });
  };

  const AccountTable = ({ title, list, liability }) => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <Label>{title}</Label>
        <div className="fp-num" style={{ fontSize: 13, color: C.textFaint }}>{fmt(list.reduce((s, a) => s + (Number(a.balance) || 0), 0))}</div>
      </div>
      {list.length === 0 && <div style={{ color: C.textFainter, fontSize: 13 }}>None added yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
            <div style={{ flex: "1 1 140px", fontWeight: 600, fontSize: 13 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: C.textFaint, minWidth: 100 }}>{a.type}</div>
            <Input type="number" value={a.balance} onChange={(e) => updateAccount(a.id, "balance", Number(e.target.value))} style={{ width: 130 }} />
            {!liability && (
              <label style={{ fontSize: 11, color: C.textFaint, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={!!a.includeInPortfolio} onChange={(e) => updateAccount(a.id, "includeInPortfolio", e.target.checked)} /> in portfolio
              </label>
            )}
            {!liability && a.includeInPortfolio && (
              <Select value={a.riskCategory || "Low"} onChange={(e) => updateAccount(a.id, "riskCategory", e.target.value)} style={{ width: 100 }}>
                {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            )}
            {liability && a.type === "Car Loan" && (
              <>
                <Input type="number" placeholder="Rate %" value={a.interestRate || ""} onChange={(e) => updateAccount(a.id, "interestRate", e.target.value)} style={{ width: 80 }} />
                <Input type="number" placeholder="Monthly pmt" value={a.monthlyPayment || ""} onChange={(e) => updateAccount(a.id, "monthlyPayment", e.target.value)} style={{ width: 100 }} />
              </>
            )}
            <button onClick={() => removeAccount(a.id)} style={{ background: "none", border: "none", color: C.textFainter, cursor: "pointer" }}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Net worth</h2>
        <Button variant="primary" onClick={saveSnapshot}>Save snapshot for {monthLabel(month)}</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
        <MiniStat label="Total assets" value={fmt(totalAssets)} />
        <MiniStat label="Total liabilities" value={fmt(totalLiab)} />
        <MiniStat label="Net worth" value={fmt(netWorth)} color={C.gold} />
      </div>

      <Card>
        <Label>Add account</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 130px 1fr auto", gap: 8, marginTop: 6 }}>
          <Input placeholder="Account name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, isLiability: LIABILITY_TYPES.includes(e.target.value) })}>
            <optgroup label="Assets">{ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            <optgroup label="Liabilities">{LIABILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
          </Select>
          <Input type="number" placeholder="Balance" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          <Input placeholder="Institution (optional)" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          <Button variant="primary" onClick={addAccount}><Plus size={14} /></Button>
        </div>
      </Card>

      <AccountTable title="Assets" list={assets} />
      <AccountTable title="Liabilities" list={liabilities} liability />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Investments                                                             */
/* ---------------------------------------------------------------------- */

function Investments({ state, patch }) {
  const portfolioAccounts = state.accounts.filter((a) => a.includeInPortfolio && !a.isLiability);
  const total = portfolioAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const byRisk = (risk) => portfolioAccounts.filter((a) => a.riskCategory === risk).reduce((s, a) => s + Number(a.balance), 0);
  const low = byRisk("Low"), med = byRisk("Medium"), high = byRisk("High");
  const companyVal = portfolioAccounts.filter((a) => a.type === "Company Shares").reduce((s, a) => s + Number(a.balance), 0);
  const cryptoVal = portfolioAccounts.filter((a) => a.type === "Crypto").reduce((s, a) => s + Number(a.balance), 0);
  const settings = state.settings;

  const AllocRow = ({ label, actual, target }) => {
    const actualPct = total ? (actual / total) * 100 : 0;
    const drift = actualPct - target;
    const col = Math.abs(drift) <= 5 ? C.moss : Math.abs(drift) <= 10 ? C.amber : C.rust;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span>{label}</span>
          <span className="fp-num">{pct(actualPct)} <span style={{ color: C.textFainter }}>(target {target}%)</span></span>
        </div>
        <div style={{ position: "relative", height: 8, background: C.panel2, borderRadius: 4, overflow: "visible" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(actualPct, 100)}%`, background: col, borderRadius: 4 }} />
          <div style={{ position: "absolute", left: `${Math.min(target, 100)}%`, top: -3, bottom: -3, width: 2, background: C.text }} title={`Target ${target}%`} />
        </div>
      </div>
    );
  };

  const SatelliteRow = ({ label, val, target, max }) => {
    const p = total ? (val / total) * 100 : 0;
    const col = p > max ? C.rust : p > target ? C.amber : C.moss;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center" }}><Dot color={col} />{label}</div>
        <div className="fp-num" style={{ fontSize: 13 }}>{fmt(val)} \u00b7 {pct(p)} <span style={{ color: C.textFainter }}>(target {target}%{max ? `, max ${max}%` : ""})</span></div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Investment portfolio</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
        <MiniStat label="Portfolio value" value={fmt(total)} sub={`${portfolioAccounts.length} holding${portfolioAccounts.length === 1 ? "" : "s"}`} />
        <MiniStat label="Company shares" value={pct(total ? (companyVal / total) * 100 : 0)} color={companyVal / total * 100 > settings.companyMax ? C.rust : C.text} />
        <MiniStat label="Crypto" value={pct(total ? (cryptoVal / total) * 100 : 0)} />
      </div>

      <Card>
        <Label>Strategic allocation by risk band</Label>
        <div style={{ marginTop: 10 }}>
          <AllocRow label="Low risk" actual={low} target={settings.allocLow} />
          <AllocRow label="Medium risk" actual={med} target={settings.allocMed} />
          <AllocRow label="High risk" actual={high} target={settings.allocHigh} />
        </div>
        <div style={{ fontSize: 11, color: C.textFainter, marginTop: 4 }}>The vertical mark shows your target; the bar shows actual allocation.</div>
      </Card>

      <Card>
        <Label>Satellite positions</Label>
        <SatelliteRow label="Company shares" val={companyVal} target={settings.companyTarget} max={settings.companyMax} />
        <SatelliteRow label="Crypto" val={cryptoVal} target={settings.cryptoTarget} />
      </Card>

      <Card>
        <Label>Holdings ({portfolioAccounts.length})</Label>
        {portfolioAccounts.length === 0 ? (
          <div style={{ color: C.textFainter, fontSize: 13, marginTop: 6 }}>Mark accounts as "in portfolio" on the Net Worth tab to see them here.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}`, color: C.textFaint, fontSize: 11, textTransform: "uppercase" }}>
                <td style={{ padding: "6px 4px" }}>Name</td><td style={{ padding: "6px 4px" }}>Type</td><td style={{ padding: "6px 4px" }}>Risk</td><td style={{ padding: "6px 4px", textAlign: "right" }}>Value</td><td style={{ padding: "6px 4px", textAlign: "right" }}>% of portfolio</td>
              </tr>
            </thead>
            <tbody>
              {portfolioAccounts.map((a) => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "6px 4px" }}>{a.name}</td>
                  <td style={{ padding: "6px 4px", color: C.textFaint }}>{a.type}</td>
                  <td style={{ padding: "6px 4px", color: C.textFaint }}>{a.riskCategory}</td>
                  <td className="fp-num" style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(a.balance)}</td>
                  <td className="fp-num" style={{ padding: "6px 4px", textAlign: "right" }}>{pct(total ? (a.balance / total) * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Assumptions                                                            */
/* ---------------------------------------------------------------------- */

function Assumptions({ state, patch }) {
  const [form, setForm] = useState({ name: "", value: "", source: "", confidence: "Medium", reviewDate: "" });

  const add = () => {
    if (!form.name) return;
    patch((s) => ({ ...s, assumptions: [...s.assumptions, { id: uid(), ...form, dateCreated: todayStr(), actualValue: "" }] }));
    setForm({ name: "", value: "", source: "", confidence: "Medium", reviewDate: "" });
  };
  const update = (id, field, val) => patch((s) => ({ ...s, assumptions: s.assumptions.map((a) => (a.id === id ? { ...a, [field]: val } : a)) }));
  const remove = (id) => patch((s) => ({ ...s, assumptions: s.assumptions.filter((a) => a.id !== id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Assumptions</h2>
      <div style={{ fontSize: 13, color: C.textFaint }}>Numbers that are currently uncertain \u2014 child maintenance, future income, settlement values. The app never silently turns these into actuals.</div>

      <Card>
        <Label>Add assumption</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 120px 140px auto", gap: 8, marginTop: 6 }}>
          <Input placeholder="Name (e.g. Child maintenance)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" placeholder="Assumed value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <Input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <Select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
            <option>Low</option><option>Medium</option><option>High</option>
          </Select>
          <Input type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} />
          <Button variant="primary" onClick={add}><Plus size={14} /></Button>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.assumptions.length === 0 && <Card><div style={{ color: C.textFainter, fontSize: 13 }}>No assumptions tracked yet.</div></Card>}
        {state.assumptions.map((a) => {
          const overdue = a.reviewDate && !a.actualValue && new Date(a.reviewDate) < new Date();
          return (
            <Card key={a.id}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    <Tag tone={a.actualValue ? "actual" : "assumption"}>{a.actualValue ? "Actual" : "Assumption"}</Tag>
                    {overdue && <Tag tone="assumption">Review overdue</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
                    Source: {a.source || "\u2014"} \u00b7 Confidence: {a.confidence} \u00b7 Created {a.dateCreated} {a.reviewDate && `\u00b7 Review by ${a.reviewDate}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div><Label>Assumed</Label><div className="fp-num">{fmt(a.value)}</div></div>
                  <div>
                    <Label>Actual (once known)</Label>
                    <Input type="number" value={a.actualValue} placeholder="\u2014" onChange={(e) => update(a.id, "actualValue", e.target.value)} style={{ width: 110 }} />
                  </div>
                  {a.actualValue && (
                    <div><Label>Difference</Label><div className="fp-num" style={{ color: Number(a.actualValue) - Number(a.value) >= 0 ? C.moss : C.rust }}>{fmt(Number(a.actualValue) - Number(a.value))}</div></div>
                  )}
                  <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", color: C.textFainter, cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Constitution                                                            */
/* ---------------------------------------------------------------------- */

function Constitution({ state, patch, setState }) {
  const s = state.settings;
  const setTarget = (key, val) => patch((st) => ({ ...st, settings: { ...st.settings, [key]: Number(val) } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financial-position-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const resetAll = () => {
    if (window.confirm("This deletes all data in this app permanently. Continue?")) {
      setState(DEFAULT_STATE);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, margin: 0 }}>My Financial Constitution</h2>
        <div style={{ fontSize: 13, color: C.textFaint, marginTop: 6 }}>Preserved unless deliberately revised. Every dashboard figure is measured against these rules, not the other way around.</div>
      </div>

      <Card>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {CONSTITUTION.map((c, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>{c}</li>
          ))}
        </ol>
      </Card>

      <Card>
        <Label>Data vocabulary</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginTop: 8 }}>
          <div><Tag tone="actual">Actual</Tag><div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>Confirmed \u2014 salary received, balances, settled expenses.</div></div>
          <div><Tag tone="faint">Budget</Tag><div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>What you've planned to spend or receive.</div></div>
          <div><Tag tone="assumption">Assumption</Tag><div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>Currently uncertain \u2014 may change. Never silently promoted to actual.</div></div>
          <div><Tag tone="target">Target</Tag><div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>A deliberate objective \u2014 target rent, allocation, TFSA contribution.</div></div>
          <div><Tag tone="forecast">Forecast</Tag><div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>Calculated projection based on assumptions \u2014 never a guarantee.</div></div>
        </div>
      </Card>

      <Card>
        <Label>Your targets</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginTop: 8 }}>
          <TargetField label="Emergency fund (months of expenses)" value={s.emergencyFundMonths} onChange={(v) => setTarget("emergencyFundMonths", v)} />
          <TargetField label="Rent target (R/month)" value={s.rentTarget} onChange={(v) => setTarget("rentTarget", v)} />
          <TargetField label="Company shares target (%)" value={s.companyTarget} onChange={(v) => setTarget("companyTarget", v)} />
          <TargetField label="Company shares max (%)" value={s.companyMax} onChange={(v) => setTarget("companyMax", v)} />
          <TargetField label="Crypto target (%)" value={s.cryptoTarget} onChange={(v) => setTarget("cryptoTarget", v)} />
          <TargetField label="Low-risk allocation target (%)" value={s.allocLow} onChange={(v) => setTarget("allocLow", v)} />
          <TargetField label="Medium-risk allocation target (%)" value={s.allocMed} onChange={(v) => setTarget("allocMed", v)} />
          <TargetField label="High-risk allocation target (%)" value={s.allocHigh} onChange={(v) => setTarget("allocHigh", v)} />
        </div>
      </Card>

      <Card>
        <Label>Data & privacy</Label>
        <div style={{ fontSize: 12, color: C.textFaint, margin: "8px 0 12px" }}>Your data is stored privately for you and is not shared. Export a backup any time, or delete everything.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={exportData}><Download size={14} /> Export JSON</Button>
          <Button variant="danger" onClick={resetAll}><Trash2 size={14} /> Delete all data</Button>
        </div>
      </Card>
    </div>
  );
}

function TargetField({ label, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
