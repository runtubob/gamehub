import { useState, useCallback } from "react";
import { useGetFinancialReport, useResetBalance, getGetFinancialReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Download, FileSpreadsheet, FileText, RefreshCw, TrendingUp, TrendingDown, Banknote, CreditCard, AlertTriangle } from "lucide-react";
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

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function fmtShort(d: string | Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Laporan() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("monthly");
  const [showReset, setShowReset] = useState(false);

  const { data: report, isLoading } = useGetFinancialReport(
    { period },
    { query: { queryKey: getGetFinancialReportQueryKey({ period }) } }
  );

  const resetBalance = useResetBalance();

  const handleReset = () => {
    resetBalance.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setShowReset(false);
        toast({ title: "Saldo berhasil direset", description: "Semua data transaksi telah dihapus." });
      },
      onError: (e: Error) => toast({ title: "Gagal reset", description: e.message, variant: "destructive" }),
    });
  };

  const exportExcel = useCallback(() => {
    if (!report) return;
    const { summary, periods, transactions, expenses } = report;

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["LAPORAN KEUANGAN GAMEHUB"],
      ["Periode", `${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`],
      [],
      ["RINGKASAN"],
      ["Total Pemasukan", summary.totalIncome],
      ["  - Rental PS", summary.rentalIncome],
      ["  - Penjualan Produk", summary.productIncome],
      ["  - Cash", summary.cashIncome],
      ["  - QRIS", summary.qrisIncome],
      ["Total Pengeluaran", summary.totalExpenses],
      ["  - Cash", summary.cashExpenses],
      ["  - QRIS", summary.qrisExpenses],
      ["Keuntungan Bersih", summary.netProfit],
    ]), "Ringkasan");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Periode", "Pemasukan", "Rental", "Produk", "Cash Masuk", "QRIS Masuk", "Pengeluaran", "Cash Keluar", "QRIS Keluar", "Keuntungan"],
      ...periods.map(p => [p.label, p.income, p.rentalIncome, p.productIncome, p.cashIncome, p.qrisIncome, p.expenses, p.cashExpenses, p.qrisExpenses, p.profit]),
    ]), "Per Periode");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Tanggal", "Jenis", "Keterangan", "Jumlah", "Metode"],
      ...transactions.map(t => [fmtShort(t.createdAt), t.type === "rental" ? "Rental" : "Produk", t.description, t.amount, t.paymentMethod.toUpperCase()]),
    ]), "Transaksi");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Tanggal", "Keterangan", "Jumlah", "Metode"],
      ...expenses.map(e => [fmtShort(e.createdAt), e.description, e.amount, e.paymentMethod.toUpperCase()]),
    ]), "Pengeluaran");

    XLSX.writeFile(wb, `laporan-gamehub-${period}-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "File Excel berhasil diunduh" });
  }, [report, period, toast]);

  const exportPDF = useCallback(() => {
    if (!report) return;
    const { summary, periods, transactions, expenses } = report;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN KEUANGAN GAMEHUB", 14, 20);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${fmt(summary.startDate)} s/d ${fmt(summary.endDate)}`, 14, 28);
    doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [["Keterangan", "Jumlah"]],
      body: [
        ["Total Pemasukan", formatRp(summary.totalIncome)],
        ["  Rental PS", formatRp(summary.rentalIncome)],
        ["  Penjualan Produk", formatRp(summary.productIncome)],
        ["  Cash", formatRp(summary.cashIncome)],
        ["  QRIS", formatRp(summary.qrisIncome)],
        ["Total Pengeluaran", formatRp(summary.totalExpenses)],
        ["  Cash", formatRp(summary.cashExpenses)],
        ["  QRIS", formatRp(summary.qrisExpenses)],
        ["KEUNTUNGAN BERSIH", formatRp(summary.netProfit)],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: "right" } },
    });

    const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("RINCIAN PER PERIODE", 14, afterSummary);

    autoTable(doc, {
      startY: afterSummary + 4,
      head: [["Periode", "Pemasukan", "Cash", "QRIS", "Pengeluaran", "Keuntungan"]],
      body: periods.map(p => [p.label, formatRp(p.income), formatRp(p.cashIncome), formatRp(p.qrisIncome), formatRp(p.expenses), formatRp(p.profit)]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });

    doc.addPage();
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("DAFTAR TRANSAKSI", 14, 20);

    autoTable(doc, {
      startY: 26,
      head: [["Tanggal", "Keterangan", "Jumlah", "Metode"]],
      body: transactions.map(t => [fmtShort(t.createdAt), t.description, formatRp(t.amount), t.paymentMethod.toUpperCase()]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 2: { halign: "right" } },
    });

    const afterTx = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("DAFTAR PENGELUARAN", 14, afterTx);

    autoTable(doc, {
      startY: afterTx + 4,
      head: [["Tanggal", "Keterangan", "Jumlah", "Metode"]],
      body: expenses.map(e => [fmtShort(e.createdAt), e.description, formatRp(e.amount), e.paymentMethod.toUpperCase()]),
      theme: "striped",
      headStyles: { fillColor: [239, 68, 68] },
      columnStyles: { 2: { halign: "right" } },
    });

    doc.save(`laporan-gamehub-${period}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "File PDF berhasil diunduh" });
  }, [report, period, toast]);

  const s = report?.summary;
  const maxIncome = report ? Math.max(...report.periods.map(p => p.income), 1) : 1;
  const maxExpense = report ? Math.max(...report.periods.map(p => p.expenses), 1) : 1;
  const maxBar = Math.max(maxIncome, maxExpense);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Laporan Keuangan</h1>
          {s && <p className="text-xs text-muted-foreground mt-0.5">{fmt(s.startDate)} — {fmt(s.endDate)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={!report} className="flex items-center gap-1.5 px-3 py-2 bg-chart-3/15 text-chart-3 border border-chart-3/30 rounded-lg text-xs font-medium hover:bg-chart-3/25 disabled:opacity-40">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPDF} disabled={!report} className="flex items-center gap-1.5 px-3 py-2 bg-primary/15 text-primary border border-primary/30 rounded-lg text-xs font-medium hover:bg-primary/25 disabled:opacity-40">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setShowReset(true)} className="flex items-center gap-1.5 px-3 py-2 bg-destructive/15 text-destructive border border-destructive/30 rounded-lg text-xs font-medium hover:bg-destructive/25">
            <RefreshCw size={14} /> Reset Saldo
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map(({ key, label }) => (
          <button key={key} onClick={() => setPeriod(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${period === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : !s ? null : (
        <>
          {/* Summary Cards */}
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

          {/* Chart */}
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

          {/* Period Table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-sm">Rincian Per Periode</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Periode</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Pemasukan</th>
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
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(p.cashIncome)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(p.qrisIncome)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-destructive">{formatRp(p.expenses)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right font-semibold ${p.profit >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(p.profit)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/20 font-bold">
                    <td className="px-4 py-2.5 text-sm">Total</td>
                    <td className="px-4 py-2.5 text-sm text-right text-chart-3">{formatRp(s.totalIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(s.cashIncome)}</td>
                    <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden md:table-cell">{formatRp(s.qrisIncome)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-destructive">{formatRp(s.totalExpenses)}</td>
                    <td className={`px-4 py-2.5 text-sm text-right ${s.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(s.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transactions list */}
          {report.transactions.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Semua Transaksi <span className="text-muted-foreground font-normal">({report.transactions.length})</span></h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tanggal</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Keterangan</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Jumlah</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Metode</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {report.transactions.slice(0, 50).map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtShort(t.createdAt)}</td>
                        <td className="px-4 py-2 text-xs text-foreground hidden sm:table-cell">{t.description}</td>
                        <td className="px-4 py-2 text-sm text-right text-chart-3 font-medium">{formatRp(t.amount)}</td>
                        <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.paymentMethod === "cash" ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"}`}>{t.paymentMethod.toUpperCase()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.transactions.length > 50 && <p className="text-xs text-muted-foreground text-center py-3">Menampilkan 50 dari {report.transactions.length} transaksi. Export Excel/PDF untuk data lengkap.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reset Confirmation Modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/30 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-destructive" /></div>
              <div>
                <h3 className="font-bold text-foreground">Reset Saldo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Semua data <span className="text-foreground font-medium">transaksi dan pengeluaran</span> akan dihapus permanen. Stok produk tidak akan terpengaruh.</p>
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
