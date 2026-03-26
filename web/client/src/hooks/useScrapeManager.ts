import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { useScrapeStore } from "@/stores/scrapeStore";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useScrapeManager() {
  const queryClient = useQueryClient();
  const { 
    setIsScraping, 
    setCurrentJobId, 
    setScrapeProgress, 
    setCaptchaUrl, 
    resetScrapeState,
    currentJobId
  } = useScrapeStore();

  // 1. Initial Check for Active Job (Anti-Refresh)
  useEffect(() => {
    const checkActiveJob = async () => {
      try {
        const res = await fetch('/api/scrape/my-active-job');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data && data.jobId && (data.status === 'running' || data.status === 'queued')) {
          setCurrentJobId(data.jobId);
          setIsScraping(true);
          if (data.progress) {
            setScrapeProgress(data.progress);
          } else {
            setScrapeProgress({ 
              message: data.status === 'queued' ? "In queue..." : "Running...", 
              percentage: 0 
            });
          }
          // Re-join socket room
          socket.emit("join-job", data.jobId);
        }
      } catch (err) {
        console.error("Failed to check active job", err);
      }
    };
    checkActiveJob();
  }, [setCurrentJobId, setIsScraping, setScrapeProgress]);

  // 2. Socket Listeners
  useEffect(() => {
    socket.connect();
    
    // re-join room on reconnection
    const handleConnect = () => {
      if (currentJobId) {
        socket.emit("join-job", currentJobId);
      }
    };
    socket.on("connect", handleConnect);

    socket.on("scrape-status", (data) => {
      const msg = typeof data === 'string' ? data : (data.status || 'Processing...');
      setScrapeProgress((prev) => ({ ...prev, message: msg }));
    });

    socket.on("scrape-progress", (data) => {
      const current = data.current || 0;
      const total = data.total || 1;
      const pct = Math.round((current / total) * 100);
      setScrapeProgress({ 
        message: data.message || `Processing ${current}/${total}...`, 
        percentage: pct 
      });
    });

    socket.on("captcha-url", (url) => {
      setCaptchaUrl(url);
      toast.warning("Captcha encountered! Action required.", { id: "captcha-toast" }); // Unique ID to prevent spam
    });

    socket.on("scrape-done", () => {
      toast.success("Scraping completed! Results updated.", { id: "scrape-done-toast" });
      resetScrapeState();
      // Use refetchType: 'all' to ensure it's not just invalidated but actually reloaded
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    });

    socket.on("scrape-error", (data) => {
      const msg = typeof data === 'string' ? data : (data.message || 'Unknown error');
      toast.error(`Scrape Error: ${msg}`, { id: "scrape-error-toast" });
      resetScrapeState();
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("scrape-status");
      socket.off("scrape-progress");
      socket.off("captcha-url");
      socket.off("scrape-done");
      socket.off("scrape-error");
    };
  }, [setScrapeProgress, setCaptchaUrl, resetScrapeState, queryClient, currentJobId]);

  return { currentJobId };
}
