import { ContractPdfService } from './contract-pdf.service';

class FakePdfDocument {
  texts: string[] = [];
  images: Array<{ source: Buffer; x: number; y: number }> = [];
  y = 100;
  page = {
    width: 595,
    height: 842,
    margins: {
      top: 50,
      bottom: 50,
      left: 60,
      right: 60,
    },
  };

  font() {
    return this;
  }

  fontSize() {
    return this;
  }

  text(value: string) {
    this.texts.push(value);
    this.y += 12;
    return this;
  }

  moveDown(lines = 1) {
    this.y += 12 * lines;
    return this;
  }

  addPage() {
    this.y = this.page.margins.top;
    return this;
  }

  image(source: Buffer, x: number, y: number) {
    this.images.push({ source, x, y });
    return this;
  }

  moveTo() {
    return this;
  }

  lineTo() {
    return this;
  }

  stroke() {
    return this;
  }
}

describe('ContractPdfService', () => {
  let service: ContractPdfService;

  beforeEach(() => {
    service = new ContractPdfService();
  });

  describe('renderParties', () => {
    it('should render Party A business address and omit Party A issue place line', () => {
      const doc = new FakePdfDocument();

      (service as any).renderParties(doc as any, {
        contractNumber: 'CTR-2026-00001',
        landlordName: 'Hoàng Kim Long',
        landlordIdNumber: '060204000351',
        landlordIdIssueDate: '19/04/2021',
        landlordIdIssuePlace: 'This value should not appear',
        landlordAddress:
          'Chung cư Vinhomes Grand Park, phường Long Bình, TP Thủ Đức',
        landlordPhone: '0388969964',
        tenantName: 'Nguyễn Văn A',
      });

      const partyALines = doc.texts.slice(0, 5);

      expect(partyALines).toContain(
        'Địa chỉ kinh doanh: Chung cư Vinhomes Grand Park, phường Long Bình, TP Thủ Đức',
      );
      expect(partyALines.some((line) => line.startsWith('Nơi cấp:'))).toBe(
        false,
      );
    });
  });

  describe('renderAdditionalTerms', () => {
    it('should render special conditions and contract terms when provided', () => {
      const doc = new FakePdfDocument();

      (service as any).renderAdditionalTerms(doc as any, {
        contractNumber: 'CTR-2026-00001',
        specialConditions: 'Không hút thuốc trong căn hộ.',
        contractTerms: 'Thông báo trước 30 ngày nếu kết thúc sớm.',
      });

      expect(doc.texts).toContain('Điều 8. Điều khoản bổ sung:');
      expect(doc.texts).toContain(
        '8.1. Điều kiện đặc biệt: Không hút thuốc trong căn hộ.',
      );
      expect(doc.texts).toContain(
        '8.2. Điều khoản bổ sung: Thông báo trước 30 ngày nếu kết thúc sớm.',
      );
    });
  });

  describe('renderSignatures', () => {
    it('should use landlord name instead of IntelliServOps in fallback signature text', () => {
      const doc = new FakePdfDocument();

      (service as any).renderSignatures(doc as any, {
        contractNumber: 'CTR-2026-00001',
        landlordName: 'Hoàng Kim Long',
        tenantName: 'Nguyễn Văn A',
        landlordSignature: null,
        tenantSignature: null,
      });

      expect(doc.texts).toContain('Đã ký điện tử');
      expect(doc.texts).toContain('Hoàng Kim Long');
      expect(doc.texts).not.toContain('IntelliServOps');
    });
  });
});
