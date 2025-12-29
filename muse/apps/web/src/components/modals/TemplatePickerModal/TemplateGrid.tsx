import { useState, useMemo } from "react";
import { Input } from "@mythos/ui";
import { Search } from "lucide-react";
import {
  BUILTIN_TEMPLATES,
  searchTemplates,
  type ProjectTemplate,
  type TemplateCategory,
} from "@mythos/core";
import { TemplateCard } from "./TemplateCard";

interface TemplateGridProps {
  onSelectTemplate: (template: ProjectTemplate) => void;
}

const CATEGORY_LABELS: Record<TemplateCategory | "all", string> = {
  all: "All",
  fantasy: "Fantasy",
  scifi: "Sci-Fi",
  horror: "Horror",
  literary: "Literary",
  ttrpg: "TTRPG",
  manga: "Manga",
  visual: "Visual",
  screenplay: "Screenplay",
  serial: "Serial",
  custom: "Custom",
};

// Order categories for display
const CATEGORY_ORDER: (TemplateCategory | "all")[] = [
  "all",
  "fantasy",
  "scifi",
  "literary",
  "ttrpg",
  "manga",
  "visual",
  "screenplay",
  "serial",
  "horror",
];

export function TemplateGrid({ onSelectTemplate }: TemplateGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    // Exclude blank template from browsing - it's accessed via "Start Blank"
    let templates = BUILTIN_TEMPLATES.filter((t) => t.id !== "blank");

    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery).filter((t) => t.id !== "blank");
    } else if (selectedCategory !== "all") {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  // Get categories that have templates
  const availableCategories = useMemo(() => {
    const cats = new Set(BUILTIN_TEMPLATES.filter((t) => t.id !== "blank").map((t) => t.category));
    return CATEGORY_ORDER.filter((c) => c === "all" || cats.has(c as TemplateCategory));
  }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mythos-text-muted" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="pl-9"
        />
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-1.5">
          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedCategory === category
                  ? "bg-mythos-accent-cyan/20 text-mythos-accent-cyan font-medium"
                  : "text-mythos-text-muted hover:text-mythos-text-secondary hover:bg-mythos-text-muted/10"
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      )}

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => onSelectTemplate(template)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <p className="text-center py-8 text-mythos-text-muted text-sm">
          No templates found. Try a different search or category.
        </p>
      )}
    </div>
  );
}
