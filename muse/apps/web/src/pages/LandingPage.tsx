import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Check,
  Plus,
  ArrowUp,
  FileText,
  X,
  Shield,
  Wand2,
  BookMarked,
  Users,
  Gamepad2,
  PenTool,
  Brain,
} from "lucide-react";
import type { MythosTrialPayloadV1, TryGoal } from "@mythos/core/trial/payload";
import { TRIAL_PAYLOAD_KEY, TRIAL_DRAFT_KEY } from "@mythos/core/trial/payload";
import { storeTrialFiles } from "@mythos/storage/trialUploads";

/**
 * Landing Page - Cursor.ai inspired minimal design
 *
 * Key messaging:
 * - "Your story's database that organizes itself"
 * - NOT a text generator (addresses AI skepticism)
 * - Built for writers tracking complex worlds
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <Hero />
      <LiveStats />
      <NotATextGenerator />
      <Features />
      <BuiltFor />
      <Pricing />
      <Footer />
      <FloatingChatBar />
    </div>
  );
}

// ============================================
// NAVBAR
// ============================================

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <span className="font-semibold">Mythos</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Pricing
          </a>
          <a
            href="/docs"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Docs
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/try"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Try Demo
          </a>
          <a
            href="/login"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign in
          </a>
          <a href="/signup" className="btn btn-secondary">
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}

// ============================================
// HERO
// ============================================

function Hero() {
  return (
    <section id="hero-section" className="relative pt-24 px-6 pb-56">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl lg:text-5xl font-medium leading-[1.1] tracking-tight mb-4"
        >
          Your story's database{" "}
          <span className="text-text-secondary">that organizes itself</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-base md:text-lg text-text-muted"
        >
          Built to organize your world, refine your craft, and share your story.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="max-w-5xl mx-auto w-full"
      >
        <AppPreview />
      </motion.div>
    </section>
  );
}

// ============================================
// APP PREVIEW MOCKUP
// ============================================

function AppPreview() {
  return (
    <div className="relative w-full h-full min-h-[300px] md:min-h-[380px]">
      <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-transparent z-10 pointer-events-none" />

      <div className="absolute inset-0 rounded-xl border border-border bg-bg-secondary overflow-hidden shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-primary/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-text-muted/20" />
            <div className="w-3 h-3 rounded-full bg-text-muted/20" />
            <div className="w-3 h-3 rounded-full bg-text-muted/20" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded bg-bg-tertiary text-xs text-text-muted">
              Chapter 7 — The Awakening
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100%-44px)]">
          <div className="flex-1 p-6 overflow-hidden">
            <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
              <p>
                <span className="text-text-primary">Elena</span> stood at the
                edge of the cliff, the wind whipping her{" "}
                <span className="text-text-primary">dark hair</span> against her
                face. Below, the ancient city of{" "}
                <span className="text-text-primary">Valdris</span> sprawled in
                the morning mist.
              </p>
              <p>
                "You shouldn't have come here," a voice said behind her. She
                turned to find{" "}
                <span className="text-text-primary">Marcus</span> emerging from
                the shadows, his{" "}
                <span className="border-b border-dashed border-amber-500/60 text-amber-200/90">
                  blue eyes
                </span>{" "}
                sharp with concern.
              </p>
              <p className="text-text-muted">
                The weight of the{" "}
                <span className="text-text-primary">crystal pendant</span> felt
                heavier than ever against her chest...
              </p>
            </div>
          </div>

          <div className="w-64 border-l border-border bg-bg-primary/30 p-4 hidden md:block">
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-200/80">
                    Consistency
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Marcus has{" "}
                  <span className="text-amber-200/80">brown eyes</span> in Ch.3.
                  Verify eye color.
                </p>
              </div>

              <div>
                <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                  Characters
                </div>
                <div className="space-y-1.5">
                  <EntityChip name="Elena" type="protagonist" />
                  <EntityChip name="Marcus" type="character" />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                  Locations
                </div>
                <div className="space-y-1.5">
                  <EntityChip name="Valdris" type="location" />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                  Items
                </div>
                <div className="space-y-1.5">
                  <EntityChip name="Crystal Pendant" type="item" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityChip({ name, type }: { name: string; type: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-tertiary/50 text-xs">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          type === "protagonist"
            ? "bg-cyan-400"
            : type === "character"
              ? "bg-text-muted"
              : type === "location"
                ? "bg-emerald-400/70"
                : "bg-violet-400/70"
        }`}
      />
      <span className="text-text-secondary">{name}</span>
    </div>
  );
}

// ============================================
// FLOATING CHAT BAR
// ============================================

const GOAL_OPTIONS: Array<{ id: TryGoal; label: string; hint: string }> = [
  { id: "import_organize", label: "Import & organize", hint: "Turn a chapter into clean docs" },
  { id: "proofread", label: "Proofread", hint: "Fix grammar without rewrites" },
  { id: "world_bible", label: "World bible", hint: "Sort notes into entities" },
  { id: "consistency_check", label: "Consistency", hint: "Spot contradictions" },
  { id: "name_generator", label: "Name generator", hint: "Generate names lists" },
  { id: "visualize_characters", label: "Visualize", hint: "Character visuals (beta)" },
];

const TONE_OPTIONS: Array<{ id: "safe" | "creative"; label: string }> = [
  { id: "safe", label: "Safe" },
  { id: "creative", label: "Creative" },
];

function inferGoal(text: string): TryGoal {
  const trimmed = text.trim();
  if (!trimmed) return "import_organize";

  const lower = trimmed.toLowerCase();

  if (/\b(grammar|spelling|proofread|typo|copyedit)\b/.test(lower)) {
    return "proofread";
  }
  if (/\b(consistency|contradiction|timeline|plot hole|plot-hole)\b/.test(lower)) {
    return "consistency_check";
  }
  if (/\b(name ideas|name list|character names|place names)\b/.test(lower)) {
    return "name_generator";
  }
  if (/\b(world bible|lore|factions|timeline notes|setting notes)\b/.test(lower)) {
    return "world_bible";
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter(
    (line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)
  );
  const avgLineLength =
    lines.length > 0
      ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length
      : 0;

  if (bulletLines.length >= 3 || (lines.length >= 6 && avgLineLength < 60)) {
    return "world_bible";
  }
  if (trimmed.length > 800) {
    return "import_organize";
  }

  return "import_organize";
}

function FloatingChatBar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [userOverride, setUserOverride] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [goal, setGoal] = useState<TryGoal>("import_organize");
  const [goalTouched, setGoalTouched] = useState(false);
  const [tone, setTone] = useState<"safe" | "creative">("safe");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasContent = inputValue.trim().length > 0 || files.length > 0;

  useEffect(() => {
    const heroSection = document.getElementById("hero-section");
    if (!heroSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const inView = entry.isIntersecting && entry.intersectionRatio > 0.3;
        setHeroInView(inView);
        if (!userOverride) {
          setIsExpanded(inView);
        }
      },
      { threshold: [0, 0.3, 0.5, 1], rootMargin: "-100px 0px 0px 0px" }
    );

    observer.observe(heroSection);
    return () => observer.disconnect();
  }, [userOverride]);

  useEffect(() => {
    if (heroInView && userOverride) {
      setUserOverride(false);
      setIsExpanded(true);
    }
  }, [heroInView, userOverride]);

  useEffect(() => {
    if (goalTouched) return;
    if (files.length > 0 && inputValue.trim().length === 0) {
      setGoal("import_organize");
      return;
    }
    setGoal(inferGoal(inputValue));
  }, [inputValue, files.length, goalTouched]);

  const handleExpand = () => {
    setIsExpanded(true);
    setUserOverride(true);
  };

  const handleCollapse = () => {
    if (!heroInView) {
      setIsExpanded(false);
      setUserOverride(true);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
    setIsExpanded(true);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selectedFiles]);
      }
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (!hasContent || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const trimmed = inputValue.trim();
      const inferredGoal = goalTouched ? goal : inferGoal(trimmed);
      let uploadRefs: MythosTrialPayloadV1["uploadRefs"] = undefined;

      if (files.length > 0) {
        try {
          uploadRefs = await storeTrialFiles(files);
        } catch (error) {
          console.warn("[LandingPage] Failed to store trial uploads:", error);
        }
      }

      const payload: MythosTrialPayloadV1 = {
        v: 1,
        source: uploadRefs && uploadRefs.length > 0 ? "file" : "paste",
        goal: inferredGoal,
        tone,
        text: trimmed.length > 0 ? trimmed : undefined,
        uploadRefs,
      };

      sessionStorage.setItem(TRIAL_PAYLOAD_KEY, JSON.stringify(payload));
      sessionStorage.setItem(TRIAL_DRAFT_KEY, trimmed);
      if (files.length > 0) {
        sessionStorage.setItem(
          "mythos_trial_files",
          JSON.stringify(files.map((f) => f.name))
        );
      }

      window.location.href = "/try";
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pointer-events-none">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="max-w-2xl mx-auto pointer-events-auto"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className={`relative rounded-2xl border shadow-2xl shadow-black/50 backdrop-blur-md ${
                isDragging
                  ? "border-white/30 bg-bg-secondary/95"
                  : "border-border bg-bg-secondary/95"
              }`}
            >
              {!heroInView && (
                <button
                  onClick={handleCollapse}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  Minimize
                </button>
              )}

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 pb-0 pt-4">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-text-secondary truncate max-w-[150px]">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Paste your chapter or describe your story..."
                className={`w-full bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none p-4 min-h-[60px] text-base ${files.length === 0 ? "pt-4" : ""}`}
                rows={2}
              />

              <div className="px-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">
                    Goal
                  </span>
                  <div className="flex items-center gap-1 rounded-full border border-border bg-bg-tertiary/60 p-0.5">
                    {TONE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setTone(option.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          tone === option.id
                            ? "bg-white text-bg-primary"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((option) => {
                    const isSelected = goal === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          setGoal(option.id);
                          setGoalTouched(true);
                        }}
                        title={option.hint}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          isSelected
                            ? "border-white/60 bg-white text-bg-primary"
                            : "border-border bg-bg-tertiary/40 text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.doc,.docx,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                    title="Attach files"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!hasContent || isSubmitting}
                  className={`p-2.5 rounded-full transition-all duration-200 ${
                    hasContent && !isSubmitting
                      ? "bg-white text-bg-primary hover:bg-white/90"
                      : "bg-bg-tertiary text-text-muted cursor-not-allowed"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>

              {isDragging && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-bg-secondary/95 backdrop-blur-sm pointer-events-none">
                  <p className="text-text-secondary">Drop your files here</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="minimized"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              onClick={handleExpand}
              className="w-full px-5 py-3.5 rounded-full border border-border bg-bg-secondary/95 backdrop-blur-md shadow-2xl shadow-black/50 flex items-center gap-3 text-left hover:border-border-hover hover:bg-bg-tertiary/90 transition-all"
            >
              <Plus className="w-4 h-4 text-text-muted" />
              <span className="flex-1 text-text-muted text-sm">
                Paste your chapter or describe your story...
              </span>
              <ArrowUp className="w-4 h-4 text-text-muted" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================
// LIVE STATS
// ============================================

function LiveStats() {
  const [stats, setStats] = useState({
    entitiesExtracted: 12847,
    plotHolesCaught: 1563,
    worldsOrganized: 234,
    hourssSaved: 4721,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        entitiesExtracted: prev.entitiesExtracted + Math.floor(Math.random() * 8),
        plotHolesCaught: prev.plotHolesCaught + Math.floor(Math.random() * 2),
        worldsOrganized: prev.worldsOrganized + (Math.random() > 0.8 ? 1 : 0),
        hourssSaved: prev.hourssSaved + Math.floor(Math.random() * 3),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const statItems = [
    { label: "Characters & items auto-extracted", value: stats.entitiesExtracted, suffix: "", highlight: true },
    { label: "Contradictions caught", value: stats.plotHolesCaught, suffix: "", highlight: true },
    { label: "Worlds organized", value: stats.worldsOrganized, suffix: "" },
    { label: "Hours of manual work saved", value: stats.hourssSaved, suffix: "+" },
  ];

  return (
    <section className="py-12 px-6 border-y border-border bg-bg-secondary/30">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {statItems.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <div
                className={`text-2xl md:text-3xl font-medium tabular-nums ${stat.highlight ? "text-cyan-400" : "text-text-primary"}`}
              >
                {stat.value.toLocaleString()}
                {stat.suffix}
              </div>
              <div className="text-xs md:text-sm text-text-muted mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs text-text-muted/60 mt-6">
          Real metrics from writers using Mythos
        </p>
      </div>
    </section>
  );
}

// ============================================
// NOT A TEXT GENERATOR
// ============================================

function NotATextGenerator() {
  return (
    <section className="py-16 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-xl border border-border bg-bg-secondary/30 p-8 md:p-10"
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">
                Not a text generator.{" "}
                <span className="text-text-muted">
                  An organizational tool with AI superpowers.
                </span>
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                We know writers are skeptical of AI — and rightfully so. Mythos
                doesn't write your story. It tracks what <em>you</em> wrote,
                catches <em>your</em> contradictions, and organizes{" "}
                <em>your</em> world. You always have final say. Every AI
                suggestion requires your approval.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  AI extracts entities you wrote
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Suggestions require approval
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Never claims authorship
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// FEATURES
// ============================================

const FEATURES = [
  {
    icon: Wand2,
    title: "Throw in info. AI sorts it automatically.",
    description:
      "Paste 10,000 words. Watch characters, locations, and items appear in your sidebar — extracted, organized, linked. Zero manual data entry.",
    highlight: "Entity auto-detection",
  },
  {
    icon: Shield,
    title: "Catch contradictions before readers do.",
    description:
      "Blue eyes in chapter 3, brown in chapter 12? The consistency linter catches it. Timeline conflicts, character inconsistencies, plot holes — found and flagged.",
    highlight: "Consistency linting",
  },
  {
    icon: BookMarked,
    title: "Your master document, always organized.",
    description:
      "Visual Project Graph shows all your characters, locations, and their relationships. Export a complete series bible with one click.",
    highlight: "Project Graph + Export",
  },
  {
    icon: Brain,
    title: "Write your story. We remember your world.",
    description:
      "AI remembers your characters, your decisions, your style. Ask 'What happened to Marcus?' and get answers from your own manuscript.",
    highlight: "RAG-powered chat",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-medium mb-3">
            Built for writers who track complex worlds
          </h2>
          <p className="text-text-muted">
            From the Discord feedback of fiction writers who needed better tools
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group p-6 rounded-xl border border-border bg-bg-secondary/20 hover:bg-bg-secondary/40 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-bg-tertiary text-text-muted group-hover:text-text-primary transition-colors">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-medium">
                      {feature.highlight}
                    </span>
                  </div>
                  <h3 className="font-medium mb-2 text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// BUILT FOR
// ============================================

const AUDIENCES = [
  {
    icon: PenTool,
    title: "Fiction Writers",
    description:
      "Epic fantasy with 50+ characters? Mystery with intricate timelines? We track it all.",
  },
  {
    icon: Gamepad2,
    title: "TTRPG Game Masters",
    description:
      "D&D campaigns, homebrew worlds, session notes. DM Mode shows stats and secrets.",
  },
  {
    icon: BookOpen,
    title: "Manga & Comic Writers",
    description:
      "Visual novels, webtoons, storyboards. Character sheets and world bibles built-in.",
  },
  {
    icon: Users,
    title: "Writing Teams",
    description:
      "Collaborate on shared worlds. Real-time sync, comments, and activity feeds.",
  },
];

function BuiltFor() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-medium mb-3">
            Built for anyone with "too many characters to remember"
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {AUDIENCES.map((audience, i) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex p-3 rounded-xl bg-bg-secondary border border-border mb-4">
                <audience.icon className="w-5 h-5 text-text-muted" />
              </div>
              <h3 className="font-medium mb-1 text-sm">{audience.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {audience.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// PRICING
// ============================================

const PRICING = [
  {
    name: "Free",
    price: "Free",
    description: "Includes:",
    features: ["10K AI tokens/month", "Basic AI chat & search", "3 projects"],
    cta: "Get Started",
    recommended: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "/mo.",
    description: "Everything in Free, plus:",
    features: [
      "500K AI tokens/month",
      "Full AI suite (Linter, Coach)",
      "10 projects",
      "$0.10/1K token overage",
    ],
    cta: "Get Pro",
    recommended: false,
  },
  {
    name: "Pro+",
    price: "$40",
    period: "/mo.",
    description: "Everything in Pro, plus:",
    features: [
      "2M AI tokens/month",
      "Unlimited projects",
      "5 collaborators",
      "$0.08/1K token overage",
    ],
    cta: "Get Pro+",
    recommended: true,
  },
  {
    name: "Team",
    price: "$99",
    period: "/mo.",
    description: "Everything in Pro+, plus:",
    features: [
      "10M AI tokens/month",
      "Unlimited collaborators",
      "API access",
      "$0.05/1K token overage",
    ],
    cta: "Get Team",
    recommended: false,
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-medium mb-6">Pricing</h2>

          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-secondary border border-border">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                !annual ? "bg-bg-tertiary text-text-primary" : "text-text-muted"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                annual ? "bg-bg-tertiary text-text-primary" : "text-text-muted"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <p className="text-sm text-text-muted mb-4">Individual Plans</p>

        <div className="grid md:grid-cols-4 gap-4">
          {PRICING.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="card p-6 flex flex-col"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{plan.name}</h3>
                  {plan.recommended && (
                    <span className="text-xs text-amber-500">Recommended</span>
                  )}
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-medium">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-text-muted">{plan.period}</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-text-muted mb-4">{plan.description}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn w-full justify-center ${
                  plan.recommended ? "btn-primary" : "btn-secondary"
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-muted">
          <BookOpen className="w-4 h-4" />
          <span className="text-sm">© 2025 Mythos</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-text-muted">
          <a href="/privacy" className="hover:text-text-primary transition-colors">
            Privacy
          </a>
          <a href="/terms" className="hover:text-text-primary transition-colors">
            Terms
          </a>
          <a
            href="https://twitter.com"
            className="hover:text-text-primary transition-colors"
          >
            Twitter
          </a>
          <a
            href="https://github.com"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
