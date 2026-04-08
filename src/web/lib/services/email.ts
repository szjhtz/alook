import { Resend } from "resend";

export class EmailService {
  private client: Resend | null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@alook.ai";
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (!this.client) {
      console.log(`[DEV] Verification code for ${to}: ${code}`);
      return;
    }

    await this.client.emails.send({
      from: this.fromEmail,
      to: [to],
      subject: "Your Alook verification code",
      html: `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2>Your verification code</h2>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>`,
    });
  }
}
