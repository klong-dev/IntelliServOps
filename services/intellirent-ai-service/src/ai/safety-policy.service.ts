import { Injectable } from '@nestjs/common';

type SafetyDecision =
  | {
      answer: string;
      confidence: number;
      shouldHandoff: true;
      handoffReason: string;
      sourceIds: string[];
    }
  | null;

@Injectable()
export class SafetyPolicyService {
  evaluate(message: string, contextCount: number): SafetyDecision {
    const normalized = this.normalize(message);

    const blockedRules: Array<{ reason: string; keywords: string[] }> = [
      {
        reason: 'billing_or_payment',
        keywords: [
          'hoa don',
          'thanh toan',
          'payment',
          'invoice',
          'refund',
          'hoan tien',
          'payos',
        ],
      },
      {
        reason: 'contract_specific',
        keywords: ['hop dong', 'gia han', 'phu luc', 'contract'],
      },
      {
        reason: 'account_or_security',
        keywords: [
          'otp',
          'mat khau',
          'password',
          'ma cua',
          'smart lock pin',
          'mailbox code',
          'wifi password',
        ],
      },
      {
        reason: 'private_status',
        keywords: [
          'ho so cua toi',
          'tai khoan cua toi',
          'trang thai yeu cau',
          'invoice cua toi',
          'hop dong cua toi',
        ],
      },
    ];

    for (const rule of blockedRules) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        return {
          answer:
            'Noi dung nay can nhan su ho tro kiem tra theo tai khoan hoac nghiep vu cu the. Mình sẽ chuyển yêu cầu sang bộ phận phụ trách để phản hồi chi tiết hơn.',
          confidence: 0,
          shouldHandoff: true,
          handoffReason: rule.reason,
          sourceIds: [],
        };
      }
    }

    if (contextCount === 0) {
      return {
        answer:
          'Mình chưa có đủ dữ liệu phù hợp để trả lời chính xác. Mình sẽ chuyển cuộc trò chuyện này cho bộ phận hỗ trợ để phản hồi chi tiết hơn.',
        confidence: 0,
        shouldHandoff: true,
        handoffReason: 'insufficient_context',
        sourceIds: [],
      };
    }

    return null;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
