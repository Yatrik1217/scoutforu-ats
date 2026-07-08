"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { addUser } from "@/lib/actions/users";

type ClientOpt = { id: string; name: string };

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let p = "";
  const rand = new Uint32Array(12);
  crypto.getRandomValues(rand);
  for (const r of rand) p += chars[r % chars.length];
  return p;
}

export function AddUserButton({
  clients,
  smtpConfigured,
}: {
  clients: ClientOpt[];
  smtpConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#245fc0]"
      >
        <UserPlus size={14} /> Add User
      </button>
      {open && (
        <AddUserModal clients={clients} smtpConfigured={smtpConfigured} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AddUserModal({
  clients,
  smtpConfigured,
  onClose,
}: {
  clients: ClientOpt[];
  smtpConfigured: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"recruiter" | "client">("recruiter");
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [showPw, setShowPw] = useState(true);
  const [emailCreds, setEmailCreds] = useState(smtpConfigured);
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await addUser({
        name,
        email,
        password,
        role,
        clientId: role === "client" ? clientId : null,
        emailCredentials: emailCreds,
      });
      if (res.ok) {
        toast.success(res.message || "User added");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error || "Failed to add user");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-[16px] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">Add User</h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
          {(
            [
              ["recruiter", "Recruiter"],
              ["client", "Client login"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setRole(k)}
              className={`flex-1 rounded-[8px] py-1.5 text-[12.5px] font-bold transition ${
                role === k ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mb-2.5 block text-[12px] font-bold text-[#42506b]">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" className={input + " mt-1 font-normal"} />
        </label>
        <label className="mb-2.5 block text-[12px] font-bold text-[#42506b]">
          Email (their login)
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="priya@scoutforu.com" className={input + " mt-1 font-normal"} />
        </label>

        {role === "client" && (
          <label className="mb-2.5 block text-[12px] font-bold text-[#42506b]">
            Client company
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={input + " mt-1 cursor-pointer font-normal"}>
              <option value="">— Select company —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-1 block text-[12px] font-bold text-[#42506b]">
          Temporary password
          <div className="mt-1 flex gap-1.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              className={input + " font-normal"}
            />
            <button
              onClick={() => setShowPw((v) => !v)}
              title={showPw ? "Hide" : "Show"}
              className="rounded-[9px] border border-[#e3e8f0] px-2.5 text-[#8a94a6] hover:bg-[#f6f8fb]"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={() => setPassword(genPassword())}
              title="Generate new password"
              className="rounded-[9px] border border-[#e3e8f0] px-2.5 text-[#8a94a6] hover:bg-[#f6f8fb]"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </label>
        <p className="mb-3 text-[11px] text-[#9aa4b6]">
          Share this with them — they use it to sign in{smtpConfigured ? "" : " (email sending is not configured, so copy it now)"}.
        </p>

        {smtpConfigured && (
          <label className="mb-4 flex items-center gap-2 text-[12.5px] font-semibold text-[#42506b]">
            <input
              type="checkbox"
              checked={emailCreds}
              onChange={(e) => setEmailCreds(e.target.checked)}
              className="h-4 w-4 accent-[#2a6fdb]"
            />
            Email the login details to them
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[9px] border border-[#e6eaf1] bg-white px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            <UserPlus size={14} />
            {pending ? "Adding…" : "Add user"}
          </button>
        </div>
      </div>
    </div>
  );
}
