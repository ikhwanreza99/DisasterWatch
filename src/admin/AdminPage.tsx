import { PROVINCE_BOUNDS } from '../services/locationValidation';
import { currentArticles, currentRecords } from '../data/currentIncidents';
import { newsSourceUrl } from '../services/newsSourceUrl';
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
import { isFinalReviewStatus } from "./reviewPolicy";
import "./admin.css";
import { useI18n, translate, localeFor } from "../i18n";
import { LanguageToggle } from "../i18n/LanguageToggle";

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
  REJECTED: "Ditolak",
};
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(localeFor(), {
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
    : translate("Terjadi kesalahan. Silakan coba lagi.");
function Brand() {
  const { t } = useI18n();
  return (
    <a href="/" className="admin-brand" aria-label={t("DisasterWatch beranda")}>
      <span className="admin-logo">
        <Radio size={19} />
      </span>
      <strong>DisasterWatch</strong>
    </a>
  );
}
function Badge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span className={`admin-badge ${status.toLowerCase()}`}>
      {t(labels[status] || status)}
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
  const { t } = useI18n();
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
      ? `${t(menus.find((m) => m.id === tab)!.name)} · DisasterWatch`
      : t("Login Admin · DisasterWatch");
  }, [tab, session, t]);
  const expire = useCallback((e: unknown) => {
    if (e instanceof AdminError && e.status === 401) {
      setSession(null);
      setError(translate("Sesi berakhir. Silakan login kembali."));
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
        {t("Memeriksa sesi admin…")}
      </div>
    );
  if (!session)
    return (
      <div className="admin-app admin-login">
        <header>
          <Brand />
          <span>{t("Portal Verificator")}</span>
        </header>
        <main>
          <div className="admin-login-intro">
            <span className="admin-eyebrow">DISASTERWATCH · ADMIN</span>
            <h1>
              {t("Informasi terpercaya.")}
              <br />
              <em>{t("Respons lebih tepat.")}</em>
            </h1>
            <p>
              {t("Ruang kerja tim verificator untuk meninjau laporan dan menjaga kualitas informasi bencana.")}
            </p>
            <div className="admin-login-points">
              <ShieldCheck />
              <span>{t("Verifikasi manusia untuk setiap laporan.")}</span>
            </div>
            <div className="admin-login-points">
              <Activity />
              <span>{t("Pantau data dan layanan dalam satu tempat.")}</span>
            </div>
          </div>
          <section className="admin-login-card">
            <div className="admin-lock">
              <LockKeyhole size={24} />
            </div>
            <h2>{t("Selamat datang kembali")}</h2>
            <p>{t("Masuk untuk mengakses dashboard admin.")}</p>
            <form onSubmit={login}>
              <label htmlFor="username">{t("Username")}</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder={t("Masukkan username")}
                required
                autoFocus
              />
              <label htmlFor="password">{t("Password")}</label>
              <div className="admin-password">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("Masukkan password")}
                  required
                />
                <button
                  type="button"
                  aria-label={
                    visible ? t("Sembunyikan password") : t("Tampilkan password")
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
                {busy ? t("Memproses…") : t("Masuk ke dashboard")}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="admin-login-note">
              <ShieldCheck size={16} /> {t("Akses khusus tim verificator DisasterWatch")}
            </div>
            <div className="admin-judge" data-purpose="judge-access">
              <div className="admin-judge-head">
                <Sparkles size={15} />
                <strong>{t("Akses juri · simulasi approval")}</strong>
              </div>
              <p>
                {t("Akun demo untuk mencoba alur verifikasi laporan dan approval titik bencana. Hak aksesnya sama dengan admin.")}
              </p>
              <dl>
                <div>
                  <dt>{t("Username")}</dt>
                  <dd><code>admindemo</code></dd>
                </div>
                <div>
                  <dt>{t("Password")}</dt>
                  <dd><code>admindemo123</code></dd>
                </div>
              </dl>
              <p className="admin-judge-warn">
                {t("Akun ini dapat mengubah data produksi. Gunakan hanya selama sesi penilaian.")}
              </p>
            </div>
          </section>
        </main>
        <footer>{t("DisasterWatch · Bersama, lebih siap menghadapi bencana.")}</footer>
      </div>
    );
  return (
    <div className="admin-app">
      <a className="admin-skip" href="#admin-content">
        {t("Lewati ke konten")}
      </a>
      <header className="admin-header">
        <Brand />
        <div className="admin-account">
          <LanguageToggle />
          <span className="admin-avatar" aria-label={t("Pengguna Admin")}>
            <UserRound size={19} />
          </span>
          <span className="admin-account-name">
            <strong>{session.username} · superuser</strong>
            <small>{t("Verificator")}</small>
          </span>
          <button
            onClick={logout}
            disabled={busy}
            aria-label={t("Logout")}
            className="admin-logout"
          >
            <LogOut size={17} />
            <span>{t("Logout")}</span>
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
            <Menu size={20} /> {t("Menu dashboard")} <ChevronRight size={16} />
          </button>
          <div id="admin-navigation" className="admin-navigation">
            <div className="admin-eyebrow">{t("RUANG KERJA")}</div>
            <nav aria-label={t("Menu admin")}>
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
                  <span>{t(m.name)}</span>
                  {tab === m.id && <ChevronRight size={16} />}
                </a>
              ))}
            </nav>
            <div className="admin-sidebar-note">
              <ShieldCheck size={22} />
              <strong>{t("Setiap laporan berarti.")}</strong>
              <p>{t("Periksa sumber dan detail sebelum memberikan persetujuan.")}</p>
            </div>
            <a className="admin-back" href="/">
              <ArrowLeft size={16} /> {t("Kembali ke halaman publik")}
            </a>
          </div>
        </aside>
        <main id="admin-content" className="admin-content">
          <div className="admin-breadcrumb">
            {t("Dashboard")} <ChevronRight size={13} />
            <span>{t(current.name)}</span>
          </div>
          <div className="admin-page-heading">
            <div>
              <h1>{t(current.name)}</h1>
              <p>{t(current.description)}</p>
            </div>
            <span className="admin-role">
              <ShieldCheck size={15} /> {t("Verificator")}
            </span>
          </div>
          {session.demo && tab !== "services" && (
            <div className="admin-notice">
              <strong>{t("Mode demo lokal")}</strong>
              <span>
                {t("Data simulasi. Persetujuan hanya berlaku sampai server dimulai ulang.")}
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
            <Suspense fallback={<div className="admin-empty" role="status">{t("Memuat status layanan…")}</div>}>
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
  const { t } = useI18n();
  const [collection, setCollection] = useState<string>(kind);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [page, setPage] = useState<Page<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Report | null>(null);
  const [selectedDisaster, setSelectedDisaster] = useState<any | null>(null);
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
              ? t("Laporan sesuai filter")
              : t("Total catatan dalam koleksi")
          }
          value={page?.total ?? "—"}
          icon={kind === "reports" ? <FileText /> : <Database />}
        />
        <Stat
          label={t("Ditampilkan di halaman ini")}
          value={loading ? "—" : rows.length}
          icon={<Eye />}
        />
        <Stat
          label={
            kind === "reports" ? t("Terverifikasi di halaman ini") : t("Sumber data")
          }
          value={
            kind === "reports"
              ? page
                ? page.rows.filter((r) => r.verificationStatus === "VERIFIED")
                    .length
                : "—"
              : page
                ? page.demo
                  ? t("Demo")
                  : "Firestore"
                : "—"
          }
          icon={<CheckCheck />}
        />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{kind === "reports" ? t("Daftar laporan") : t("Daftar bencana")}</h2>
            <p>
              {kind === "reports"
                ? t("Buka detail untuk memeriksa dan menyetujui laporan.")
                : t("Pilih koleksi untuk melihat data bencana yang tersedia.")}
            </p>
          </div>
          <button
            className="admin-secondary"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} /> {t("Muat ulang")}
          </button>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} />
            <input
              aria-label={t("Cari pada halaman ini")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Cari pada halaman ini…")}
            />
          </label>
          {kind === "reports" ? (
            <select
              aria-label={t("Filter status laporan")}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCursors([""]);
              }}
            >
              <option value="">{t("Semua status")}</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label={t("Koleksi bencana")}
              value={collection}
              onChange={(e) => {
                setCollection(e.target.value);
                setCursors([""]);
              }}
            >
              <option value="disasters">{t("Bencana dashboard")}</option>
              <option value="incidents">{t("Insiden pipeline")}</option>
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
            {t("Memuat data…")}
          </div>
        ) : error ? (
          <div className="admin-error" role="alert">
            {error}
            <button onClick={() => setRefresh((v) => v + 1)}>{t("Coba lagi")}</button>
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={search ? t("Tidak ada hasil pencarian") : t("Belum ada data")}
          >
            {search
              ? t("Coba kata kunci lain atau kosongkan pencarian.")
              : t("Data akan tampil di sini setelah tersedia. Anda juga bisa mengubah filter.")}
          </Empty>
        ) : (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  {(kind === "reports"
                    ? [
                        t("Laporan & lokasi"),
                        t("Pelapor"),
                        t("Waktu laporan"),
                        t("Status"),
                        t("Aksi"),
                      ]
                    : [
                        t("Nama bencana"),
                        t("Lokasi"),
                        t("Kategori"),
                        t("Waktu"),
                        t("ID catatan"),
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
                          {row.location?.name || t("Lokasi belum tersedia")}
                        </strong>
                        <span className="admin-excerpt">{row.rawText}</span>
                        <small>
                          {row.id}
                          {row.isMock ? " · DEMO" : ""}
                        </small>
                      </td>
                      <td>
                        {row.sourceName || t("Tidak diketahui")}
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
                          {t("Tinjau")} <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.name || row.title || row.fullName || row.id}
                        </strong>
                        <small>{row.isMock === true ? t("DEMO · data simulasi") : row.isMock === false ? t("REAL · data kejadian") : t("Asal data belum diketahui")}{row.reviewDisaster ? t(" · titik REAL terhubung") : ""}</small>
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
                        {date(row.reviewDisaster?.eventDate || row.eventDate || row.timestamp || row.updatedAt || row.createdAt)}
                      </td>
                      <td>
                        <small>{row.id}</small>
                        <small>{row.isMock === true ? t("Data simulasi") : t("Data bencana")}</small>
                        <button className="admin-detail-link" onClick={() => setSelectedDisaster(row)}>
                          {t("Lihat detail")} <ArrowRight size={15} />
                        </button>
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
            {page ? t("{count} catatan · Halaman {page}", { count: page.total, page: cursors.length }) : "—"}
          </span>
          <div>
            <button
              aria-label={t("Halaman sebelumnya")}
              disabled={loading || cursors.length === 1}
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              aria-label={t("Halaman berikutnya")}
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
              translate("Keputusan fact-check berhasil disimpan."),
            );
          }}
        />
      )}
      {selectedDisaster && (
        <DisasterDetail
          row={selectedDisaster}
          onClose={() => setSelectedDisaster(null)}
        />
      )}
    </>
  );
}

function DisasterDetail({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [articles, setArticles] = useState<Array<{title?: string; url: string; sourceName?: string}>>([]);
  const record = row.reviewDisaster ?? row;
  const id = record.id ?? row.id;
  const name = row.name || row.title || record.name || record.title || row.fullName || id;
  const summary = row.summary || row.description || record.summary || record.description || record.guide?.cause || row.rawText;
  const sourceRows = [row, record].flatMap((item) => [
    ...(Array.isArray(item.evidenceUrls) ? item.evidenceUrls : []),
    item.sourceUrl,
    item.url,
  ]).filter((url): url is string => typeof url === "string");

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    let active = true;
    const normalize = (rows: Array<{title?: string; url?: string; sourceName?: string}>) => rows
      .flatMap((article) => (article.url?.match(/https:\/\/[^\s]+/g) ?? []).map((url) => ({...article, url: newsSourceUrl(url)})))
      .filter((article): article is {title?: string; url: string; sourceName?: string} => !!article.url)
      .filter((article, index, all) => all.findIndex((candidate) => candidate.url === article.url) === index);
    const fallback = normalize([
      ...currentArticles.filter((article) => article.incidentId === id),
      ...sourceRows.map((url) => ({url, sourceName: translate("Sumber data bencana")})),
    ]);
    setArticles(fallback);
    adminApi<{rows: Array<{title?: string; url?: string; sourceName?: string}>}>(`/evidence/${encodeURIComponent(id)}`)
      .then((data) => {
        if (active) setArticles(normalize([...data.rows, ...fallback]));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [id]);

  const location = row.province || row.location?.name || (typeof row.location === "string" ? row.location : record.province) || "—";
  const category = row.category || row.disasterType || row.type || record.category || record.disasterType || "—";
  const occurredAt = row.eventDate || row.timestamp || row.updatedAt || row.createdAt || record.eventDate || record.timestamp;

  return (
    <dialog ref={ref} className="admin-review" aria-labelledby="disaster-detail-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header>
        <div>
          <span className="admin-eyebrow">{t("DETAIL BENCANA")} {row.isMock === true ? "· DEMO" : ""}</span>
          <h2 id="disaster-detail-title">{name}</h2>
        </div>
        <button aria-label={t("Tutup detail bencana")} onClick={onClose}><X /></button>
      </header>
      <div className="admin-review-body">
        <dl>
          <div><dt>{t("Lokasi")}</dt><dd>{location}</dd></div>
          <div><dt>{t("Kategori")}</dt><dd>{category}</dd></div>
          <div><dt>{t("Waktu kejadian")}</dt><dd>{date(occurredAt)}</dd></div>
          <div><dt>{t("ID catatan")}</dt><dd>{id}</dd></div>
        </dl>
        {summary && <><h3>{t("Ringkasan")}</h3><p className="admin-report-text">{summary}</p></>}
        <h3>{t("Sumber berita dan data")}</h3>
        {articles.length ? articles.map((article) => (
          <a key={article.url} href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title || article.sourceName || article.url} · {t("Buka sumber")} ↗
          </a>
        )) : <p>{t("Belum ada tautan sumber yang tercatat.")}</p>}
      </div>
      <footer><button className="admin-secondary" onClick={onClose}>{t("Tutup")}</button></footer>
    </dialog>
  );
}

export function Review({
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
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const reviewed = isFinalReviewStatus(report.verificationStatus);
  const savedEvidence=(report.evidenceUrls??[]).map(newsSourceUrl).filter((url):url is string=>!!url);
  const [note, setNote] = useState(report.reviewNote??"");
  const [evidence, setEvidence] = useState<string[]>(savedEvidence);
  const [evidenceLoading,setEvidenceLoading]=useState(true);
  const [evidenceError,setEvidenceError]=useState("");
  const [rejectOpen,setRejectOpen]=useState(false);
  const rejectRef=useRef<HTMLDialogElement>(null);
  const [rejectNote,setRejectNote]=useState("");
  useEffect(()=>{if(rejectOpen)rejectRef.current?.showModal();},[rejectOpen]);
  const [suggestions, setSuggestions] = useState<Array<{title?:string;url?:string;sourceName?:string}>>([]);
  const [latitude,setLatitude]=useState(report.location?.lat?.toString()??'');
  const [longitude,setLongitude]=useState(report.location?.lng?.toString()??'');
  const [province,setProvince]=useState((report as Report & {province?:string}).province??'');
  useEffect(()=>{
    let active=true;
    const name=report.location?.name?.toLowerCase()??'';
    const inferred=currentRecords.filter(r=>[r.name,...r.aliases].some(alias=>name.split(/[,;]/).some(part=>part.trim()===alias.toLowerCase())));
    const id=report.targetCollection==='disasters'?report.id:report.disasterId || (inferred.length===1?inferred[0].id:undefined);
    const normalize=(rows:Array<{title?:string;url?:string;sourceName?:string}>)=>rows.flatMap(row=>(row.url?.match(/https:\/\/[^\s]+/g)??[]).map(raw=>({...row,url:newsSourceUrl(raw)}))).filter((row,index,all)=>!!row.url&&all.findIndex(other=>other.url===row.url)===index) as Array<{title?:string;url:string;sourceName?:string}>;
    const fallback=normalize([...currentArticles.filter(a=>a.incidentId===id && a.discoveredBy!=='threads:keyword-search'),...savedEvidence.map(url=>({url,sourceName:new URL(url).hostname,title:translate('Bukti tersimpan oleh verifikator')}))]);
    if(!id){setSuggestions(fallback);setEvidenceLoading(false);setEvidenceError(translate('Belum ada kejadian yang cocok untuk memuat berita pendukung.'));return;}
    adminApi<{rows:Array<{title?:string;url?:string;sourceName?:string}>}>(`/evidence/${encodeURIComponent(id)}`).then(data=>{
      if(active)setSuggestions(normalize([...data.rows,...fallback]));
    }).catch(()=>{if(active){setSuggestions(fallback);setEvidenceError(translate('Berita Firestore gagal dimuat; menampilkan berita snapshot jika tersedia.'));}}).finally(()=>{if(active)setEvidenceLoading(false);});
    return ()=>{active=false;};
  },[report.id,report.disasterId,report.targetCollection]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const [rejectionReason,setRejectionReason]=useState("NO_DISASTER");
  async function approve(decision: "approve" | "reject" = "approve") {
    setError("");
    if(decision==='approve' && !report.isMock && (evidence.length<1 || evidence.length>3)){setError(translate('Centang 1–3 berita pendukung sebelum menyetujui laporan.'));return;}
    if(decision==='approve' && note.trim() && note.trim().length<10){setError(translate('Catatan tambahan minimal 10 karakter, atau kosongkan untuk menggunakan ringkasan bukti terpilih.'));return;}
    if(decision==='reject' && rejectNote.trim().length<10){setError(translate('Isi alasan penolakan minimal 10 karakter.'));return;}
    setBusy(true);
    try {
      await adminApi(`/${report.targetCollection??"reports"}/${encodeURIComponent(report.id)}/${decision}`, {
        note:decision==='reject'?rejectNote:note.trim() || (report.isMock ? t('Persetujuan simulasi DEMO untuk latihan verifikasi; tidak menerbitkan titik peta.') : t('Disetujui berdasarkan {n} berita pendukung setelah pemeriksaan lokasi dan kejadian.', { n: evidence.length })), reason:rejectionReason,
        evidenceUrls:evidence,
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
          <span className="admin-eyebrow">{t("DETAIL LAPORAN")}</span>
          <h2 id="review-title">{report.location?.name || t("Laporan warga")}</h2>
        </div>
        <button
          aria-label={t("Tutup detail laporan")}
          onClick={onClose}
          disabled={busy}
        >
          <X />
        </button>
      </header>
      <div className="admin-review-body">
        <Badge status={report.verificationStatus} />
        {report.isMock && <p className="admin-error">{t("DEMO — approve/tolak disimpan ke laporan simulasi di Firestore. Tidak membuat atau mengubah marker bencana real. Berita pendukung opsional untuk latihan.")}</p>}
        <dl>
          <div>
            <dt>{t("Pelapor")}</dt>
            <dd>{report.sourceName}</dd>
          </div>
          <div>
            <dt>{t("Dilaporkan")}</dt>
            <dd>{date(report.createdAt)}</dd>
          </div>
          <div>
            <dt>{t("ID laporan")}</dt>
            <dd>{report.id}</dd>
          </div>
          <div>
            <dt>{t("Keyakinan AI")}</dt>
            <dd>
              {typeof report.aiConfidence === "number"
                ? `${Math.round(report.aiConfidence * 100)}% · ${t("bukan verifikasi manusia")}`
                : t("Belum tersedia")}
            </dd>
          </div>
        </dl>
        <h3>{t("Isi laporan")}</h3>
        <p className="admin-report-text">{report.rawText}</p>
        {safeUrl(report.sourceUrl) && (
          <a href={safeUrl(report.sourceUrl)!} target="_blank" rel="noreferrer">
            {t("Buka sumber laporan")} ↗
          </a>
        )}
        {safeUrl(report.mediaUrl) && (
          <a href={safeUrl(report.mediaUrl)!} target="_blank" rel="noreferrer">
            {t("Buka bukti lampiran")} ↗
          </a>
        )}
        {report.extractedData?.conflictNotes && (
          <div className="admin-notice">
            {report.extractedData.conflictNotes}
          </div>
        )}
        {!!report.extractedData?.needs?.length && (
          <>
            <h3>{t("Kebutuhan yang teridentifikasi")}</h3>
            <div className="admin-tags">
              {report.extractedData.needs.map((n, i) => (
                <span key={`${n.category}-${i}`}>
                  {t(needLabel(n.category))}
                  {n.quantity ? ` · ${n.quantity} ${n.unit || ""}` : ""}
                </span>
              ))}
            </div>
          </>
        )}
        {report.verificationStatus === "VERIFIED" ? (
          <div className="admin-success">
            {report.reviewedBy
              ? t("Disetujui {name} · {date}", { name: report.reviewedBy, date: date(report.reviewedAt) })
              : t("Laporan sudah berstatus terverifikasi. Riwayat persetujuan manusia belum tercatat.")}
            {report.reviewNote && <p>{report.reviewNote}</p>}
          </div>
        ) : report.verificationStatus === "REJECTED" ? <div className="admin-error">{t("Laporan ditolak. Marker bencana terkait disembunyikan.")}<p>{report.reviewNote}</p></div> : null}
        {report.verificationStatus !== "REJECTED" && (
          <>
            {!reviewed && <><label htmlFor="review-note">
              {t("Catatan fact-check")} <small>{t("(opsional untuk persetujuan)")}</small>
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t("Tambahkan hasil pengecekan sumber atau konteks laporan…")}
            />
            </>}
            <fieldset className="admin-evidence"><legend>{reviewed ? t("Bukti pilihan verifikator ({count} terpilih)", { count: evidence.length }) : t("Berita pendukung — pilih 1–3 berita ({count}/3)", { count: evidence.length })}</legend>
              {evidenceLoading && <p role="status">{t("Memuat berita pendukung…")}</p>}
              {evidenceError && <p role="status">{evidenceError}</p>}
              {!evidenceLoading && suggestions.length===0 && <p>{t("Belum ada berita pendukung yang cocok. Laporan belum dapat disetujui; pilihan Tolak tetap tersedia.")}</p>}
              {suggestions.map((source,index)=>{const url=newsSourceUrl(source.url)!;return <label key={url||index} className="admin-evidence-row"><input type="checkbox" aria-label={t("Pilih bukti: {name}", { name: source.title||source.sourceName||new URL(url).hostname })} checked={evidence.includes(url)} disabled={reviewed || (!evidence.includes(url)&&evidence.length>=3)} onChange={e=>setEvidence(previous=>e.target.checked?[...previous,url]:previous.filter(v=>v!==url))}/><span>{source.title||source.sourceName||url}<a href={url} target="_blank" rel="noopener noreferrer">{t("Buka sumber")} · {source.sourceName||new URL(url).hostname}</a></span></label>;})}
            </fieldset>
            {!reviewed && report.targetCollection!=='disasters' && <div><label>{t("Provinsi titik")}<select value={province} onChange={event=>setProvince(event.target.value)}><option value="">{t("Pilih provinsi")}</option>{Object.keys(PROVINCE_BOUNDS).sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label><label>{t("Latitude titik")}<input value={latitude} onChange={event=>setLatitude(event.target.value)} type="number" min="-90" max="90" step="any"/></label><label>{t("Longitude titik")}<input value={longitude} onChange={event=>setLongitude(event.target.value)} type="number" min="-180" max="180" step="any"/></label></div>}

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
          {t("Tutup")}
        </button>
        {!reviewed && <button className="admin-reject" disabled={busy} onClick={()=>{setError("");setRejectOpen(true);}}><X size={17}/>{t("Tolak laporan")}</button>}
        {!reviewed && (
          <button
            className="admin-primary"
            disabled={busy}
            onClick={()=>approve("approve")}
          >
            <ShieldCheck size={17} />
            {busy ? t("Menyimpan…") : t("Setujui laporan")}
          </button>
        )}
      </footer>
      {rejectOpen && <dialog ref={rejectRef} className="admin-review admin-reject-dialog" aria-labelledby="reject-title" onCancel={e=>{e.preventDefault();if(!busy){rejectRef.current?.close();setRejectOpen(false);setError('');}}}>
        <header><h2 id="reject-title">{t("Tolak laporan")}</h2></header>
        <div className="admin-review-body">
          <p>{t("Penolakan menyembunyikan marker bencana terkait. Tentukan alasan berdasarkan pemeriksaan Anda.")}</p>
          <label htmlFor="rejection-reason">{t("Alasan penolakan")}</label>
          <select id="rejection-reason" value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)}><option value="NO_DISASTER">{t("Tidak ada bencana di titik ini")}</option><option value="HOAX">{t("Laporan hoaks")}</option></select>
          <label htmlFor="rejection-note">{t("Catatan penolakan (minimal 10 karakter)")}</label>
          <textarea id="rejection-note" value={rejectNote} onChange={e=>setRejectNote(e.target.value)} maxLength={1000} rows={4}/>
          {error && <div className="admin-error" role="alert">{error}</div>}
        </div>
        <footer><button className="admin-secondary" disabled={busy} onClick={()=>{rejectRef.current?.close();setRejectOpen(false);setError('');}}>{t("Batal")}</button><button className="admin-reject" disabled={busy} onClick={()=>approve('reject')}>{busy?t('Menyimpan…'):t('Konfirmasi penolakan')}</button></footer>
      </dialog>}
    </dialog>
  );
}

function Tokens() {
  const { t } = useI18n();
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
      } catch { if (active) setError(translate("Gagal membaca aiUsage. Periksa koneksi dan publikasikan Firestore Rules terbaru.")); }
      finally { if (active) setLoading(false); }
    };
    void update();
    const timer = window.setInterval(() => void update(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const rows = samples.filter(
    (s) => Date.parse(s.at) >= Date.now() - Number(days) * 86400_000,
  );
  const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString(localeFor());
  const sum = (key: "input" | "output" | "total") =>
    rows.some(s => s[key] === null) ? "—" : fmt(rows.reduce((total, s) => total + (s[key] ?? 0), 0));
  return (
    <>
      <div className="admin-notice">
        <strong>{t("Cakupan: Firestore aiUsage")}</strong>
        <span>
          {t("Maksimal 1.000 panggilan terbaru dari crawler dan browser pengguna yang login. Metadata browser dilaporkan oleh klien; metadata crawler dicatat server. Bukan total tagihan proyek. Diperbarui setiap 30 detik.")}
        </span>
      </div>
      <div className="admin-stats">
        <Stat
          label={t("Total token tercatat")}
          value={rows.length ? sum("total") : "—"}
          icon={<Sparkles />}
        />
        <Stat
          label={t("Token input")}
          value={rows.length ? sum("input") : "—"}
          icon={<ArrowRight />}
        />
        <Stat
          label={t("Token output")}
          value={rows.length ? sum("output") : "—"}
          icon={<ArrowLeft />}
        />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{t("Riwayat penggunaan AI")}</h2>
            <p>
              {t("Jumlah aktual yang dikembalikan provider. Total dapat mencakup token penalaran.")}
            </p>
          </div>
          <select
            aria-label={t("Periode penggunaan token")}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="1">{t("24 jam terakhir")}</option>
            <option value="7">{t("7 hari terakhir")}</option>
            <option value="30">{t("30 hari terakhir")}</option>
          </select>
        </div>
        {error ? <Empty title={t("Data token belum dapat dibaca")}>{error}</Empty> : loading ? <Empty title={t("Memuat penggunaan token…")}>{t("Mengambil catatan dari Firestore.")}</Empty> : rows.length ? (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Waktu")}</th>
                  <th>{t("Model")}</th>
                  <th>{t("Input")}</th>
                  <th>{t("Output")}</th>
                  <th>{t("Total")}</th>
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
          <Empty title={t("Belum ada penggunaan token tercatat")}>
            {t("Catatan muncul setelah panggilan Gemini baru berhasil dan metadata tersimpan di Firestore. Riwayat sebelum pencatatan diaktifkan tidak tersedia.")}
          </Empty>
        )}
      </section>
    </>
  );
}
