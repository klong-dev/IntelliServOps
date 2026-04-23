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

const HUMAN_SUPPORT_DIRECT_PHRASES = [
  'toi muon gap cham soc khach hang',
  'toi muon gap cskh',
  'toi muon chat voi con nguoi',
  'toi muon chat voi nguoi that',
  'toi muon noi chuyen voi con nguoi',
  'toi muon noi chuyen voi nguoi that',
  'toi muon gap nguoi that',
  'toi muon gap con nguoi',
  'toi muon gap nhan vien',
  'toi muon noi chuyen voi nhan vien',
  'toi muon gap tu van vien',
  'toi muon lien he cham soc khach hang',
  'toi muon lien he cskh',
  'toi muon lien he tong dai',
  'toi can nhan vien ho tro',
  'toi can nguoi that ho tro',
  'toi can cham soc khach hang',
  'toi can cskh',
  'toi can support',
  'cho toi gap cskh',
  'cho toi gap cham soc khach hang',
  'cho toi gap nhan vien',
  'cho toi noi chuyen voi nhan vien',
  'cho toi noi chuyen voi cskh',
  'cho toi chat voi con nguoi',
  'cho toi chat voi nguoi that',
  'cho toi gap nguoi that',
  'ket noi toi voi cskh',
  'ket noi toi voi nhan vien',
  'ket noi toi voi nguoi that',
  'chuyen toi sang cskh',
  'chuyen toi sang nhan vien',
  'chuyen toi qua cskh',
  'chuyen toi qua nhan vien',
  'nho nhan vien ho tro',
  'nho cskh ho tro',
  'nhan vien ho tro giup toi',
  'cskh ho tro giup toi',
  'customer support',
  'customer service',
  'human agent',
  'live agent',
  'real person',
];

const HUMAN_SUPPORT_TARGETS = [
  'cham soc khach hang',
  'cskh',
  'nhan vien',
  'nhan vien ho tro',
  'nhan vien tu van',
  'tu van vien',
  'bo phan ho tro',
  'bo phan cskh',
  'tong dai',
  'support',
  'customer support',
  'customer service',
  'human agent',
  'live agent',
  'agent',
  'staff',
  'con nguoi',
  'nguoi that',
  'nguoi thuc',
  'nguoi ho tro',
  'nguoi tu van',
];

const HUMAN_SUPPORT_REQUEST_WORDS = [
  'muon',
  'can',
  'xin',
  'cho',
  'nho',
  'hay',
  'please',
  'duoc khong',
  'giup',
];

const HUMAN_SUPPORT_ACTIONS = [
  'gap',
  'chat',
  'noi chuyen',
  'tro chuyen',
  'lien he',
  'ket noi',
  'noi may',
  'chuyen',
  'goi',
  'goi lai',
  'tu van',
  'ho tro',
];

const HUMAN_SUPPORT_REGEXES = [
  /\b(cho toi|cho minh|cho em|cho anh|cho chi)\b.{0,40}\b(gap|chat|noi chuyen|tro chuyen|lien he|ket noi|noi may|chuyen)\b.{0,40}\b(cham soc khach hang|cskh|nhan vien|tu van vien|bo phan ho tro|tong dai|support|customer support|customer service|con nguoi|nguoi that)\b/u,
  /\b(muon|can|xin|nho|please)\b.{0,30}\b(gap|chat|noi chuyen|tro chuyen|lien he|ket noi|noi may|chuyen|goi|goi lai|tu van|ho tro)\b.{0,40}\b(cham soc khach hang|cskh|nhan vien|tu van vien|bo phan ho tro|tong dai|support|customer support|customer service|human agent|live agent|con nguoi|nguoi that)\b/u,
  /\b(chuyen|ket noi|noi may|goi|goi lai)\b.{0,30}\b(toi|minh|em|anh|chi)?\b.{0,20}\b(voi|qua|sang)?\b.{0,20}\b(cham soc khach hang|cskh|nhan vien|tu van vien|tong dai|support|customer support|customer service|human agent|live agent)\b/u,
  /\b(can|muon|xin)\b.{0,20}\b(nguoi that|con nguoi)\b.{0,20}\b(ho tro|tu van|chat|noi chuyen)\b/u,
];

@Injectable()
export class SafetyPolicyService {
  evaluate(message: string, contextCount: number): SafetyDecision {
    const normalized = this.normalize(message);

    if (this.isHumanSupportRequested(normalized)) {
      return {
        answer:
          'Mình sẽ chuyển cuộc trò chuyện này tới bộ phận chăm sóc khách hàng ngay bây giờ. Vui lòng chờ trong giây lát để nhân viên kết nối vào cuộc chat.',
        confidence: 1,
        shouldHandoff: true,
        handoffReason: 'human_support_requested',
        sourceIds: [],
      };
    }

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
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isHumanSupportRequested(normalized: string): boolean {
    if (
      HUMAN_SUPPORT_DIRECT_PHRASES.some((phrase) =>
        normalized.includes(phrase),
      )
    ) {
      return true;
    }

    if (HUMAN_SUPPORT_REGEXES.some((pattern) => pattern.test(normalized))) {
      return true;
    }

    const hasTarget = HUMAN_SUPPORT_TARGETS.some((target) =>
      normalized.includes(target),
    );
    if (!hasTarget) {
      return false;
    }

    const hasRequestWord = HUMAN_SUPPORT_REQUEST_WORDS.some((requestWord) =>
      normalized.includes(requestWord),
    );
    const hasAction = HUMAN_SUPPORT_ACTIONS.some((action) =>
      normalized.includes(action),
    );

    return hasRequestWord && hasAction;
  }
}
