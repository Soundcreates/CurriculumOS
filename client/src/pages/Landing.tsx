import Layout from "../components/Layout";
import SectionDivider from "../components/SectionDivider";
import Hero from "../components/Hero";
import Card from "../components/Card";
import Navigation from "../components/Navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
gsap.registerPlugin(ScrollTrigger);
function Landing() {
  const features = [
    {
      number: "01",
      title: "Curated Paths",
      description:
        "Daily syllabi generated from high-signal sources, filtering out the noise.",
    },
    {
      number: "02",
      title: "Deep Focus",
      description:
        "A distraction-free reading environment designed for long-term retention.",
    },
    {
      number: "03",
      title: "Knowledge Graph",
      description:
        "Connect disparate concepts into a unified mental model automatically.",
    },
  ];

  //refs section
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const modernMindRef = useRef<HTMLDivElement>(null);
  const modernMindTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heroElement = heroRef.current;

    gsap.fromTo(
      featuresRef.current,
      {
        opacity: 0,
        y: -50,
      
      },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
        delay: 0.2,
        scrollTrigger: {
          trigger: featuresRef.current,
          start: "top 90%",
          toggleActions: "play none none none",
        },
      },
    );
    gsap.fromTo(
      modernMindRef.current,
      {
        opacity: 0,
        x: -50,
        y:-50
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 1,
        ease: "power2.out",
        delay: 0.2,
        scrollTrigger: {
          trigger: modernMindRef.current,
          start: "top 90%",
          toggleActions: "play none play none",
        },
      },
    );

    gsap.fromTo(
      modernMindTextRef.current,
      {
        opacity: 0,
        x: 50,
        y:-50
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 1,
        ease: "power2.out",
        delay: 0.4,
        scrollTrigger: {
          trigger: modernMindTextRef.current,
          start: "top 90%",
          toggleActions: "play none play none",
        },
      },
    )
    gsap.fromTo(
      heroElement,
      {
        opacity: 0,
        x: -50,
      },
      { opacity: 1, x: 0, duration: 1, ease: "power2.out", delay: 0.5 },
    );

    return () => {
      gsap.killTweensOf(heroElement);
    };
  }, []);

  return (
    <Layout>
      <Navigation />

      {/* Section: Hero */}
      <section ref={heroRef}>
        <Hero />
      </section>

      <div className="max-w-6xl mx-auto px-8 pb-32">
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 w-full"
          ref={featuresRef}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className={`animate-fade-up`}
              style={{ animationDelay: `${0.8 + index * 0.2}s` }}
            >
              <Card {...feature} />
            </div>
          ))}
        </div>

        <SectionDivider />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 items-center">
          <div ref={modernMindRef}>
            <h2 className="text-4xl md:text-5xl text-text-primary mb-8">
              The anti-feed for <br />
              the modern mind.
            </h2>
          </div>
          <div ref={modernMindTextRef}>
            <p className="playfair-font text-lg text-text-secondary leading-relaxed mb-6">
              Most platforms are designed to keep you scrolling. CurriculumOS is
              designed to make you stop.
            </p>
            <p className="font-sans text-lg text-text-secondary leading-relaxed">
              By prioritizing depth over engagement metrics, we help you build a
              library of mental models that compound over time.
            </p>
          </div>
        </div>
      </div>

      <footer className="w-full py-12 px-8 border-t border-white/5 bg-bg-primary">
        <div className="max-w-6xl mx-auto flex justify-between items-end">
          <div>
            <div className="text-xl font-serif font-medium tracking-wide mb-2">
              CurriculumOS
            </div>
            <p className="text-xs text-text-secondary uppercase tracking-widest opacity-50">
              © 2024 Intelligence Systems
            </p>
          </div>
          <div className="flex gap-8">
            <a
              href="#"
              className="font-sans text-xs text-text-secondary uppercase tracking-widest hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://github.com/Soundcreates/CurriculumOS"
              className="font-sans text-xs text-text-secondary uppercase tracking-widest hover:text-white transition-colors"
            >
              Github
            </a>
          </div>
        </div>
      </footer>
    </Layout>
  );
}

export default Landing;
