import { loadWorkspace } from "@/lib/data";
import { fmtSalary } from "@/lib/domain";
import { Avatar } from "@/components/bits";
import { OfferActions } from "@/components/view-actions";

function daysAgo(iso: string) {
  return Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 86_400_000));
}
function daysUntil(iso: string | null) {
  if (!iso) return 0;
  return Math.ceil((+new Date(iso) - Date.now()) / 86_400_000);
}

export default async function OffersPage() {
  const { ws } = await loadWorkspace();

  const cards = ws.offers
    .map((o) => ({ offer: o, cand: ws.byId.get(o.candidate_id) }))
    .filter(
      (x) =>
        x.cand &&
        (x.cand.stageKey === "Offered" || x.cand.stageKey === "Offer Accepted"),
    );

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="grid grid-cols-2 gap-4">
        {cards.map(({ offer, cand }) => {
          const accepted = cand!.stageKey === "Offer Accepted";
          const until = daysUntil(offer.expires_at);
          return (
            <div
              key={offer.id}
              className="rounded-2xl border border-[#e9edf3] bg-white p-5"
            >
              <div className="flex items-center gap-3.5">
                <Avatar name={cand!.name} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-extrabold">{cand!.name}</div>
                  <div className="text-[12px] font-medium text-[#8a94a6]">
                    {cand!.jobTitle}
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                  style={{
                    color: accepted ? "#16a34a" : "#b27400",
                    background: accepted ? "#e9f9ef" : "#fff7e6",
                  }}
                >
                  {accepted ? "Accepted" : "Pending"}
                </span>
              </div>

              <div className="mt-[18px] grid grid-cols-3 gap-3 rounded-xl bg-[#f7f9fc] p-4">
                <Field label="Package">
                  <span className="tf-num">{fmtSalary(offer.salary_lpa)}</span>
                </Field>
                <Field label="Sent">{daysAgo(offer.sent_at)}d ago</Field>
                <Field label="Expires">
                  <span
                    style={{
                      color: accepted
                        ? "#16a34a"
                        : until <= 2
                          ? "#ef4444"
                          : "#16203a",
                    }}
                  >
                    {accepted ? "Accepted" : `${Math.max(0, until)} days`}
                  </span>
                </Field>
              </div>

              <OfferActions id={cand!.id} accepted={accepted} />
            </div>
          );
        })}
        {cards.length === 0 && (
          <div className="col-span-2 py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
            No active offers.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#9aa4b6]">{label}</div>
      <div className="text-[14px] font-extrabold text-[#16203a]">{children}</div>
    </div>
  );
}
