import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export interface EmailDelivery {
  sendVerification(to: string, token: string): Promise<void>;
  sendPasswordReset(to: string, token: string): Promise<void>;
}

@Injectable()
export class ResendEmailDelivery implements EmailDelivery {
  private readonly logger = new Logger(ResendEmailDelivery.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from = process.env.EMAIL_FROM;
  private readonly appUrl = process.env.APP_BASE_URL ?? 'http://localhost:8081';

  async sendVerification(to: string, token: string) {
    await this.send(
      to,
      'ยืนยันอีเมล Sunha POS',
      `ยืนยันอีเมลของคุณ: ${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`,
    );
  }

  async sendPasswordReset(to: string, token: string) {
    await this.send(
      to,
      'รีเซ็ตรหัสผ่าน Sunha POS',
      `รีเซ็ตรหัสผ่านของคุณ: ${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`,
    );
  }

  private async send(to: string, subject: string, text: string) {
    if (!this.apiKey || !this.from) {
      if (process.env.NODE_ENV === 'production')
        throw new ServiceUnavailableException('EMAIL_PROVIDER_NOT_CONFIGURED');
      this.logger.warn(
        'Email provider is not configured; email delivery skipped in non-production',
      );
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
    });
    if (!response.ok) {
      this.logger.error(`Email provider failed with status ${response.status}`);
      throw new ServiceUnavailableException('EMAIL_DELIVERY_FAILED');
    }
  }
}
