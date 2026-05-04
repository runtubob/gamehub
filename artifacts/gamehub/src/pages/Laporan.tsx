import { useState, useCallback } from "react";
import { useGetFinancialReport, useResetBalance, getGetFinancialReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart3, Download, FileSpreadsheet, FileText, RefreshCw, TrendingUp, TrendingDown,
  Banknote, CreditCard, AlertTriangle, ChevronLeft, ChevronRight, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Period = "daily" | "weekly" | "monthly" | "3month" | "6month" | "yearly";

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "3month", label: "3 Bulan" },
  { key: "6month", label: "6 Bulan" },
  { key: "yearly", label: "Tahunan" },
];

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(d: string | Date) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDateOnly(d: string | Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTimeOnly(d: string | Date) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function nowStr() {
  return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const todayIso = () => new Date().toISOString().split("T")[0];

export default function Laporan() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("monthly");
  const [showReset, setShowReset] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");

  const isSuperAdmin = user?.role === "superadmin";

  // Build query params
  const queryParams: { period: Period; customDate?: string } = { period };
  if (period === "daily" && customDate && customDate !== todayIso()) {
    queryParams.customDate = customDate;
  }

  const { data: report, isLoading } = useGetFinancialReport(
    queryParams as { period: Period },
    {
      query: {
        queryKey: getGetFinancialReportQueryKey(queryParams as { period: Period }),
        queryFn: async () => {
          let url = `/api/reports/financial?period=${period}`;
          if (queryParams.customDate) url += `&customDate=${queryParams.customDate}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
          });
          if (!res.ok) throw new Error("Gagal memuat laporan");
          return res.json();
        },
      }
    }
  );

  const resetBalance = useResetBalance();
  const handleReset = () => {
    resetBalance.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setShowReset(false);
        toast({ title: "Saldo berhasil direset" });
      },
      onError: (e: Error) => toast({ title: "Gagal reset", description: e.message, variant: "destructive" }),
    });
  };

  // Navigate custom date for daily period
  const shiftCustomDate = (days: number) => {
    const base = customDate ? new Date(customDate) : new Date();
    base.setDate(base.getDate() + days);
    const iso = base.toISOString().split("T")[0];
    // Don't go into future
    if (iso > todayIso()) return;
    setCustomDate(iso === todayIso() ? "" : iso);
  };

  const shopName = "GameHub";

  // === EXCEL EXPORT ===
  const exportExcel = useCallback(() => {
    if (!report) return;
    const { summary, periods, transactions, expenses } = report;

    const wb = XLSX.utils.book_new();

    // ---------- Sheet 1: Ringkasan ----------
    const summaryData = [
      [`LAPORAN KEUANGAN — ${shopName.toUpperCase()}`],
      [""],
      ["Periode Laporan", `${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`],
      ["Dicetak pada", nowStr()],
      ["Dicetak oleh", user?.name ?? "—"],
      [""],
      ["RINGKASAN KEUANGAN"],
      [""],
      ["PENDAPATAN"],
      ["Total Pendapatan", summary.totalIncome],
      ["  Rental PS", summary.rentalIncome],
      ["  Penjualan Produk", summary.productIncome],
      ["  Metode Cash", summary.cashIncome],
      ["  Metode QRIS", summary.qrisIncome],
      [""],
      ["PENGELUARAN"],
      ["Total Pengeluaran", summary.totalExpenses],
      ["  Cash Keluar", summary.cashExpenses],
      ["  QRIS Keluar", summary.qrisExpenses],
      [""],
      ["KEUNTUNGAN BERSIH", summary.netProfit],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wch: 30 }, { wch: 20 }];
    // Format currency cells
    [9, 10, 11, 12, 13, 17, 18, 19, 21].forEach((row) => {
      const cell = ws1[XLSX.utils.encode_cell({ r: row, c: 1 })];
      if (cell) cell.z = '#,##0';
    });
    XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

    // ---------- Sheet 2: Per Periode ----------
    const periodHeaders = ["No.", "Periode", "Total Pendapatan", "Rental PS", "Produk", "Cash Masuk", "QRIS Masuk", "Total Pengeluaran", "Cash Keluar", "QRIS Keluar", "Keuntungan Bersih"];
    const periodRows = periods.map((p, i) => [
      i + 1, p.label, p.income, p.rentalIncome, p.productIncome,
      p.cashIncome, p.qrisIncome, p.expenses, p.cashExpenses, p.qrisExpenses, p.profit,
    ]);
    const totalRow = ["", "TOTAL", summary.totalIncome, summary.rentalIncome, summary.productIncome,
      summary.cashIncome, summary.qrisIncome, summary.totalExpenses, summary.cashExpenses, summary.qrisExpenses, summary.netProfit];
    const ws2 = XLSX.utils.aoa_to_sheet([
      [`LAPORAN KEUANGAN — ${shopName.toUpperCase()} | RINCIAN PER PERIODE`],
      [`Periode: ${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`],
      [""],
      periodHeaders,
      ...periodRows,
      totalRow,
    ]);
    ws2["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Per Periode");

    // ---------- Sheet 3: Transaksi ----------
    const txHeaders = ["No.", "Tanggal", "Jam", "Jenis", "Keterangan", "Jumlah (Rp)", "Metode Bayar", "Kasir"];
    const txRows = transactions.map((t, i) => {
      const dt = new Date(t.createdAt);
      return [i + 1, fmtDateOnly(dt), fmtTimeOnly(dt),
        t.type === "rental" ? "Rental PS" : "Penjualan Produk",
        t.description, t.amount, t.paymentMethod.toUpperCase(), t.userName ?? "—"];
    });
    const txTotal = ["", "", "", "", "TOTAL PEMASUKAN", transactions.reduce((s, t) => s + t.amount, 0), "", ""];
    const ws3 = XLSX.utils.aoa_to_sheet([
      [`DAFTAR TRANSAKSI PEMASUKAN — ${shopName.toUpperCase()}`],
      [`Periode: ${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`],
      [`Total: ${transactions.length} transaksi`],
      [""],
      txHeaders,
      ...txRows,
      txTotal,
    ]);
    ws3["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Transaksi");

    // ---------- Sheet 4: Pengeluaran ----------
    const expHeaders = ["No.", "Tanggal", "Jam", "Keterangan", "Jumlah (Rp)", "Metode Bayar"];
    const expRows = expenses.map((e, i) => {
      const dt = new Date(e.createdAt);
      return [i + 1, fmtDateOnly(dt), fmtTimeOnly(dt), e.description, e.amount, e.paymentMethod.toUpperCase()];
    });
    const expTotal = ["", "", "", "TOTAL PENGELUARAN", expenses.reduce((s, e) => s + e.amount, 0), ""];
    const ws4 = XLSX.utils.aoa_to_sheet([
      [`DAFTAR PENGELUARAN — ${shopName.toUpperCase()}`],
      [`Periode: ${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`],
      [`Total: ${expenses.length} pengeluaran`],
      [""],
      expHeaders,
      ...expRows,
      expTotal,
    ]);
    ws4["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 35 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws4, "Pengeluaran");

    XLSX.writeFile(wb, `laporan-${shopName.toLowerCase()}-${period}-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "File Excel berhasil diunduh" });
  }, [report, period, toast, user]);

  // === PDF EXPORT ===
  const exportPDF = useCallback(() => {
    if (!report) return;
    const { summary, periods, transactions, expenses } = report;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Colors
    const DARK = [15, 23, 42] as [number, number, number];
    const BLUE = [59, 130, 246] as [number, number, number];
    const GREEN = [22, 163, 74] as [number, number, number];
    const RED = [220, 38, 38] as [number, number, number];
    const LIGHT = [248, 250, 252] as [number, number, number];

    const addHeader = (title: string, subtitle?: string) => {
      // Header bar
      doc.setFillColor(...DARK);
      doc.rect(0, 0, pageW, 32, "F");

      // Accent stripe
      doc.setFillColor(...BLUE);
      doc.rect(0, 30, pageW, 2, "F");

      // Shop name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(shopName.toUpperCase(), 14, 13);

      // Title
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(title, 14, 22);

      // Subtitle (right-aligned)
      if (subtitle) {
        doc.setFontSize(8);
        doc.text(subtitle, pageW - 14, 22, { align: "right" });
      }

      doc.setTextColor(0, 0, 0);
    };

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...DARK);
        doc.rect(0, 285, pageW, 12, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.setTextColor(180, 180, 180);
        doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, 292, { align: "center" });
        doc.text(`Dicetak: ${nowStr()}`, 14, 292);
        doc.text(`Oleh: ${user?.name ?? "—"}`, pageW - 14, 292, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }
    };

    // ===== PAGE 1: Summary =====
    addHeader("LAPORAN KEUANGAN", `Periode: ${fmt(summary.startDate)} — ${fmt(summary.endDate)}`);

    // Info box
    doc.setFillColor(...LIGHT);
    doc.roundedRect(14, 36, pageW - 28, 14, 2, 2, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(`Periode: ${fmt(summary.startDate)} — ${fmt(summary.endDate)}`, 18, 43);
    doc.text(`Dicetak: ${nowStr()} · Oleh: ${user?.name ?? "—"}`, 18, 49);
    doc.setTextColor(0, 0, 0);

    // Summary KPI boxes
    const kpiY = 56;
    const boxW = (pageW - 28 - 9) / 4;
    const kpis = [
      { label: "Total Pemasukan", value: formatRp(summary.totalIncome), color: GREEN },
      { label: "Total Pengeluaran", value: formatRp(summary.totalExpenses), color: RED },
      { label: "Keuntungan Bersih", value: formatRp(summary.netProfit), color: summary.netProfit >= 0 ? GREEN : RED },
      { label: "Jumlah Transaksi", value: String(transactions.length), color: BLUE },
    ];
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (boxW + 3);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, kpiY, boxW, 20, 2, 2, "F");
      doc.setFillColor(...kpi.color);
      doc.rect(x, kpiY, 2, 20, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + 5, kpiY + 7);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + 5, kpiY + 15);
    });
    doc.setTextColor(0, 0, 0);

    // Summary table
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("RINGKASAN KEUANGAN", 14, kpiY + 28);

    autoTable(doc, {
      startY: kpiY + 32,
      head: [["Keterangan", "Jumlah"]],
      body: [
        [{ content: "PENDAPATAN", colSpan: 2, styles: { fontStyle: "bold", fillColor: DARK, textColor: [255, 255, 255] as [number, number, number] } }],
        ["Total Pendapatan", { content: formatRp(summary.totalIncome), styles: { textColor: GREEN, fontStyle: "bold" } }],
        ["  ├─ Rental PlayStation", formatRp(summary.rentalIncome)],
        ["  └─ Penjualan Produk", formatRp(summary.productIncome)],
        ["  ├─ Metode Pembayaran Cash", formatRp(summary.cashIncome)],
        ["  └─ Metode Pembayaran QRIS", formatRp(summary.qrisIncome)],
        [{ content: "PENGELUARAN", colSpan: 2, styles: { fontStyle: "bold", fillColor: DARK, textColor: [255, 255, 255] as [number, number, number] } }],
        ["Total Pengeluaran", { content: formatRp(summary.totalExpenses), styles: { textColor: RED, fontStyle: "bold" } }],
        ["  ├─ Pengeluaran Cash", formatRp(summary.cashExpenses)],
        ["  └─ Pengeluaran QRIS", formatRp(summary.qrisExpenses)],
        [
          { content: "KEUNTUNGAN BERSIH", styles: { fontStyle: "bold", fontSize: 10 } },
          { content: formatRp(summary.netProfit), styles: { fontStyle: "bold", fontSize: 10, textColor: summary.netProfit >= 0 ? GREEN : RED } }
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: BLUE, fontStyle: "bold", fontSize: 9, textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 130 }, 1: { halign: "right", cellWidth: 50 } },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: LIGHT },
    });

    const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Period table
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("RINCIAN PER PERIODE", 14, afterSummary);

    autoTable(doc, {
      startY: afterSummary + 4,
      head: [["Periode", "Pendapatan", "Rental", "Produk", "Cash", "QRIS", "Pengeluaran", "Profit"]],
      body: periods.map(p => [
        p.label, formatRp(p.income), formatRp(p.rentalIncome), formatRp(p.productIncome),
        formatRp(p.cashIncome), formatRp(p.qrisIncome), formatRp(p.expenses), formatRp(p.profit),
      ]),
      foot: [["TOTAL", formatRp(summary.totalIncome), formatRp(summary.rentalIncome), formatRp(summary.productIncome),
        formatRp(summary.cashIncome), formatRp(summary.qrisIncome), formatRp(summary.totalExpenses), formatRp(summary.netProfit)]],
      theme: "grid",
      headStyles: { fillColor: BLUE, fontSize: 8, textColor: [255, 255, 255] },
      footStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 26 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
      },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
    });

    // ===== PAGE 2: Transactions =====
    doc.addPage();
    addHeader("DAFTAR TRANSAKSI PEMASUKAN", `${transactions.length} transaksi | Total: ${formatRp(transactions.reduce((s, t) => s + t.amount, 0))}`);

    autoTable(doc, {
      startY: 38,
      head: [["No.", "Tanggal", "Jam", "Jenis", "Keterangan", "Jumlah", "Metode", "Kasir"]],
      body: transactions.map((t, i) => [
        i + 1, fmtDateOnly(t.createdAt), fmtTimeOnly(t.createdAt),
        t.type === "rental" ? "Rental" : "Produk",
        t.description, formatRp(t.amount), t.paymentMethod.toUpperCase(), t.userName ?? "—",
      ]),
      foot: [["", "", "", "", "TOTAL PEMASUKAN", formatRp(transactions.reduce((s, t) => s + t.amount, 0)), "", ""]],
      theme: "grid",
      headStyles: { fillColor: BLUE, fontSize: 8, textColor: [255, 255, 255] },
      footStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 22 }, 2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 16 }, 5: { halign: "right" }, 6: { cellWidth: 13, halign: "center" }, 7: { cellWidth: 22 },
      },
      styles: { fontSize: 8, overflow: "linebreak" },
      alternateRowStyles: { fillColor: LIGHT },
    });

    // ===== PAGE 3: Expenses =====
    doc.addPage();
    addHeader("DAFTAR PENGELUARAN", `${expenses.length} pengeluaran | Total: ${formatRp(expenses.reduce((s, e) => s + e.amount, 0))}`);

    autoTable(doc, {
      startY: 38,
      head: [["No.", "Tanggal", "Jam", "Keterangan", "Jumlah", "Metode"]],
      body: expenses.map((e, i) => [
        i + 1, fmtDateOnly(e.createdAt), fmtTimeOnly(e.createdAt),
        e.description, formatRp(e.amount), e.paymentMethod.toUpperCase(),
      ]),
      foot: [["", "", "", "TOTAL PENGELUARAN", formatRp(expenses.reduce((s, e) => s + e.amount, 0)), ""]],
      theme: "grid",
      headStyles: { fillColor: RED, fontSize: 8, textColor: [255, 255, 255] },
      footStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 22 }, 2: { cellWidth: 12, halign: "center" },
        4: { halign: "right" }, 5: { cellWidth: 13, halign: "center" },
      },
      styles: { fontSize: 8, overflow: "linebreak" },
      alternateRowStyles: { fillColor: LIGHT },
    });

    addFooter();
    doc.save(`laporan-${shopName.toLowerCase()}-${period}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "File PDF berhasil diunduh" });
  }, [report, period, toast, user]);

  const s = report?.summary;
  const maxBar = report ? Math.max(...report.periods.map(p => Math.max(p.income, p.expenses)), 1) : 1;

  const displayDate = customDate || todayIso();
  const isToday = !customDate || customDate === todayIso();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Laporan Keuangan</h1>
          {s && <p className="text-xs text-muted-foreground mt-0.5">{fmt(s.startDate)} — {fmt(s.endDate)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={!report}
            className="flex items-center gap-1.5 px-3 py-2 bg-chart-3/15 text-chart-3 border border-chart-3/30 rounded-lg text-xs font-medium hover:bg-chart-3/25 disabled:opacity-40">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPDF} disabled={!report}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/15 text-primary border border-primary/30 rounded-lg text-xs font-medium hover:bg-primary/25 disabled:opacity-40">
            <FileText size={14} /> PDF
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-destructive/15 text-destructive border border-destructive/30 rounded-lg text-xs font-medium hover:bg-destructive/25">
              <RefreshCw size={14} /> Reset Saldo
            </button>
          )}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map(({ key, label }) => (
          <button key={key} onClick={() => { setPeriod(key); if (key !== "daily") setCustomDate(""); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${period === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Date navigator — superadmin only, daily period */}
      {isSuperAdmin && period === "daily" && (
        <div className="flex items-center gap-3 bg-card border border-card-border rounded-xl px-4 py-3">
          <Calendar size={15} className="text-muted-foreground shrink-0" />
          <button onClick={() => shiftCustomDate(-1)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-foreground">
              {isToday ? "Hari Ini" : new Date(displayDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-xs text-muted-foreground">{fmt(displayDate)}</p>
          </div>
          <button onClick={() => shiftCustomDate(1)} disabled={isToday}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
          <input
            type="date"
            value={customDate || todayIso()}
            max={todayIso()}
            onChange={(e) => setCustomDate(e.target.value === todayIso() ? "" : e.target.value)}
            className="text-xs px-2 py-1.5 bg-input border border-border rounded-lg text-foreground focus:outline-none"
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : !s ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <BarChart3 size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Tidak ada data laporan untuk periode ini</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="text-chart-3" /><span className="text-xs text-muted-foreground">Total Pemasukan</span></div>
              <p className="text-xl font-bold text-chart-3">{formatRp(s.totalIncome)}</p>
              <div className="flex gap-3 mt-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Banknote size={10} /> {formatRp(s.cashIncome)}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> {formatRp(s.qrisIncome)}</span>
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingDown size={15} className="text-destructive" /><span className="text-xs text-muted-foreground">Total Pengeluaran</span></div>
              <p className="text-xl font-bold text-destructive">{formatRp(s.totalExpenses)}</p>
              <div className="flex gap-3 mt-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Banknote size={10} /> {formatRp(s.cashExpenses)}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> {formatRp(s.qrisExpenses)}</span>
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><BarChart3 size={15} className={s.netProfit >= 0 ? "text-primary" : "text-destructive"} /><span className="text-xs text-muted-foreground">Keuntungan Bersih</span></div>
              <p className={`text-xl font-bold ${s.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(s.netProfit)}</p>
              <p className="text-xs text-muted-foreground mt-1">Rental: {formatRp(s.rentalIncome)} · Produk: {formatRp(s.productIncome)}</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Download size={15} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Cash vs QRIS</span></div>
              <div className="space-y-1.5 mt-1">
                <div>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-muted-foreground flex items-center gap-1"><Banknote size={10} /> Cash</span><span className="font-medium">{formatRp(s.cashIncome - s.cashExpenses)}</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-chart-3 rounded-full" style={{ width: s.totalIncome > 0 ? `${(s.cashIncome / s.totalIncome) * 100}%` : "0%" }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> QRIS</span><span className="font-medium">{formatRp(s.qrisIncome - s.qrisExpenses)}</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: s.totalIncome > 0 ? `${(s.qrisIncome / s.totalIncome) * 100}%` : "0%" }} /></div>
                </div>
              </div>
            </div>
          </div>

          {report.periods.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-4">Grafik Pemasukan vs Pengeluaran</h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-max" style={{ height: "120px" }}>
                  {report.periods.map((p) => (
                    <div key={p.label} className="flex flex-col items-center gap-0.5" style={{ minWidth: Math.max(24, Math.floor(600 / report.periods.length)) + "px" }}>
                      <div className="flex items-end gap-0.5 h-20">
                        <div className="w-3 rounded-t transition-all bg-chart-3/80" style={{ height: `${Math.round((p.income / maxBar) * 80)}px` }} title={`Pemasukan: ${formatRp(p.income)}`} />
                        <div className="w-3 rounded-t transition-all bg-destructive/60" style={{ height: `${Math.round((p.expenses / maxBar) * 80)}px` }} title={`Pengeluaran: ${formatRp(p.expenses)}`} />
                      </div>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight" style={{ maxWidth: Math.max(24, Math.floor(600 / report.periods.length)) + "px" }}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-chart-3/80 inline-block" />Pemasukan</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-destructive/60 inline-block" />Pengeluaran</span>
              </div>
            </div>
          )}

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-sm">Rincian Per Periode</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Periode</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Pemasukan</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Rental</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Produk</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Cash</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">QRIS</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Pengeluaran</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Keuntungan</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {report.periods.map((p) => (
                    <tr key={p.label} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.label}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-chart-3 font-medium">{formatRp(p.income)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden sm:table-cell">{formatRp(p.rentalIncome)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(p.productIncome)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(p.cashIncome)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(p.qrisIncome)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-destructive">{formatRp(p.expenses)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right font-semibold ${p.profit >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(p.profit)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/20 font-bold">
                    <td className="px-4 py-2.5 text-sm">Total</td>
                    <td className="px-4 py-2.5 text-sm text-right text-chart-3">{formatRp(s.totalIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden sm:table-cell">{formatRp(s.rentalIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(s.productIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(s.cashIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(s.qrisIncome)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-destructive">{formatRp(s.totalExpenses)}</td>
                    <td className={`px-4 py-2.5 text-sm text-right font-semibold ${s.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(s.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transactions list */}
          {report.transactions.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Daftar Transaksi</h3>
                <span className="text-xs text-muted-foreground">{report.transactions.length} transaksi</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {report.transactions.slice(0, 50).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10">
                    <div>
                      <p className="text-sm text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{fmtShort(tx.createdAt)} · {tx.userName ?? "—"} · <span className={tx.paymentMethod === "cash" ? "text-chart-3" : "text-primary"}>{tx.paymentMethod?.toUpperCase()}</span></p>
                    </div>
                    <span className="text-sm font-semibold text-chart-3 shrink-0 ml-4">{formatRp(tx.amount)}</span>
                  </div>
                ))}
                {report.transactions.length > 50 && (
                  <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">... dan {report.transactions.length - 50} transaksi lainnya (download Excel/PDF untuk melihat semua)</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showReset && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/30 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-destructive" /></div>
              <div>
                <h3 className="font-bold text-foreground">Reset Semua Saldo?</h3>
                <p className="text-xs text-muted-foreground">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Semua data transaksi dan pengeluaran akan dihapus permanen. Laporan keuangan akan kembali ke nol.</p>
            <div className="flex gap-2">
              <button onClick={handleReset} disabled={resetBalance.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {resetBalance.isPending ? "Mereset..." : "Ya, Reset Sekarang"}
              </button>
              <button onClick={() => setShowReset(false)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
