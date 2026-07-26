import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, RefreshCw, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ConfirmDialog } from "./ui/dialog";
import { useToast } from "./ui/useToast";

interface VocabStat {
  word: string;
  count: number;
  last_seen_at: string;
}

export default function VocabularyStatsView() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [stats, setStats] = useState<VocabStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getVocabularyStats();
      setStats(Array.isArray(data) ? data : []);
    } catch {
      toast({
        title: t("vocabularyStats.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleDelete = async (word: string) => {
    try {
      const result = await window.electronAPI.deleteVocabularyStat(word);
      if (result && !result.success) {
        toast({
          title: t("vocabularyStats.deleteError"),
          variant: "destructive",
        });
        return;
      }
      setStats((prev) => prev.filter((s) => s.word !== word));
      toast({ title: t("vocabularyStats.deleted") });
    } catch {
      toast({
        title: t("vocabularyStats.deleteError"),
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    try {
      const result = await window.electronAPI.clearVocabularyStats();
      if (result && !result.success) {
        toast({
          title: t("vocabularyStats.clearError"),
          variant: "destructive",
        });
        return;
      }
      setStats([]);
      setConfirmClear(false);
      toast({ title: t("vocabularyStats.cleared") });
    } catch {
      toast({
        title: t("vocabularyStats.clearError"),
        variant: "destructive",
      });
    }
  };

  const filtered = stats.filter((s) =>
    s.word.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = filtered.sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("vocabularyStats.searchPlaceholder")}
            className="h-8 pl-9 text-xs"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadStats}
          disabled={loading}
          className="h-8 px-2"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="rounded-md border border-foreground/8 dark:border-white/6 bg-foreground/[0.02] dark:bg-white/[0.03] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-foreground/40">
            {t("vocabularyStats.title", { count: sorted.length })}
          </h3>
          {sorted.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs text-foreground/15 hover:text-destructive/70 transition-colors"
            >
              {t("vocabularyStats.clearAll")}
            </button>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="py-6 text-xs text-foreground/20 text-center">
            {t("vocabularyStats.empty")}
          </p>
        ) : (
          <ul>
            {sorted.map((stat) => (
              <li
                key={stat.word}
                className="group flex items-center justify-between h-9 border-b border-foreground/4 dark:border-white/3 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-foreground/60 truncate">{stat.word}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground/25">
                  <span className="w-12 text-right">{stat.count}</span>
                  <span className="w-24 text-right">{stat.last_seen_at}</span>
                  <button
                    onClick={() => handleDelete(stat.word)}
                    aria-label={t("vocabularyStats.deleteWord", { word: stat.word })}
                    className="p-1 opacity-0 group-hover:opacity-100 text-foreground/25 hover:text-destructive/70 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t("vocabularyStats.clearConfirmTitle")}
        description={t("vocabularyStats.clearConfirmDesc")}
        confirmText={t("vocabularyStats.clearAll")}
        onConfirm={handleClearAll}
      />
    </div>
  );
}
