import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { X, Upload, Youtube, FileText } from "lucide-react";
import { createPath } from "../apis/pathApi";

interface AddCourseModalProps {
  onClose: () => void;
  refreshData: () => void;
}

type TabType = "document" | "youtube" | "text";
type StepType = 1 | 2 | 3;
type FilePreview = {
  file: File;
  url: string;
  textPreview: string;
};

const AddCourseModal: React.FC<AddCourseModalProps> = ({ onClose, refreshData }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<StepType>(1);
  const [activeTab, setActiveTab] = useState<TabType>("document");
  const youtubeUrl = "";
  const [textValue, setTextValue] = useState("");
  const [durationValue, setDurationValue] = useState("");
  const [goalValue, setGoalValue] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
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

  useEffect(() => {
    if (activeTab === "text" && currentStep === 3) {
      setCurrentStep(2);
    }
  }, [activeTab, currentStep]);

  useEffect(() => {
    let isCancelled = false;

    const buildPreviews = async () => {
      const previews = await Promise.all(
        selectedFiles.map(async (file) => {
          const isTextFile =
            file.type.startsWith("text/") ||
            file.name.toLowerCase().endsWith(".md") ||
            file.name.toLowerCase().endsWith(".txt");

          let textPreview = "";
          if (isTextFile) {
            textPreview = (await file.text()).slice(0, 240);
          }

          return {
            file,
            url: URL.createObjectURL(file),
            textPreview,
          };
        }),
      );

      if (isCancelled) {
        previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        return;
      }

      setFilePreviews((currentPreviews) => {
        currentPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        return previews;
      });
    };

    if (!selectedFiles.length) {
      setFilePreviews((currentPreviews) => {
        currentPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        return [];
      });
      return;
    }

    buildPreviews();

    return () => {
      isCancelled = true;
    };
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [filePreviews]);

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

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);

    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;

    setSelectedFiles(files);
    setSubmitError("");
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasSourceInput = () => {
    if (activeTab === "document") {
      return selectedFiles.length > 0;
    }

    if (activeTab === "youtube") {
      return false;
    }

    return Boolean(textValue.trim());
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!hasSourceInput()) {
        setSubmitError("Please add at least one source.");
        return;
      }

      setSubmitError("");
      setCurrentStep(2);
      return;
    }

    if (!durationValue.trim()) {
      setSubmitError("Please enter how long you want the roadmap for.");
      return;
    }

    if (activeTab === "text") {
      handleSubmit();
      return;
    }

    setSubmitError("");
    setCurrentStep(3);
  };

  const handleSubmit = async () => {
    if (!hasSourceInput()) {
      setSubmitError("Please add at least one source.");
      return;
    }

    if (!durationValue.trim()) {
      setSubmitError("Please enter how long you want the roadmap for.");
      return;
    }

    const userGoalPayload = activeTab === "text" ? textValue.trim() : goalValue.trim();
    if (!userGoalPayload) {
      setSubmitError(
        activeTab === "text"
          ? "Please enter your topic description."
          : "Please add what you want to achieve from this roadmap."
      );
      return;
    }

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

    payload.append("time_query", durationValue.trim());
    payload.append("user_goal", userGoalPayload);

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await createPath(payload);
      handleClose();
      refreshData();
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
          <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep(1)}
                className={`pb-2 text-sm uppercase tracking-widest transition-all ${
                  currentStep === 1
                    ? "text-white border-b border-white"
                    : "text-text-secondary border-b border-transparent hover:text-white"
                }`}
              >
                Source
              </button>
              <button
                onClick={() => {
                  if (hasSourceInput()) {
                    setSubmitError("");
                    setCurrentStep(2);
                  }
                }}
                className={`pb-2 text-sm uppercase tracking-widest transition-all ${
                  currentStep === 2
                    ? "text-white border-b border-white"
                    : "text-text-secondary border-b border-transparent hover:text-white"
                }`}
              >
                Duration
              </button>
              {activeTab !== "text" && (
                <button
                  onClick={() => {
                    if (hasSourceInput() && durationValue.trim()) {
                      setSubmitError("");
                      setCurrentStep(3);
                    }
                  }}
                  className={`pb-2 text-sm uppercase tracking-widest transition-all ${
                    currentStep === 3
                      ? "text-white border-b border-white"
                      : "text-text-secondary border-b border-transparent hover:text-white"
                  }`}
                >
                  Goal
                </button>
              )}
            </div>
            <span className="text-xs uppercase tracking-[0.3em] text-text-secondary">
              Step {currentStep} of {activeTab === "text" ? 2 : 3}
            </span>
          </div>

          <div className="min-h-[250px]">
            {currentStep === 1 && (
              <>
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
                        ? "text-red-400 border-b border-red-500/50"
                        : "text-text-secondary border-b border-transparent hover:text-red-400/80"
                    }`}
                  >
                    <Youtube size={16} className="text-red-500/75" />
                    YouTube (Blocked)
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

                {activeTab === "document" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer group ${
                      isDraggingFiles
                        ? "border-white bg-white/10"
                        : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {filePreviews.length === 0 ? (
                      <div className="min-h-[250px] flex flex-col items-center justify-center text-center">
                        <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform duration-300">
                          <Upload size={32} className="text-white opacity-80" />
                        </div>
                        <h3 className="text-white text-lg font-medium mb-2">
                          Upload a PDF or Doc
                        </h3>
                        <p className="text-text-secondary text-sm max-w-xs">
                          Drag and drop your syllabus or reading material here
                          to generate a curriculum.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-left">
                          <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">
                            {selectedFiles.length} file
                            {selectedFiles.length > 1 ? "s" : ""} selected
                          </p>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="text-xs uppercase tracking-[0.3em] text-white/80 hover:text-white transition-colors"
                          >
                            Replace
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filePreviews.map((preview) => {
                            return (
                              <div
                                key={`${preview.file.name}-${preview.file.size}`}
                                onClick={(event) => event.stopPropagation()}
                                className="rounded-xl border border-white/10 bg-[#101010] overflow-hidden"
                              >
                                <div className="px-4 py-3 border-b border-white/10 text-left">
                                  <p className="text-sm text-white truncate">
                                    {preview.file.name}
                                  </p>
                                  <p className="text-xs text-text-secondary mt-1">
                                    {formatFileSize(preview.file.size)}
                                  </p>
                                </div>
                             </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "youtube" && (
                  <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 rounded-lg border border-red-500/10 text-center my-4">
                    <p className="text-red-400 font-sans text-sm font-medium">
                      currently blocked by youtube, please come back later
                    </p>
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
              </>
            )}

            {currentStep === 2 && (
              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-text-secondary">
                    Roadmap Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 2 weeks, 30 days, 3 months"
                    value={durationValue}
                    onChange={(e) => {
                      setDurationValue(e.target.value);
                      setSubmitError("");
                    }}
                    className="w-full bg-transparent border border-white/20 rounded-lg px-4 py-4 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  />
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-sm text-text-secondary">
                    Set the time horizon for the roadmap, like{" "}
                    <span className="text-white">10 days</span>,{" "}
                    <span className="text-white">6 weeks</span>, or{" "}
                    <span className="text-white">3 months</span>.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-text-secondary">
                    Learning Goal
                  </label>
                  <textarea
                    placeholder="e.g., I want to become interview-ready for backend system design and build one solid project by the end of this roadmap."
                    value={goalValue}
                    onChange={(e) => {
                      setGoalValue(e.target.value);
                      setSubmitError("");
                    }}
                    className="w-full h-36 bg-transparent border border-white/20 rounded-lg p-4 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans resize-none"
                  />
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-sm text-text-secondary">
                    Tell the system what outcome you want from the roadmap, so
                    the final plan can optimize for that target.
                  </p>
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
            onClick={() => {
              if (currentStep === 1) {
                handleClose();
                return;
              }
              setSubmitError("");
              setCurrentStep((currentStep - 1) as StepType);
            }}
            className="px-6 py-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all text-sm uppercase tracking-wider"
          >
            {currentStep === 1 ? "Cancel" : "Back"}
          </button>
          {currentStep === (activeTab === "text" ? 2 : 3) ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-all font-serif font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Generating..." : "Generate Plan"}
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-all font-serif font-medium"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCourseModal;
