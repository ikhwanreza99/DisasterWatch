import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  LockKeyhole,
  LogOut,
  Menu,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { IntelligenceReport } from "../domain/intelligence";
import { needLabel } from "../domain/intelligence";
import { adminApi, AdminError, type Page } from "./api";
import type { TokenSample } from "./tokenUsage";
import "./admin.css";

const GoogleStatusPage = lazy(() => import("../components/GoogleStatusPage"));

const menus = [
  {
    id: "reports",
    name: "Verifikasi Laporan",
    icon: FileCheck2,
    description:
      "Tinjau laporan warga dan pastikan informasi yang dibagikan dapat dipercaya.",
  },
  {
    id: "disasters",
    name: "Data Bencana",
    icon: Database,
    description:
      "Telusuri catatan bencana yang tersimpan dalam database DisasterWatch.",
  },
  {
    id: "services",
    name: "Status Layanan Aplikasi",
    icon: Activity,
    description: "Pantau koneksi API dan hasil pemeriksaan pipeline data.",
  },
  {
    id: "tokens",
    name: "Status Token Usage",
    icon: Sparkles,
    description: "Pantau pemakaian token yang dilaporkan oleh layanan AI.",
  },
] as const;
type Tab = (typeof menus)[number]["id"];
type Report = IntelligenceReport & {
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  evidenceUrls?: string[];
  targetCollection?: "reports" | "disasters";
};
const labels: Record<string, string> = {
  UNVERIFIED: "Belum ditinjau",
  AI_REVIEWED: "Menunggu verifikasi",
  CONFLICTING: "Perlu perhatian",
  VERIFIED: "Terverifikasi",
};
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }) + " WIB"
    : typeof value === "string" && value
      ? value
      : "—";
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Terjadi kesalahan. Silakan coba lagi.";
function Brand() {
  return (
    <a href="/" className="admin-brand" aria-label="DisasterWatch beranda">
      <span className="admin-logo">
        <Radio size={19} />
      </span>
      <strong>DisasterWatch</strong>
    </a>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`admin-badge ${status.toLowerCase()}`}>
      {labels[status] || status}
    </span>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-empty">
      <FileText size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <i>{icon}</i>
    </div>
  );
}
function tabFromLocation(): Tab {
  const value = window.location.hash.slice(1);
  return menus.some((m) => m.id === value) ? (value as Tab) : "reports";
}

export default function AdminPage() {
  const [session, setSession] = useState<{
    username: string;
    demo: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(tabFromLocation);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    adminApi<{ username: string; demo: boolean }>("/session")
      .then((data) => {
        if (active) setSession(data);
      })
      .catch((e) => {
        if (active && !(e instanceof AdminError && e.status === 401))
          setError(errorText(e));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const onHash = () => {
      if (menus.some((m) => m.id === window.location.hash.slice(1)))
        setTab(tabFromLocation());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = session
      ? `${menus.find((m) => m.id === tab)!.name} · DisasterWatch`
      : "Login Admin · DisasterWatch";
  }, [tab, session]);
  const expire = useCallback((e: unknown) => {
    if (e instanceof AdminError && e.status === 401) {
      setSession(null);
      setError("Sesi berakhir. Silakan login kembali.");
    }
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      setSession(
        await adminApi("/login", {
          username: data.get("username"),
          password: data.get("password"),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await adminApi("/logout", {});
      setSession(null);
      setMenuOpen(false);
    } catch (e) {
      expire(e);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const current = menus.find((m) => m.id === tab)!;
  if (checking)
    return (
      <div className="admin-app admin-loading" role="status">
        Memeriksa sesi admin…
      </div>
    );
  if (!session)
    return (
      <div className="admin-app admin-login">
        <header>
          <Brand />
          <span>Portal Verificator</span>
        </header>
        <main>
          <div className="admin-login-intro">
            <span className="admin-eyebrow">DISASTERWATCH · ADMIN</span>
            <h1>
              Informasi terpercaya.
              <br />
              <em>Respons lebih tepat.</em>
            </h1>
            <p>
              Ruang kerja tim verificator untuk meninjau laporan dan menjaga
              kualitas informasi bencana.
            </p>
            <div className="admin-login-points">
              <ShieldCheck />
              <span>Verifikasi manusia untuk setiap laporan.</span>
            </div>
            <div className="admin-login-points">
              <Activity />
              <span>Pantau data dan layanan dalam satu tempat.</span>
            </div>
          </div>
          <section className="admin-login-card">
            <div className="admin-lock">
              <LockKeyhole size={24} />
            </div>
            <h2>Selamat datang kembali</h2>
            <p>Masuk untuk mengakses dashboard admin.</p>
            <form onSubmit={login}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Masukkan username"
                required
                autoFocus
              />
              <label htmlFor="password">Password</label>
              <div className="admin-password">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  aria-label={
                    visible ? "Sembunyikan password" : "Tampilkan password"
                  }
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <div className="admin-error" role="alert">
                  {error}
                </div>
              )}
              <button className="admin-primary" disabled={busy}>
                {busy ? "Memproses…" : "Masuk ke dashboard"}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="admin-login-note">
              <ShieldCheck size={16} /> Akses khusus tim verificator
              DisasterWatch
            </div>
          </section>
        </main>
        <footer>DisasterWatch · Bersama, lebih siap menghadapi bencana.</footer>
      </div>
    );
  return (
    <div className="admin-app">
      <a className="admin-skip" href="#admin-content">
        Lewati ke konten
      </a>
      <header className="admin-header">
        <Brand />
        <div className="admin-account">
          <span className="admin-avatar" aria-label="Pengguna Admin">
            <UserRound size={19} />
          </span>
          <span className="admin-account-name">
            <strong>admin · superuser</strong>
            <small>Verificator</small>
          </span>
          <button
            onClick={logout}
            disabled={busy}
            aria-label="Logout"
            className="admin-logout"
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
          <button
            className="admin-mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
          >
            <Menu size={20} /> Menu dashboard <ChevronRight size={16} />
          </button>
          <div id="admin-navigation" className="admin-navigation">
            <div className="admin-eyebrow">RUANG KERJA</div>
            <nav aria-label="Menu admin">
              {menus.map((m) => (
                <a
                  key={m.id}
                  href={`#${m.id}`}
                  aria-current={tab === m.id ? "page" : undefined}
                  onClick={() => {
                    setTab(m.id);
                    setMenuOpen(false);
                  }}
                >
                  <m.icon size={19} />
                  <span>{m.name}</span>
                  {tab === m.id && <ChevronRight size={16} />}
                </a>
              ))}
            </nav>
            <div className="admin-sidebar-note">
              <ShieldCheck size={22} />
              <strong>Setiap laporan berarti.</strong>
              <p>Periksa sumber dan detail sebelum memberikan persetujuan.</p>
            </div>
            <a className="admin-back" href="/">
              <ArrowLeft size={16} /> Kembali ke halaman publik
            </a>
          </div>
        </aside>
        <main id="admin-content" className="admin-content">
          <div className="admin-breadcrumb">
            Dashboard <ChevronRight size={13} />
            <span>{current.name}</span>
          </div>
          <div className="admin-page-heading">
            <div>
              <h1>{current.name}</h1>
              <p>{current.description}</p>
            </div>
            <span className="admin-role">
              <ShieldCheck size={15} /> Verificator
            </span>
          </div>
          {session.demo && tab !== "services" && (
            <div className="admin-notice">
              <strong>Mode demo lokal</strong>
              <span>
                Data simulasi. Persetujuan hanya berlaku sampai server dimulai
                ulang.
              </span>
            </div>
          )}
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
          {tab === "reports" ? (
            <Records key="reports" kind="reports" onError={expire} />
          ) : tab === "disasters" ? (
            <Records key="disasters" kind="disasters" onError={expire} />
          ) : tab === "services" ? (
            <Suspense fallback={<div className="admin-empty" role="status">Memuat status layanan…</div>}>
              <GoogleStatusPage embedded />
            </Suspense>
          ) : (
            <Tokens />
          )}
        </main>
      </div>
    </div>
  );
}

function Records({
  kind,
  onError,
}: {
  kind: "reports" | "disasters";
  onError: (e: unknown) => void;
}) {
  const [collection, setCollection] = useState<string>(kind);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [page, setPage] = useState<Page<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Report | null>(null);
  const [message, setMessage] = useState("");
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPage(null);
    const params = new URLSearchParams({
      collection,
      after: cursor,
      ...(filter ? { status: filter } : {}),
    });
    adminApi<Page<any>>(`/records?${params}`)
      .then((data) => {
        if (active) setPage(data);
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
          onError(e);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collection, cursor, filter, refresh, onError]);
  const rows = (page?.rows ?? []).filter((row) =>
    JSON.stringify([
      row.id,
      row.rawText,
      row.sourceName,
      row.location?.name,
      row.name,
      row.title,
      row.province,
    ])
      .toLocaleLowerCase("id")
      .includes(search.toLocaleLowerCase("id")),
  );
  return (
    <>
      <div className="admin-stats">
        <Stat
          label={
            kind === "reports"
              ? "Laporan sesuai filter"
              : "Total catatan dalam koleksi"
          }
          value={page?.total ?? "—"}
          icon={kind === "reports" ? <FileText /> : <Database />}
        />
        <Stat
          label="Ditampilkan di halaman ini"
          value={loading ? "—" : rows.length}
          icon={<Eye />}
        />
        <Stat
          label={
            kind === "reports" ? "Terverifikasi di halaman ini" : "Sumber data"
          }
          value={
            kind === "reports"
              ? page
                ? page.rows.filter((r) => r.verificationStatus === "VERIFIED")
                    .length
                : "—"
              : page
                ? page.demo
                  ? "Demo"
                  : "Firestore"
                : "—"
          }
          icon={<CheckCheck />}
        />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{kind === "reports" ? "Daftar laporan" : "Daftar bencana"}</h2>
            <p>
              {kind === "reports"
                ? "Buka detail untuk memeriksa dan menyetujui laporan."
                : "Pilih koleksi untuk melihat data bencana yang tersedia."}
            </p>
          </div>
          <button
            className="admin-secondary"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} /> Muat ulang
          </button>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} />
            <input
              aria-label="Cari pada halaman ini"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pada halaman ini…"
            />
          </label>
          {kind === "reports" ? (
            <select
              aria-label="Filter status laporan"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCursors([""]);
              }}
            >
              <option value="">Semua status</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Koleksi bencana"
              value={collection}
              onChange={(e) => {
                setCollection(e.target.value);
                setCursors([""]);
              }}
            >
              <option value="disasters">Bencana dashboard</option>
              <option value="incidents">Insiden pipeline</option>
            </select>
          )}
        </div>
        {message && (
          <div className="admin-success" role="status">
            <Check size={16} />
            {message}
          </div>
        )}
        {loading ? (
          <div className="admin-empty" role="status">
            Memuat data…
          </div>
        ) : error ? (
          <div className="admin-error" role="alert">
            {error}
            <button onClick={() => setRefresh((v) => v + 1)}>Coba lagi</button>
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={search ? "Tidak ada hasil pencarian" : "Belum ada data"}
          >
            {search
              ? "Coba kata kunci lain atau kosongkan pencarian."
              : "Data akan tampil di sini setelah tersedia. Anda juga bisa mengubah filter."}
          </Empty>
        ) : (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  {(kind === "reports"
                    ? [
                        "Laporan & lokasi",
                        "Pelapor",
                        "Waktu laporan",
                        "Status",
                        "Aksi",
                      ]
                    : [
                        "Nama bencana",
                        "Lokasi",
                        "Kategori",
                        "Waktu",
                        "ID catatan",
                      ]
                  ).map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  kind === "reports" ? (
                    <tr key={row.id}>
                      <td>
                        <strong className="admin-cell-title">
                          {row.location?.name || "Lokasi belum tersedia"}
                        </strong>
                        <span className="admin-excerpt">{row.rawText}</span>
                        <small>
                          {row.id}
                          {row.isMock ? " · DEMO" : ""}
                        </small>
                      </td>
                      <td>
                        {row.sourceName || "Tidak diketahui"}
                        <small>{row.sourceType || "—"}</small>
                      </td>
                      <td className="admin-date">{date(row.createdAt)}</td>
                      <td>
                        <Badge
                          status={row.verificationStatus || "UNVERIFIED"}
                        />
                      </td>
                      <td>
                        <button
                          className="admin-detail-link"
                          onClick={() => setSelected({...row, targetCollection: "reports"})}
                        >
                          Tinjau <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.name || row.title || row.fullName || row.id}
                        </strong>
                        {row.isMock && <small>DEMO</small>}
                      </td>
                      <td>
                        {row.province ||
                          row.location?.name ||
                          (typeof row.location === "string"
                            ? row.location
                            : "—")}
                      </td>
                      <td>
                        {row.category || row.disasterType || row.type || "—"}
                      </td>
                      <td className="admin-date">
                        {date(row.timestamp || row.updatedAt || row.createdAt)}
                      </td>
                      <td>
                        <small>{row.id}</small>
                        <small>{row.approvalStatus === 'APPROVED' ? 'Disetujui superuser' : 'Menunggu fact-check'}</small>
                        {!row.isMock && collection === 'disasters' && <button className="admin-detail-link" onClick={() => setSelected({...row, targetCollection:'disasters', rawText:row.guide?.cause ?? row.summary ?? row.name, location:{name:row.name,lat:row.coords?.lat,lng:row.coords?.lng}, verificationStatus:row.approvalStatus==='APPROVED'?'VERIFIED':'UNVERIFIED', approvalStatus:row.approvalStatus??'PENDING'})}>Fact-check <ArrowRight size={15}/></button>}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <span>
            {page ? `${page.total} catatan · Halaman ${cursors.length}` : "—"}
          </span>
          <div>
            <button
              aria-label="Halaman sebelumnya"
              disabled={loading || cursors.length === 1}
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              aria-label="Halaman berikutnya"
              disabled={loading || !page?.next}
              onClick={() => {
                if (page?.next) setCursors((v) => [...v, page.next!]);
              }}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <Review
          report={selected}
          onClose={() => setSelected(null)}
          onError={onError}
          onApproved={() => {
            setSelected(null);
            setRefresh((v) => v + 1);
            setMessage(
              "Fact-check tersimpan. Laporan/titik disetujui superuser.",
            );
          }}
        />
      )}
    </>
  );
}

function Review({
  report,
  onClose,
  onApproved,
  onError,
}: {
  report: Report;
  onClose: () => void;
  onApproved: () => void;
  onError: (e: unknown) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{title?:string;url?:string;sourceName?:string}>>([]);
  const [latitude,setLatitude]=useState(report.location?.lat?.toString()??'');
  const [longitude,setLongitude]=useState(report.location?.lng?.toString()??'');
  const [province,setProvince]=useState((report as Report & {province?:string}).province??'');
  useEffect(()=>{
    let active=true;
    const id=report.targetCollection==='disasters'?report.id:report.disasterId;
    if(id) adminApi<{rows:Array<{title?:string;url?:string;sourceName?:string}>}>(`/evidence/${encodeURIComponent(id)}`).then(data=>{if(active)setSuggestions(data.rows);}).catch(()=>{});
    return ()=>{active=false;};
  },[report.id,report.disasterId,report.targetCollection]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  async function approve() {
    setBusy(true);
    setError("");
    try {
      await adminApi(`/${report.targetCollection??"reports"}/${encodeURIComponent(report.id)}/approve`, {
        note,
        evidenceUrls:evidence.split(/\s+/).filter(Boolean),
        lat:latitude ? Number(latitude) : undefined, lng:longitude ? Number(longitude) : undefined, province,
        expectedStatus: report.targetCollection==='disasters' ? (report as Report & {approvalStatus:string}).approvalStatus : report.verificationStatus,
      });
      onApproved();
    } catch (e) {
      setError(errorText(e));
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  const safeUrl = (value?: string) => {
    try {
      const url = new URL(value || "");
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  return (
    <dialog
      ref={ref}
      className="admin-review"
      aria-labelledby="review-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <div>
          <span className="admin-eyebrow">DETAIL LAPORAN</span>
          <h2 id="review-title">{report.location?.name || "Laporan warga"}</h2>
        </div>
        <button
          aria-label="Tutup detail laporan"
          onClick={onClose}
          disabled={busy}
        >
          <X />
        </button>
      </header>
      <div className="admin-review-body">
        <Badge status={report.verificationStatus} />
        <dl>
          <div>
            <dt>Pelapor</dt>
            <dd>{report.sourceName}</dd>
          </div>
          <div>
            <dt>Dilaporkan</dt>
            <dd>{date(report.createdAt)}</dd>
          </div>
          <div>
            <dt>ID laporan</dt>
            <dd>{report.id}</dd>
          </div>
          <div>
            <dt>Keyakinan AI</dt>
            <dd>
              {typeof report.aiConfidence === "number"
                ? `${Math.round(report.aiConfidence * 100)}% · bukan verifikasi manusia`
                : "Belum tersedia"}
            </dd>
          </div>
        </dl>
        <h3>Isi laporan</h3>
        <p className="admin-report-text">{report.rawText}</p>
        {safeUrl(report.sourceUrl) && (
          <a href={safeUrl(report.sourceUrl)!} target="_blank" rel="noreferrer">
            Buka sumber laporan ↗
          </a>
        )}
        {safeUrl(report.mediaUrl) && (
          <a href={safeUrl(report.mediaUrl)!} target="_blank" rel="noreferrer">
            Buka bukti lampiran ↗
          </a>
        )}
        {report.extractedData?.conflictNotes && (
          <div className="admin-notice">
            {report.extractedData.conflictNotes}
          </div>
        )}
        {!!report.extractedData?.needs?.length && (
          <>
            <h3>Kebutuhan yang teridentifikasi</h3>
            <div className="admin-tags">
              {report.extractedData.needs.map((n, i) => (
                <span key={`${n.category}-${i}`}>
                  {needLabel(n.category)}
                  {n.quantity ? ` · ${n.quantity} ${n.unit || ""}` : ""}
                </span>
              ))}
            </div>
          </>
        )}
        {report.verificationStatus === "VERIFIED" ? (
          <div className="admin-success">
            {report.reviewedBy
              ? `Disetujui ${report.reviewedBy} · ${date(report.reviewedAt)}`
              : "Laporan sudah berstatus terverifikasi. Riwayat persetujuan manusia belum tercatat."}
            {report.reviewNote && <p>{report.reviewNote}</p>}
          </div>
        ) : (
          <>
            <label htmlFor="review-note">
              Catatan fact-check <small>(wajib, minimal 10 karakter)</small>
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Tambahkan hasil pengecekan sumber atau konteks laporan…"
            />
            <label htmlFor="evidence-urls">Tautan bukti (1–5 URL HTTPS, satu per baris)</label>
            <textarea id="evidence-urls" value={evidence} onChange={event=>setEvidence(event.target.value)} rows={3} placeholder="Berita, laporan BNPB/BMKG, atau eviden lainnya" />
            {report.sourceUrl && <p><a href={report.sourceUrl} target="_blank" rel="noopener noreferrer">Sumber record</a></p>}
            {suggestions.map((source,index)=><p key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.sourceName}: {source.title}</a></p>)}
            {report.targetCollection!=='disasters' && <div><label>Provinsi titik<input value={province} onChange={event=>setProvince(event.target.value)} placeholder="Contoh: Jawa Timur"/></label><label>Latitude titik<input value={latitude} onChange={event=>setLatitude(event.target.value)} type="number" min="-90" max="90" step="any"/></label><label>Longitude titik<input value={longitude} onChange={event=>setLongitude(event.target.value)} type="number" min="-180" max="180" step="any"/></label></div>}
            <label className="admin-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Saya sudah memeriksa nama kota/kabupaten, provinsi, koordinat pada peta, tanggal kejadian, dan sumber evidennya.
            </label>
          </>
        )}
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer>
        <button className="admin-secondary" onClick={onClose} disabled={busy}>
          Tutup
        </button>
        {report.verificationStatus !== "VERIFIED" && (
          <button
            className="admin-primary"
            disabled={!confirmed || busy || note.trim().length<10 || !evidence.trim() || report.isMock}
            onClick={approve}
          >
            <ShieldCheck size={17} />
            {busy ? "Menyimpan…" : "Setujui laporan"}
          </button>
        )}
      </footer>
    </dialog>
  );
}

function Tokens() {
  const [samples, setSamples] = useState<TokenSample[]>([]);
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const data = await adminApi<TokenSample[]>("/ai-usage");
        if (active) { setSamples(data); setError(""); }
      } catch { if (active) setError("Gagal membaca aiUsage. Periksa koneksi dan publikasikan Firestore Rules terbaru."); }
      finally { if (active) setLoading(false); }
    };
    void update();
    const timer = window.setInterval(() => void update(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const rows = samples.filter(
    (s) => Date.parse(s.at) >= Date.now() - Number(days) * 86400_000,
  );
  const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString("id-ID");
  const sum = (key: "input" | "output" | "total") =>
    rows.some(s => s[key] === null) ? "—" : fmt(rows.reduce((total, s) => total + (s[key] ?? 0), 0));
  return (
    <>
      <div className="admin-notice">
        <strong>Cakupan: Firestore aiUsage</strong>
        <span>
          Maksimal 1.000 panggilan terbaru dari crawler dan browser pengguna yang login.
          Metadata browser dilaporkan oleh klien; metadata crawler dicatat server.
          Bukan total tagihan proyek. Diperbarui setiap 30 detik.
        </span>
      </div>
      <div className="admin-stats">
        <Stat
          label="Total token tercatat"
          value={rows.length ? sum("total") : "—"}
          icon={<Sparkles />}
        />
        <Stat
          label="Token input"
          value={rows.length ? sum("input") : "—"}
          icon={<ArrowRight />}
        />
        <Stat
          label="Token output"
          value={rows.length ? sum("output") : "—"}
          icon={<ArrowLeft />}
        />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Riwayat penggunaan AI</h2>
            <p>
              Jumlah aktual yang dikembalikan provider. Total dapat mencakup
              token penalaran.
            </p>
          </div>
          <select
            aria-label="Periode penggunaan token"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="1">24 jam terakhir</option>
            <option value="7">7 hari terakhir</option>
            <option value="30">30 hari terakhir</option>
          </select>
        </div>
        {error ? <Empty title="Data token belum dapat dibaca">{error}</Empty> : loading ? <Empty title="Memuat penggunaan token…">Mengambil catatan dari Firestore.</Empty> : rows.length ? (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Model</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.at}-${i}`}>
                    <td>{date(row.at)}</td>
                    <td>
                      <strong>{row.model}</strong>
                      <small>{row.transport}</small>
                    </td>
                    <td>{fmt(row.input)}</td>
                    <td>{fmt(row.output)}</td>
                    <td>{fmt(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Belum ada penggunaan token tercatat">
            Catatan muncul setelah panggilan Gemini baru berhasil dan metadata tersimpan di Firestore.
            Riwayat sebelum pencatatan diaktifkan tidak tersedia.
          </Empty>
        )}
      </section>
    </>
  );
}
