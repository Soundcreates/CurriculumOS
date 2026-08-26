import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import Card from "../components/Card";
import AddCourseModal from "../components/AddCourseModal";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import {
  getAllPaths,
  getFailedGenerationJobs,
  getGenerationJob,
  getUserStats,
  retryGenerationJob,
  type Roadmap,
  type UserStats,
  type CreatePathResponse,
} from "@/apis/pathApi";

gsap.registerPlugin(ScrollTrigger);

function truncateText(value: string, maxLength = 56) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

const Dashboard: React.FC = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [paths, setPaths] = useState<Array<Roadmap>>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [failedJobs, setFailedJobs] = useState<CreatePathResponse[]>([]);
  const [retryingJobId, setRetryingJobId] = useState("");
  const [retryError, setRetryError] = useState("");
  const navigate = useNavigate();

  const handleFetchPaths = async () => {
    try {
      const [roadmaps, userStats, failed] = await Promise.all([
        getAllPaths(),
        getUserStats(),
        getFailedGenerationJobs().catch(() => []),
      ]);
      setPaths(roadmaps as Array<Roadmap>);
      setStats(userStats);
      setFailedJobs(failed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    setRetryError("");
    try {
      await retryGenerationJob(jobId);
      for (let attempt = 0; attempt < 75; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const job = await getGenerationJob(jobId);
        if (job.status === "succeeded") break;
        if (job.status === "failed") throw new Error(job.errorMessage || "Generation failed again.");
        if (attempt === 74) throw new Error("Generation is taking longer than expected.");
      }
      await handleFetchPaths();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "Failed to retry generation.");
    } finally {
      setRetryingJobId("");
    }
  };
 
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void handleFetchPaths();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      headerRef.current,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.2 },
    );

    // Staggered entry for cards
    if (gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power2.out",
          delay: 0.5,
        },
      );
    }
  }, []);

  return (
    <Layout>
      <Navigation />
      {isModalOpen && <AddCourseModal onClose={() => setIsModalOpen(false)} refreshData = {handleFetchPaths}/>}
      <div className="pt-32 px-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div
            ref={headerRef}
            className="mb-16 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/10 pb-8"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-text-secondary mb-2">
                My Curriculum
              </p>
              <h1 className="text-4xl md:text-5xl font-serif text-white">
                Active Paths
              </h1>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-lg font-serif hover:bg-white/90 transition-colors mr-4"
              >
                <Plus size={18} />
                <span>Create New</span>
              </button>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-serif text-white">{stats?.completedPaths ?? 0}</span>
                <span className="text-xs uppercase tracking-widest text-text-secondary">
                  Completed
                </span>
              </div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-serif text-white">{stats?.inProgressPaths ?? 0}</span>
                <span className="text-xs uppercase tracking-widest text-text-secondary">
                  In Progress
                </span>
              </div>
            </div>
          </div>

          {failedJobs.length > 0 && (
            <section className="mb-10 rounded-2xl border border-[#8c3b3b]/40 bg-[#3b1a1a]/30 p-6">
              <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#f1b7a8]">Needs attention</p>
              <h2 className="mt-2 text-2xl font-serif text-white">Some roadmaps need a retry</h2>
              <div className="mt-4 space-y-3">
                {failedJobs.map((job) => (
                  <div key={job.jobId} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-sans text-sm text-white">{job.errorMessage || "Generation failed"}</p>
                      <p className="mt-1 font-sans text-xs text-text-secondary">
                        {truncateText(job.userGoal || "Roadmap request")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRetryJob(job.jobId)}
                      disabled={Boolean(retryingJobId)}
                      className="flex items-center justify-center gap-2 rounded-full border border-[#f1d6a8]/40 px-4 py-2 font-sans text-xs uppercase tracking-[0.22em] text-[#f1d6a8] transition-colors hover:bg-[#f1d6a8]/10 disabled:opacity-50"
                    >
                      {retryingJobId === job.jobId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      {retryingJobId === job.jobId ? "Retrying…" : "Retry"}
                    </button>
                  </div>
                ))}
              </div>
              {retryError && <p className="mt-4 font-sans text-sm text-[#f1b7a8]">{retryError}</p>}
            </section>
          )}

          <div
            ref={gridRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
          >
            {isLoading ? (
              <div className="col-span-full min-h-[55vh] flex items-center justify-center">
                <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center py-16 px-6 border border-white/10 bg-white/[0.02] rounded-xl">
                  <Loader2 size={28} className="mb-4 animate-spin text-text-secondary" aria-hidden="true" />
                  <h3 className="text-2xl md:text-3xl font-serif text-white mb-3" aria-live="polite">
                    Loading roadmaps...
                  </h3>
                  <p className="text-text-secondary max-w-xl">
                    Gathering your learning paths.
                  </p>
                </div>
              </div>
            ) : paths.length === 0 ? (
              <div className="col-span-full min-h-[55vh] flex items-center justify-center">
                <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center py-16 px-6 border border-white/10 bg-white/[0.02] rounded-xl">
                  <h3 className="text-2xl md:text-3xl font-serif text-white mb-3">
                    No learning paths available
                  </h3>
                  <p className="text-text-secondary max-w-xl mb-8 leading-relaxed">
                    You don&apos;t have any active paths right now. Create one
                    to generate a focused roadmap from your sources and start
                    learning with structure.
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-lg font-serif hover:bg-white/90 transition-colors"
                  >
                    <Plus size={18} />
                    <span>Create New</span>
                  </button>
                </div>
              </div>
            ) : (
              paths?.map((item, index) => (
                <div
                  key={index}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/path/${item.id}`)}
                >
                  <Card
                    id={String(item.id)}
                    name={item.name}
                    description={item.description}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
