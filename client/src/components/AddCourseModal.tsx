import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { X, Upload, Youtube, FileText, Link } from "lucide-react";
import { createPath } from "../apis/pathApi";

interface AddCourseModalProps {
  onClose: () => void;
}

type TabType = "document" | "youtube" | "text";

const AddCourseModal: React.FC<AddCourseModalProps> = ({ onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("document");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [textValue, setTextValue] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 },
    ).fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.95, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4 },
      "-=0.2",
    );

    return () => {
      tl.kill();
    };
  }, []);

  const handleClose = () => {
    const tl = gsap.timeline({
      defaults: { ease: "power2.in" },
      onComplete: onClose,
    });

    tl.to(modalRef.current, {
      opacity: 0,
      scale: 0.95,
      y: 10,
      duration: 0.2,
    }).to(overlayRef.current, { opacity: 0, duration: 0.2 }, "-=0.1");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setSelectedFiles(Array.from(files));
    setSubmitError("");
  };

  const handleSubmit = async () => {
    const payload = new FormData();

    if (activeTab === "document") {
      selectedFiles.forEach((file) => {
        payload.append("file", file);
      });
    }

    if (activeTab === "youtube" && youtubeUrl.trim()) {
      payload.append("url", youtubeUrl.trim());
    }

    if (activeTab === "text" && textValue.trim()) {
      payload.append("text", textValue.trim());
    }

    if (![...payload.keys()].length) {
      setSubmitError("Please add at least one source.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await createPath(payload);
      handleClose();
    } catch {
      setSubmitError("Failed to create path.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={handleClose}
        className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm"
      ></div>

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-2xl font-serif text-white">Create New Path</h2>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* content */}
        <div className="p-6">
          <div className="flex gap-4 mb-8 border-b border-white/5 pb-4">
            <button
              onClick={() => setActiveTab("document")}
              className={`flex items-center gap-2 pb-2 text-sm uppercase tracking-widest transition-all ${
                activeTab === "document"
                  ? "text-white border-b border-white"
                  : "text-text-secondary border-b border-transparent hover:text-white"
              }`}
            >
              <Upload size={16} />
              Document
            </button>
            <button
              onClick={() => setActiveTab("youtube")}
              className={`flex items-center gap-2 pb-2 text-sm uppercase tracking-widest transition-all ${
                activeTab === "youtube"
                  ? "text-white border-b border-white"
                  : "text-text-secondary border-b border-transparent hover:text-white"
              }`}
            >
              <Youtube size={16} />
              YouTube
            </button>
            <button
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-2 pb-2 text-sm uppercase tracking-widest transition-all ${
                activeTab === "text"
                  ? "text-white border-b border-white"
                  : "text-text-secondary border-b border-transparent hover:text-white"
              }`}
            >
              <FileText size={16} />
              Topic / Text
            </button>
          </div>

          <div className="min-h-[250px]">
            {activeTab === "document" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-white/20 transition-colors cursor-pointer group bg-white/5"
              >
                <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Upload size={32} className="text-white opacity-80" />
                </div>
                <h3 className="text-white text-lg font-medium mb-2">
                  Upload a PDF or Doc
                </h3>
                <p className="text-text-secondary text-sm max-w-xs">
                  Drag and drop your syllabus or reading material here to
                  generate a curriculum.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {selectedFiles.length > 0 && (
                  <p className="text-xs text-text-secondary mt-3">
                    {selectedFiles.length} file
                    {selectedFiles.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}

            {activeTab === "youtube" && (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-text-secondary">
                    Playlist URL
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://youtube.com/playlist?list=..."
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        setSubmitError("");
                      }}
                      className="w-full bg-transparent border-b border-white/20 py-3 pl-10 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                    />
                    <Link
                      size={18}
                      className="absolute left-0 top-3.5 text-text-secondary"
                    />
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 mt-4">
                  <p className="text-sm text-text-secondary">
                    <span className="text-white font-medium">Note:</span> We'll
                    extract transcripts and structure them into a day-by-day
                    plan.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "text" && (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-text-secondary">
                    Topic or Description
                  </label>
                  <textarea
                    placeholder="e.g., 'Learn the basics of Quantum Computing over 2 weeks...'"
                    value={textValue}
                    onChange={(e) => {
                      setTextValue(e.target.value);
                      setSubmitError("");
                    }}
                    className="w-full h-32 bg-transparent border border-white/20 rounded-lg p-4 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans resize-none"
                  />
                </div>
              </div>
            )}
          </div>
          {submitError && (
            <p className="text-sm text-red-400 mt-4">{submitError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all text-sm uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-all font-serif font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Generating..." : "Generate Plan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCourseModal;
