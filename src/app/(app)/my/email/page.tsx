import { requireProfile } from "@/lib/auth";
import { getMyEmailSettings } from "@/lib/actions/my-email";
import { MyEmailForm } from "@/components/my-email-form";

export const dynamic = "force-dynamic";

export default async function MyEmailPage() {
  const me = await requireProfile();
  const settings = await getMyEmailSettings();

  return (
    <div className="animate-sc-fadein mx-auto max-w-[640px] p-[22px_26px_40px]">
      <h1 className="text-[20px] font-extrabold text-[#16203a]">My Email</h1>
      <p className="mb-5 mt-1 text-[13px] text-[#8a94a6]">
        Send candidate emails — interview invites, stage updates, and the Message box — from{" "}
        <b>your own mailbox</b>, so they arrive as coming from you. Until you set this up, they go
        from the shared company mailbox stamped with your name.
      </p>
      <MyEmailForm settings={settings} myName={me.name} myEmail={me.email} />
    </div>
  );
}
