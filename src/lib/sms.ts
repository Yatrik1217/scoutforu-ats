import "server-only";

// SMS gateway via env vars. Supported providers:
//  - MSG91 (India): SMS_PROVIDER=msg91, MSG91_AUTH_KEY, MSG91_SENDER (6-char id)
//  - Twilio:        SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM

export function smsProvider(): "msg91" | "twilio" | null {
  const p = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (p === "msg91" && process.env.MSG91_AUTH_KEY) return "msg91";
  if (p === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
    return "twilio";
  return null;
}

const digits = (s: string) => (s || "").replace(/\D/g, "");

// Send an SMS. Returns an error string on failure, null on success.
export async function sendSms(to: string, message: string): Promise<string | null> {
  const provider = smsProvider();
  if (!provider) return "SMS is not configured";
  const num = digits(to);
  if (num.length < 10) return "Invalid phone number";
  const e164 = num.length === 10 ? `91${num}` : num; // default to India CC

  try {
    if (provider === "msg91") {
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authkey: process.env.MSG91_AUTH_KEY!,
        },
        body: JSON.stringify({
          sender: process.env.MSG91_SENDER || "SCOUTU",
          short_url: "0",
          mobiles: e164,
          // Plain-text route (v5 sms endpoint) fallback:
          sms: [{ message, to: [e164] }],
        }),
      });
      if (!res.ok) return `MSG91 error ${res.status}: ${(await res.text()).slice(0, 200)}`;
      return null;
    }
    // Twilio
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization:
          "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `+${e164}`,
        From: process.env.TWILIO_FROM!,
        Body: message,
      }),
    });
    if (!res.ok) return `Twilio error ${res.status}: ${(await res.text()).slice(0, 200)}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "SMS send failed";
  }
}
