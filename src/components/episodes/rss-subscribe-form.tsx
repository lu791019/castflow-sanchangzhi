"use client";

import { useEffect, useState } from "react";
import {
  listFeedsAction,
  subscribeRssAction,
} from "@/app/(app)/episodes/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Rss } from "lucide-react";

interface FeedRow {
  id: string;
  url: string;
  title: string | null;
  created_at: string;
}

export function RssSubscribeForm() {
  const [feedUrl, setFeedUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [feeds, setFeeds] = useState<FeedRow[]>([]);

  const loadFeeds = async () => {
    const result = await listFeedsAction();
    setFeeds(result.feeds);
  };

  useEffect(() => {
    let active = true;
    listFeedsAction().then((result) => {
      if (active) setFeeds(result.feeds);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const result = await subscribeRssAction({ feedUrl });
    setSubmitting(false);

    if (result.error !== undefined) {
      setErrorMsg(result.error);
      return;
    }
    setSuccessMsg(
      `已訂閱「${result.feed.title ?? result.feed.url}」，最新集「${result.episode.title}」已排入待轉錄`,
    );
    setFeedUrl("");
    await loadFeeds();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Feed URL</label>
          <Input
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            type="url"
            required
          />
        </div>

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        {successMsg && <p className="text-sm text-ink-600">{successMsg}</p>}

        <Button
          type="submit"
          disabled={!feedUrl.trim() || submitting}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              訂閱中...
            </>
          ) : (
            <>
              <Rss className="mr-2 h-4 w-4" />
              訂閱 feed
            </>
          )}
        </Button>
      </form>

      {feeds.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">已訂閱 feeds</p>
          <ul className="space-y-2">
            {feeds.map((feed) => (
              <li key={feed.id} className="text-sm">
                <span className="font-medium">{feed.title ?? "(未命名)"}</span>{" "}
                <span className="text-ink-600 break-all">{feed.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
