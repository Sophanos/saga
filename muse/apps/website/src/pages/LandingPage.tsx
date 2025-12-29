import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Check, Plus, ArrowUp, FileText, X } from "lucide-react";

/**
 * Landing Page - Cursor.ai inspired minimal design
 * Almost monochrome with subtle borders
 */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <Hero />
      <LiveStats />
      <Features />
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
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <span className="font-semibold">Mythos</span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Pricing
          </a>
          <a href="/docs" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Docs
          </a>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Sign in
          </a>
          <a href="/signup" className="btn btn-secondary">
            Download
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
    <section id="hero-section" className="relative pt-20 px-6 pb-40">
      {/* Headline */}
      <div className="max-w-4xl mx-auto text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl lg:text-5xl font-medium leading-[1.1] tracking-tight mb-3"
        >
          Built to make you{" "}
          <span className="text-text-secondary">extraordinarily productive</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-base md:text-lg text-text-muted"
        >
          Mythos is the best way to write fiction with AI.
        </motion.p>
      </div>

      {/* App Preview */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
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
      {/* Glow effect behind */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-transparent z-10 pointer-events-none" />

      {/* App window */}
      <div className="absolute inset-0 rounded-xl border border-border bg-bg-secondary overflow-hidden shadow-2xl shadow-black/50">
        {/* Window chrome */}
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

        {/* App content */}
        <div className="flex h-[calc(100%-44px)]">
          {/* Editor */}
          <div className="flex-1 p-6 overflow-hidden">
            <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
              <p>
                <span className="text-text-primary">Elena</span> stood at the edge of the cliff,
                the wind whipping her <span className="text-text-primary">dark hair</span> against
                her face. Below, the ancient city of <span className="text-text-primary">Valdris</span> sprawled
                in the morning mist.
              </p>
              <p>
                "You shouldn't have come here," a voice said behind her. She turned to find{" "}
                <span className="text-text-primary">Marcus</span> emerging from the shadows, his{" "}
                <span className="border-b border-dashed border-amber-500/60 text-amber-200/90">blue eyes</span>{" "}
                sharp with concern.
              </p>
              <p className="text-text-muted">
                The weight of the <span className="text-text-primary">crystal pendant</span> felt
                heavier than ever against her chest...
              </p>
            </div>
          </div>

          {/* AI Sidebar */}
          <div className="w-64 border-l border-border bg-bg-primary/30 p-4 hidden md:block">
            <div className="space-y-4">
              {/* Consistency Alert */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-200/80">Consistency</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Marcus has <span className="text-amber-200/80">brown eyes</span> in Ch.3.
                  Verify eye color.
                </p>
              </div>

              {/* Entities */}
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
      <div className={`w-1.5 h-1.5 rounded-full ${
        type === "protagonist" ? "bg-cyan-400" :
        type === "character" ? "bg-text-muted" :
        type === "location" ? "bg-emerald-400/70" :
        "bg-violet-400/70"
      }`} />
      <span className="text-text-secondary">{name}</span>
    </div>
  );
}

// ============================================
// FLOATING CHAT BAR
// ============================================

function FloatingChatBar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [userOverride, setUserOverride] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasContent = inputValue.trim().length > 0 || files.length > 0;

  // Use IntersectionObserver for robust scroll detection
  useEffect(() => {
    const heroSection = document.getElementById("hero-section");
    if (!heroSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Hero is "in view" when at least 30% visible
        const inView = entry.isIntersecting && entry.intersectionRatio > 0.3;
        setHeroInView(inView);

        // Only auto-update if user hasn't manually toggled
        if (!userOverride) {
          setIsExpanded(inView);
        }
      },
      {
        threshold: [0, 0.3, 0.5, 1],
        rootMargin: "-100px 0px 0px 0px"
      }
    );

    observer.observe(heroSection);
    return () => observer.disconnect();
  }, [userOverride]);

  // Reset user override when scrolling back to hero
  useEffect(() => {
    if (heroInView && userOverride) {
      setUserOverride(false);
      setIsExpanded(true);
    }
  }, [heroInView, userOverride]);

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
    setFiles(prev => [...prev, ...droppedFiles]);
    setIsExpanded(true);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = () => {
    if (hasContent) {
      window.location.href = "/signup";
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
            // Expanded state
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className={`
                relative rounded-2xl border
                shadow-2xl shadow-black/50 backdrop-blur-md
                ${isDragging
                  ? "border-white/30 bg-bg-secondary/95"
                  : "border-border bg-bg-secondary/95"
                }
              `}
            >
              {/* Collapse handle (only when not in hero view) */}
              {!heroInView && (
                <button
                  onClick={handleCollapse}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  Minimize
                </button>
              )}

              {/* File chips */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 pb-0 pt-4">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-text-secondary truncate max-w-[150px]">{file.name}</span>
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

              {/* Textarea */}
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Paste your chapter or describe your story..."
                className={`w-full bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none p-4 min-h-[60px] text-base ${files.length === 0 ? 'pt-4' : ''}`}
                rows={2}
              />

              {/* Bottom bar */}
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
                  disabled={!hasContent}
                  className={`
                    p-2.5 rounded-full transition-all duration-200
                    ${hasContent
                      ? "bg-white text-bg-primary hover:bg-white/90"
                      : "bg-bg-tertiary text-text-muted cursor-not-allowed"
                    }
                  `}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>

              {/* Drag overlay */}
              {isDragging && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-bg-secondary/95 backdrop-blur-sm pointer-events-none">
                  <p className="text-text-secondary">Drop your files here</p>
                </div>
              )}
            </motion.div>
          ) : (
            // Minimized state
            <motion.button
              key="minimized"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              onClick={handleExpand}
              className="
                w-full px-5 py-3.5 rounded-full border border-border
                bg-bg-secondary/95 backdrop-blur-md shadow-2xl shadow-black/50
                flex items-center gap-3 text-left
                hover:border-border-hover hover:bg-bg-tertiary/90 transition-all
              "
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
    chapters: 1247,
    worlds: 89,
    characters: 3421,
    inconsistencies: 156,
  });

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        chapters: prev.chapters + Math.floor(Math.random() * 3),
        worlds: prev.worlds + (Math.random() > 0.7 ? 1 : 0),
        characters: prev.characters + Math.floor(Math.random() * 5),
        inconsistencies: prev.inconsistencies + Math.floor(Math.random() * 2),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const statItems = [
    { label: "Chapters written today", value: stats.chapters, suffix: "" },
    { label: "Worlds built", value: stats.worlds, suffix: "" },
    { label: "Characters brought to life", value: stats.characters, suffix: "" },
    { label: "Plot holes caught", value: stats.inconsistencies, suffix: "" },
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
              <div className="text-2xl md:text-3xl font-medium text-text-primary tabular-nums">
                {stat.value.toLocaleString()}{stat.suffix}
              </div>
              <div className="text-xs md:text-sm text-text-muted mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs text-text-muted/60 mt-6">
          Live stats from writers using Mythos right now
        </p>
      </div>
    </section>
  );
}

// ============================================
// FEATURES
// ============================================

const FEATURES = [
  {
    title: "AI Writing Coach",
    description: "Real-time feedback on tension, pacing, and show-don't-tell. Improve your prose as you write.",
  },
  {
    title: "World Graph",
    description: "Track characters, locations, and relationships like code variables. Never lose a plot thread.",
  },
  {
    title: "Consistency Linter",
    description: "Catch contradictions automatically. Blue eyes in chapter 3, brown in chapter 12? We find it.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-medium mb-12">Features</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <h3 className="font-medium mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {feature.description}
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
    features: [
      "10K AI tokens/month",
      "Basic AI chat & search",
      "3 projects",
    ],
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
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-medium mb-6">Pricing</h2>

          {/* Toggle */}
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

        {/* Section label */}
        <p className="text-sm text-text-muted mb-4">Individual Plans</p>

        {/* Pricing cards */}
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
              {/* Header */}
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

              {/* Description */}
              <p className="text-sm text-text-muted mb-4">{plan.description}</p>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
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
          <a href="/privacy" className="hover:text-text-primary transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-text-primary transition-colors">Terms</a>
          <a href="https://twitter.com" className="hover:text-text-primary transition-colors">Twitter</a>
          <a href="https://github.com" className="hover:text-text-primary transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
