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
    it('should render Party A business address, omit issue place lines, and use accented Party B members heading', () => {
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
        tenantIdIssuePlace: 'TP. Hồ Chí Minh',
        tenantMembers: [
          {
            fullName: 'Nguyễn Văn A',
            idNumber: '079203001234',
          },
        ],
      });

      expect(doc.texts).toContain(
        'Địa chỉ kinh doanh: Chung cư Vinhomes Grand Park, phường Long Bình, TP Thủ Đức',
      );
      expect(doc.texts.some((line) => line.startsWith('Nơi cấp:'))).toBe(false);
      expect(doc.texts).toContain('Danh sách thành viên bên B (kèm CCCD):');
    });
  });

  describe('renderHeader', () => {
    it('should not prefix the opening clause with "Hôm nay"', () => {
      const doc = new FakePdfDocument();

      (service as any).renderHeader(doc as any);

      expect(doc.texts.some((line) => line.includes('Hôm nay,'))).toBe(false);
      expect(
        doc.texts.some((line) =>
          /ngày \d+ tháng \d+ năm \d+, các Bên gồm:/.test(line),
        ),
      ).toBe(true);
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
    it('should render Party A signature image when landlord signature exists', () => {
      const doc = new FakePdfDocument();
      const landlordSignature = Buffer.from('landlord-signature');

      (service as any).renderSignatures(doc as any, {
        contractNumber: 'CTR-2026-00001',
        landlordName: 'Hoàng Kim Long',
        tenantName: 'Nguyễn Văn A',
        landlordSignature,
        tenantSignature: null,
      });

      expect(doc.images).toContainEqual(
        expect.objectContaining({ source: landlordSignature }),
      );
      expect(doc.texts).not.toContain('Đã ký điện tử');
    });

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
