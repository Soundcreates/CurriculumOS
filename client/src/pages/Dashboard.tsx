import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import Card from "../components/Card";
import AddCourseModal from "../components/AddCourseModal";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Plus } from "lucide-react";
import { getAllPaths, getUserStats, type Roadmap, type UserStats } from "@/apis/pathApi";

gsap.registerPlugin(ScrollTrigger);

const Dashboard: React.FC = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paths, setPaths] = useState<Array<Roadmap>>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const navigate = useNavigate();

  const handleFetchPaths = async () => {
    const [roadmaps, userStats] = await Promise.all([getAllPaths(), getUserStats()]);
    setPaths(roadmaps as Array<Roadmap>);
    setStats(userStats);
  };
 
  useEffect(() => {
   handleFetchPaths();
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

          <div
            ref={gridRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
          >
            {paths?.length === 0 ? (
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
