import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import Card from "../components/Card";
import AddCourseModal from "../components/AddCourseModal";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Plus } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Dashboard: React.FC = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const curriculumItems = [
    {
      number: "01",
      title: "Systems Thinking",
      description:
        "Understand the web of interconnectedness in modern software architecture.",
    },
    {
      number: "02",
      title: "Mental Models",
      description:
        "Core frameworks for decision making in high-uncertainty environments.",
    },
    {
      number: "03",
      title: "Design Patterns",
      description: "Reusable solutions to common problems in software design.",
    },
    {
      number: "04",
      title: "Cognitive Bias",
      description: "Identifying and mitigating flaws in human judgment.",
    },
    {
      number: "05",
      title: "Game Theory",
      description:
        "Strategic decision making and mathematical modeling of conflict.",
    },
    {
      number: "06",
      title: "Cryptography",
      description: "The mathematical foundations of secure communication.",
    },
  ];

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
      {isModalOpen && <AddCourseModal onClose={() => setIsModalOpen(false)} />}
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
                <span className="text-2xl font-serif text-white">12</span>
                <span className="text-xs uppercase tracking-widest text-text-secondary">
                  Completed
                </span>
              </div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-serif text-white">4</span>
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
            {curriculumItems.map((item, index) => (
              <div key={index} className="group cursor-pointer">
                <Card {...item} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
