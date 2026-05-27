import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import { getCurrentUser, logout, type AuthUser } from "../apis/authApi";
import { getUserStats, type UserStats } from "../apis/pathApi";

const DIST_COLORS: Record<string, string> = {
  Active: "#f1d6a8",
  Completed: "#8cb6ff",
  Queued: "#6d7785",
};

const tooltipStyle = {
  backgroundColor: "rgba(15, 15, 15, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "18px",
  color: "#f1ebdf",
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, userStats] = await Promise.all([
          getCurrentUser(),
          getUserStats(),
        ]);
        setUser(userRes.data.user);
        setStats(userStats);
      } catch {
        setErrorMessage("Profile data is unavailable until you sign in.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    timeline
      .fromTo(
        heroRef.current,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.9 },
      )
      .fromTo(
        statsRef.current?.children || [],
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 },
        "-=0.45",
      )
      .fromTo(
        chartsRef.current?.children || [],
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 },
        "-=0.35",
      );

    return () => {
      timeline.kill();
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName =
    user && `${user.firstName} ${user.lastName}`.trim() !== ""
      ? `${user.firstName} ${user.lastName}`.trim()
      : "Curriculum Architect";

  const completionRate = stats ? Math.round(stats.completionRate) : 0;

  const distributionWithColors = (stats?.distribution ?? []).map((d) => ({
    ...d,
    color: DIST_COLORS[d.name] ?? "#6d7785",
  }));

  const statCards = [
    {
      label: "Active Paths",
      value: String(stats?.inProgressPaths ?? 0),
      note: "currently in progress",
    },
    {
      label: "Completed Paths",
      value: String(stats?.completedPaths ?? 0),
      note: "paths finished",
    },
    {
      label: "Total Paths",
      value: String(stats?.totalPaths ?? 0),
      note: "paths created",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      note: "paths completed vs created",
    },
  ];

  return (
    <Layout>
      <Navigation />
      <div className="min-h-screen px-6 pb-20 pt-28 md:px-10">
        <div className="mx-auto max-w-7xl">
          <section
            ref={heroRef}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(241,214,168,0.18),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-12"
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
            <div className="relative z-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="mb-3 font-sans text-xs uppercase tracking-[0.45em] text-[#d8bf92]">
                  Profile Analytics
                </p>
                <h1 className="max-w-3xl text-5xl text-white md:text-6xl">
                  {displayName}
                </h1>
                <p className="mt-5 max-w-2xl font-sans text-base leading-7 text-[#d6ccbb] md:text-lg">
                  Your learning graph in motion: active paths, completed arcs,
                  retention stability, and the cadence shaping your next layer of
                  depth.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-sans text-xs uppercase tracking-[0.3em] text-[#efe6d6]">
                    Provider: {user?.provider ?? "guest"}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-sans text-xs uppercase tracking-[0.3em] text-[#efe6d6]">
                    Total paths: {stats?.totalPaths ?? 0}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-sans text-xs uppercase tracking-[0.3em] text-[#efe6d6]">
                    Completion rate: {completionRate}%
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[1.75rem] border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#d0c4ac]">
                    Account Snapshot
                  </p>
                  <div className="mt-6 space-y-4 font-sans text-sm text-[#ece2d2]">
                    <div className="flex items-center justify-between border-b border-white/8 pb-3">
                      <span>Email</span>
                      <span>{user?.email ?? "Not signed in"}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/8 pb-3">
                      <span>Primary mode</span>
                      <span>{user?.hasPassword ? "Manual + OAuth" : "OAuth only"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Current focus</span>
                      <span className="max-w-[160px] truncate text-right">
                        {stats?.currentFocus || "No active paths"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="rounded-full border border-white/10 px-5 py-3 font-sans text-xs uppercase tracking-[0.3em] text-white transition-colors hover:bg-white/10"
                  >
                    Open Dashboard
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="rounded-full bg-[#f1d6a8] px-5 py-3 font-sans text-xs uppercase tracking-[0.3em] text-black transition-colors hover:bg-[#f6e2bc] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoggingOut ? "Signing Out" : "Logout"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div
            ref={statsRef}
            className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {statCards.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-6 backdrop-blur-sm"
              >
                <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                  {item.label}
                </p>
                <p className="mt-4 text-4xl text-white">{item.value}</p>
                <p className="mt-2 font-sans text-sm text-text-secondary">{item.note}</p>
              </div>
            ))}
          </div>

          {errorMessage ? (
            <div className="mt-6 rounded-[1.5rem] border border-[#8c3b3b]/40 bg-[#3b1a1a]/40 px-5 py-4 font-sans text-sm text-[#f3c1c1]">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-white/[0.04] px-5 py-4 font-sans text-sm text-text-secondary">
              Loading profile analytics...
            </div>
          ) : null}

          <div
            ref={chartsRef}
            className="mt-10 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
          >
            {/* Learning Momentum — monthly paths created vs completed */}
            <article className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                    Learning Momentum
                  </p>
                  <h2 className="mt-3 text-3xl text-white">Paths created and completed</h2>
                </div>
                <p className="font-sans text-sm text-text-secondary">6 month view</p>
              </div>
              <div className="mt-8 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthlyActivity ?? []}>
                    <defs>
                      <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f1d6a8" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#f1d6a8" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#84aefc" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#84aefc" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" stroke="#978d7d" tickLine={false} axisLine={false} />
                    <YAxis stroke="#978d7d" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="focus" name="Created" stroke="#f1d6a8" fill="url(#focusGradient)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="completion" name="Completed" stroke="#84aefc" fill="url(#completionGradient)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Path Distribution */}
            <article className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-6">
              <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                Path Distribution
              </p>
              <h2 className="mt-3 text-3xl text-white">Portfolio balance</h2>
              <div className="mt-8 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionWithColors}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={4}
                    >
                      {distributionWithColors.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {distributionWithColors.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-full border border-white/8 px-4 py-3 font-sans text-sm text-[#e8decd]">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                    </div>
                    <span>{entry.value}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* Active Paths */}
            <article className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                    Active Paths
                  </p>
                  <h2 className="mt-3 text-3xl text-white">Current path load</h2>
                </div>
                <p className="font-sans text-sm text-text-secondary">in progress now</p>
              </div>
              {(stats?.activePaths ?? []).length === 0 ? (
                <div className="mt-8 flex h-[320px] items-center justify-center">
                  <p className="font-sans text-sm text-text-secondary">No active paths yet</p>
                </div>
              ) : (
                <>
                  <div className="mt-8 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.activePaths ?? []} barCategoryGap={18}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="name" stroke="#978d7d" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis stroke="#978d7d" tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Progress"]} />
                        <Bar dataKey="progress" radius={[8, 8, 0, 0]} fill="#f1d6a8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {(stats?.activePaths ?? []).map((path) => (
                      <div key={path.id} className="rounded-[1.4rem] border border-white/8 bg-black/15 p-4">
                        <p className="text-xl text-white truncate">{path.name}</p>
                        <p className="mt-2 font-sans text-sm text-text-secondary">
                          {path.completedDays} of {path.totalDays} days done
                        </p>
                        <p className="mt-1 font-sans text-sm text-[#d9c6a3]">{path.progress}% complete</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>

            {/* Completed Paths */}
            <article className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-6">
              <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                Completed Paths
              </p>
              <h2 className="mt-3 text-3xl text-white">Finished arcs</h2>
              <div className="mt-8 space-y-3">
                {(stats?.completedList ?? []).length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center">
                    <p className="font-sans text-sm text-text-secondary">No completed paths yet</p>
                  </div>
                ) : (
                  (stats?.completedList ?? []).map((path) => (
                    <div key={path.id} className="rounded-[1.4rem] border border-white/8 bg-black/15 px-4 py-4 font-sans">
                      <div className="flex items-center justify-between text-white">
                        <span className="truncate max-w-[160px]">{path.name}</span>
                        <span className="text-sm text-[#8cb6ff]">{path.totalDays} days</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full w-full rounded-full bg-[#8cb6ff]" />
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        All {path.totalDays} days completed
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Weekly Closures */}
            <article className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-6 xl:col-span-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">
                    Completion Rhythm
                  </p>
                  <h2 className="mt-3 text-3xl text-white">Weekly path activity</h2>
                </div>
                <p className="font-sans text-sm text-text-secondary">last 6 weeks</p>
              </div>
              <div className="mt-8 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.weeklyClosures ?? []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="#978d7d" tickLine={false} axisLine={false} />
                    <YAxis stroke="#978d7d" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="created" name="Created" radius={[10, 10, 0, 0]} fill="#f1d6a8" />
                    <Bar dataKey="completed" name="Completed" radius={[10, 10, 0, 0]} fill="#b8d8a3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
