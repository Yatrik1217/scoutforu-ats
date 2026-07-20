"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Globe, ExternalLink, EyeOff } from "lucide-react";
import { setJobPublished } from "@/lib/actions/mutations";

export function JobPublish({
  jobId,
  published,
  publishedAt,
}: {
  jobId: string;
  published: boolean;
  publishedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const act = (next: boolean) =>
    start(async () => {
      const res = await setJobPublished(jobId, next);
      if (res.ok) toast.success(res.message || "Done");
      else toast.error(res.error || "Failed");
    });

  if (published) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#bbe7cc] bg-[#f2fbf5] p-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16a34a] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16a34a]" />
        </span>
        <span className="flex-1 text-[12px] font-bold text-[#15803d]">
          Live on website
          {publishedAt && (
            <span className="ml-1.5 font-semibold text-[#5aa877]">
              since {new Date(publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </span>
        <a
          href={`/careers/${jobId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-[8px] border border-[#bbe7cc] bg-white px-3 py-1.5 text-[12px] font-bold text-[#15803d] hover:bg-[#f2fbf5]"
        >
          <ExternalLink size={13} /> View
        </a>
        <button
          onClick={() => act(false)}
          disabled={pending}
          className="flex items-center gap-1 rounded-[8px] border border-[#e6eaf1] bg-white px-3 py-1.5 text-[12px] font-bold text-[#6b7686] hover:bg-[#f6f8fb] disabled:opacity-50"
        >
          <EyeOff size={13} /> Unpublish
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-[#f8fafd] p-2.5">
      <Globe size={14} className="shrink-0 text-[#8a94a6]" />
      <span className="flex-1 text-[12px] font-bold text-[#6b7686]">Not on your website</span>
      <button
        onClick={() => act(true)}
        disabled={pending}
        className="flex items-center gap-1 rounded-[8px] bg-[#2a6fdb] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#2360c0] disabled:opacity-50"
      >
        <Globe size={13} /> {pending ? "Publishing…" : "Publish to website"}
      </button>
    </div>
  );
}
