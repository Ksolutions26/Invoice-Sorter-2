import { useState, useRef, useEffect } from "react";

const DEFAULT_FOLDERS = [
  "Job Material Purchased","Villages-Bonds, Contractor License","Auto/Truck Exp",
  "Gas & Fuel & Propane","Tools & Sm Equip","Freight Exp","Garbage & Haul Off-Jobs",
  "Training","Uniforms","Security","Advertising & Mktg","Office Supplies",
  "Phones","Subscriptions","Safety","Misc",
];

const FOLDER_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200","bg-purple-100 text-purple-800 border-purple-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200","bg-green-100 text-green-800 border-green-200",
  "bg-red-100 text-red-800 border-red-200","bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200","bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200","bg-gray-100 text-gray-800 border-gray-200",
];
const FOLDER_ICONS = ["📁","🤝","📦","💡","💰","🧾","🏢","📋","🗂️","📂"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

interface Invoice {
  id: string;
  file: File;
  name: string;
  status: "processing" | "done" | "error";
  folder: string | null;
  vendor?: string;
  amount?: string;
  date?: string;
  description?: string;
}

interface RecurringBill {
  id: string;
  vendor: string;
  category: string;
  amount: string;
  months: number[];
  manual: boolean;
}

export default function App() {
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [dismissedVendors, setDismissedVendors] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [activeTab, setActiveTab] = useState("invoices");
  const [newBill, setNewBill] = useState({ vendor: "", category: DEFAULT_FOLDERS[0], amount: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("recurring_bills"); if (s) setRecurringBills(JSON.parse(s)); } catch {}
    try { const s = localStorage.getItem("dismissed_vendors"); if (s) setDismissedVendors(JSON.parse(s)); } catch {}
    try { const s = localStorage.getItem("folders"); if (s) setFolders(JSON.parse(s)); } catch {}
  }, []);

  const persistBills = (bills: RecurringBill[]) => { try { localStorage.setItem("recurring_bills", JSON.stringify(bills)); } catch {} };
  const persistFolders = (f: string[]) => { try { localStorage.setItem("folders", JSON.stringify(f)); } catch {} };

  const getFolderColor = (folder: string) => FOLDER_COLORS[folders.indexOf(folder) % FOLDER_COLORS.length] || FOLDER_COLORS[0];
  const getFolderIcon = (folder: string) => FOLDER_ICONS[folders.indexOf(folder) % FOLDER_ICONS.length] || "📁";

  useEffect(() => {
    const doneInvoices = invoices.filter(inv => inv.status === "done" && inv.vendor && inv.date);
    const vendorMonths: Record<string, { vendor: string; category: string; months: Set<number>; amount: string }> = {};
    for (const inv of doneInvoices) {
      const d = new Date(inv.date!);
      if (isNaN(d.getTime())) continue;
      const key = `${inv.vendor}||${inv.folder}`;
      if (!vendorMonths[key]) vendorMonths[key] = { vendor: inv.vendor!, category: inv.folder!, months: new Set(), amount: inv.amount || "" };
      vendorMonths[key].months.add(d.getMonth());
    }
    setRecurringBills(prev => {
      const manual = prev.filter(b => b.manual);
      const autoDetected = Object.entries(vendorMonths)
        .filter(([, v]) => v.months.size >= 2)
        .map(([key, v]) => ({ id: `auto-${key}`, vendor: v.vendor, category: v.category, amount: v.amount, months: Array.from({ length: 12 }, (_, i) => i), manual: false }))
        .filter(b => !manual.find(m => m.vendor.toLowerCase() === b.vendor.toLowerCase()))
        .filter(b => !dismissedVendors.includes(b.vendor.toLowerCase()));
      const merged = [...manual, ...autoDetected];
      persistBills(merged);
      return merged;
    });
  }, [invoices]);

  const missingBills = recurringBills.filter(bill => {
    if (!bill.months.includes(currentMonth)) return false;
    return !invoices.some(inv =>
      inv.status === "done" &&
      inv.vendor?.toLowerCase().includes(bill.vendor.toLowerCase()) &&
      inv.date && (() => { const d = new Date(inv.date!); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })()
    );
  });

  const addManualBill = () => {
    if (!newBill.vendor.trim()) return;
    const bill: RecurringBill = { id: `manual-${Date.now()}`, vendor: newBill.vendor.trim(), category: newBill.category, amount: newBill.amount, months: Array.from({ length: 12 }, (_, i) => i), manual: true };
    setRecurringBills(prev => { const updated = [...prev, bill]; persistBills(updated); return updated; });
    setNewBill({ vendor: "", category: folders[0], amount: "" });
  };

  const removeRecurring = (id: string) => {
    const bill = recurringBills.find(b => b.id === id);
    setRecurringBills(prev => { const updated = prev.filter(b => b.id !== id); persistBills(updated); return updated; });
    if (bill && !bill.manual) {
      setDismissedVendors(prev => { const updated = [...prev, bill.vendor.toLowerCase()]; try { localStorage.setItem("dismissed_vendors", JSON.stringify(updated)); } catch {} return updated; });
    }
  };

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name || folders.includes(name)) return;
    const updated = [...folders, name];
    setFolders(updated); persistFolders(updated); setNewFolderName("");
    newFolderInputRef.current?.focus();
  };

  const renameFolder = (idx: number) => {
    const name = editingName.trim();
    if (!name || (folders.includes(name) && folders[idx] !== name)) return;
    const old = folders[idx];
    const updated = folders.map((f, i) => i === idx ? name : f);
    setFolders(updated); persistFolders(updated);
    setInvoices(prev => prev.map(inv => inv.folder === old ? { ...inv, folder: name } : inv));
    if (activeFolder === old) setActiveFolder(name);
    setEditingFolder(null); setEditingName("");
  };

  const deleteFolder = (idx: number) => {
    const name = folders[idx];
    const fallback = folders.find((_, i) => i !== idx) || null;
    const updated = folders.filter((_, i) => i !== idx);
    setFolders(updated); persistFolders(updated);
    setInvoices(prev => prev.map(inv => inv.folder === name ? { ...inv, folder: fallback } : inv));
    if (activeFolder === name) setActiveFolder(null);
  };

  const analyzeInvoice = async (base64Data: string) => {
    const response = await fetch("/.netlify/functions/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Data, folders })
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Function error ${response.status}: ${err}`);
    }
    return await response.json();
  };

  const processFiles = async (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf");
    if (!pdfs.length) return;
    for (const file of pdfs) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      setInvoices(prev => [...prev, { id, file, name: file.name, status: "processing", folder: null }]);
      try {
        const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
        const result = await analyzeInvoice(base64);
        if (result.folder && !folders.includes(result.folder)) result.folder = folders[0];
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: "done", ...result } : inv));
      } catch (err: any) {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: "error", folder: folders[0], description: `Error: ${err?.message || String(err)}` } : inv));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); };

  const exportToCSV = () => {
    const headers = ["TxnDate","Vendor","Amount","Account","Memo","DocNumber"];
    const rows = invoices.filter(inv => inv.status === "done").map(inv => [inv.date||"", inv.vendor||"", inv.amount?(inv.amount.replace(/[^0-9.]/g,"")):""  , inv.folder||"", inv.description||"", inv.name]);
    const escape = (v: string) => `"${String(v).replace(/"/g,'""')}"`;
    const csv = [headers,...rows].map(r=>r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`invoices_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFolder = (folder: string) => {
    invoices.filter(inv=>inv.folder===folder&&inv.status==="done").forEach(inv=>{ const url=URL.createObjectURL(inv.file); const a=document.createElement("a"); a.href=url; a.download=`[${folder}] ${inv.name}`; a.click(); URL.revokeObjectURL(url); });
  };

  const downloadSingle = (inv: Invoice) => {
    const url=URL.createObjectURL(inv.file); const a=document.createElement("a"); a.href=url; a.download=`[${inv.folder}] ${inv.name}`; a.click(); URL.revokeObjectURL(url);
  };

  const folderCounts = folders.reduce((acc,f)=>{ acc[f]=invoices.filter(inv=>inv.folder===f).length; return acc; },{} as Record<string,number>);
  const displayed = activeFolder ? invoices.filter(inv=>inv.folder===activeFolder) : invoices;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📂 Invoice Sorter</h1>
            <p className="text-gray-500 text-sm mt-0.5">Upload PDFs — Claude reads & sorts them automatically</p>
          </div>
          <div className="flex gap-2">
            {invoices.some(inv=>inv.status==="done") && (
              <button onClick={exportToCSV} className="text-sm px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium">⬇ Export to Excel</button>
            )}
            <button onClick={()=>setShowFolderManager(m=>!m)} className="text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shadow-sm">⚙️ Folders</button>
          </div>
        </div>

        {missingBills.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors" onClick={()=>setActiveTab("missing")}>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="font-semibold text-amber-800 text-sm">{missingBills.length} recurring bill{missingBills.length>1?"s":""} missing for {MONTHS[currentMonth]} {currentYear}</span>
            </div>
            <span className="text-xs text-amber-600 underline">View →</span>
          </div>
        )}

        {showFolderManager && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">Manage Folders</h2>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {folders.map((f,i)=>(
                <div key={f} className="flex items-center gap-2">
                  <span>{getFolderIcon(f)}</span>
                  {editingFolder===i ? (
                    <>
                      <input className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none" value={editingName} onChange={e=>setEditingName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")renameFolder(i);if(e.key==="Escape"){setEditingFolder(null);setEditingName("");}}} autoFocus />
                      <button onClick={()=>renameFolder(i)} className="text-xs text-blue-600 hover:underline">Save</button>
                      <button onClick={()=>{setEditingFolder(null);setEditingName("");}} className="text-xs text-gray-400 hover:underline">Cancel</button>
                    </>
                  ):(
                    <>
                      <span className={`flex-1 text-sm font-medium px-2 py-1 rounded-lg border ${getFolderColor(f)}`}>{f}</span>
                      <span className="text-xs text-gray-400">{folderCounts[f]||0}</span>
                      <button onClick={()=>{setEditingFolder(i);setEditingName(f);}} className="text-xs text-gray-400 hover:text-blue-500 px-1">✏️</button>
                      <button onClick={()=>deleteFolder(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input ref={newFolderInputRef} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-300" placeholder="New folder name…" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addFolder();}} />
              <button onClick={addFolder} disabled={!newFolderName.trim()} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">+ Add</button>
            </div>
          </div>
        )}

        <div className={`border-2 border-dashed rounded-xl p-8 text-center mb-5 cursor-pointer transition-all ${dragOver?"border-blue-400 bg-blue-50":"border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50"}`}
          onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onClick={()=>fileInputRef.current?.click()}>
          <div className="text-4xl mb-2">📄</div>
          <p className="font-semibold text-gray-700">Drop PDF invoices here or click to upload</p>
          <p className="text-sm text-gray-400 mt-1">Multiple files supported</p>
          <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={e=>processFiles(e.target.files)} />
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {["invoices","missing","recurring"].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${activeTab===tab?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab==="missing"?`⚠️ Missing${missingBills.length>0?` (${missingBills.length})`:""}`:tab==="recurring"?"🔁 Recurring":"📄 Invoices"}
            </button>
          ))}
        </div>

        {activeTab==="invoices" && (
          <div className="flex gap-4">
            <div className="w-44 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Folders</p>
              <button onClick={()=>setActiveFolder(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${!activeFolder?"bg-gray-200 text-gray-900":"text-gray-600 hover:bg-gray-100"}`}>All ({invoices.length})</button>
              {folders.map(f=>(
                <button key={f} onClick={()=>setActiveFolder(f===activeFolder?null:f)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors flex items-center justify-between ${activeFolder===f?"bg-gray-200 text-gray-900":"text-gray-600 hover:bg-gray-100"}`}>
                  <span className="truncate">{getFolderIcon(f)} {f}</span>
                  {folderCounts[f]>0&&<span className="text-xs bg-gray-300 text-gray-700 rounded-full px-1.5 shrink-0 ml-1">{folderCounts[f]}</span>}
                </button>
              ))}
              {activeFolder&&folderCounts[activeFolder]>0&&(
                <button onClick={()=>downloadFolder(activeFolder)} className="w-full mt-3 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">⬇ Download All</button>
              )}
            </div>
            <div className="flex-1 space-y-3">
              {displayed.length===0&&<div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-gray-200">No invoices here yet</div>}
              {displayed.map(inv=>(
                <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm truncate max-w-xs">{inv.name}</span>
                        {inv.status==="processing"&&<span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full animate-pulse">Analyzing…</span>}
                        {inv.status==="done"&&inv.folder&&<span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${getFolderColor(inv.folder)}`}>{getFolderIcon(inv.folder)} {inv.folder}</span>}
                        {inv.status==="error"&&<span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">Error</span>}
                      </div>
                      {inv.status==="done"&&(
                        <div className="mt-1.5 text-xs text-gray-500">
                          {inv.vendor&&<span className="mr-3">🏢 {inv.vendor}</span>}
                          {inv.amount&&<span className="mr-3">💵 {inv.amount}</span>}
                          {inv.date&&<span>📅 {inv.date}</span>}
                          {inv.description&&<p className="mt-1 text-gray-400 italic">{inv.description}</p>}
                        </div>
                      )}
                      {inv.status==="error"&&inv.description&&(
                        <p className="mt-1 text-xs text-red-400 italic">{inv.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inv.status==="done"&&(
                        <>
                          <select value={inv.folder||""} onChange={e=>setInvoices(prev=>prev.map(x=>x.id===inv.id?{...x,folder:e.target.value}:x))} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-700">
                            {folders.map(f=><option key={f} value={f}>{f}</option>)}
                          </select>
                          <button onClick={()=>downloadSingle(inv)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors">⬇</button>
                        </>
                      )}
                      <button onClick={()=>setInvoices(prev=>prev.filter(x=>x.id!==inv.id))} className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==="missing" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-1">Missing Bills — {MONTHS[currentMonth]} {currentYear}</h2>
            <p className="text-xs text-gray-400 mb-4">Recurring bills expected this month that haven't been uploaded yet.</p>
            {missingBills.length===0
              ? <div className="text-center text-green-600 py-8 text-sm font-medium">✅ All recurring bills accounted for this month!</div>
              : <div className="space-y-3">{missingBills.map(bill=>(
                  <div key={bill.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{bill.vendor}</p>
                      <p className="text-xs text-gray-500">{bill.category}{bill.amount?` · ${bill.amount}`:""} · {bill.manual?"Manually added":"Auto-detected"}</p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-medium">⚠️ Missing</span>
                  </div>
                ))}</div>
            }
          </div>
        )}

        {activeTab==="recurring" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-1">Recurring Bills</h2>
            <p className="text-xs text-gray-400 mb-4">Bills expected every month. Auto-detected from invoices appearing in 2+ months, or add manually.</p>
            <div className="flex gap-2 mb-5">
              <input className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-300" placeholder="Vendor name (e.g. Verizon)" value={newBill.vendor} onChange={e=>setNewBill(p=>({...p,vendor:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")addManualBill();}} />
              <select className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-700" value={newBill.category} onChange={e=>setNewBill(p=>({...p,category:e.target.value}))}>
                {folders.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
              <input className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-300" placeholder="Amount" value={newBill.amount} onChange={e=>setNewBill(p=>({...p,amount:e.target.value}))} />
              <button onClick={addManualBill} disabled={!newBill.vendor.trim()} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">+ Add</button>
            </div>
            {recurringBills.length===0
              ? <div className="text-center text-gray-400 py-8 text-sm">No recurring bills yet. Upload invoices across multiple months or add manually.</div>
              : <div className="space-y-2">{recurringBills.map(bill=>(
                  <div key={bill.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{bill.vendor}</p>
                      <p className="text-xs text-gray-400">{bill.category}{bill.amount?` · ${bill.amount}`:""} · <span className={bill.manual?"text-blue-500":"text-green-500"}>{bill.manual?"Manual":"Auto-detected"}</span></p>
                    </div>
                    <button onClick={()=>removeRecurring(bill.id)} className="text-xs text-gray-400 border border-gray-200 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg px-2 py-1">✕ Not recurring</button>
                  </div>
                ))}</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
