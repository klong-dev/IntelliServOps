import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as path from 'path';
import * as fs from 'fs';

export interface ContractPdfData {
  contractNumber: string;
  // Bên cho thuê (Landlord / Party A)
  landlordName?: string;
  landlordIdNumber?: string;
  landlordIdIssueDate?: string;
  landlordIdIssuePlace?: string;
  landlordAddress?: string;
  landlordPhone?: string;
  // Bên thuê (Tenant / Party B)
  tenantName?: string;
  tenantIdNumber?: string;
  tenantIdIssueDate?: string;
  tenantIdIssuePlace?: string;
  tenantAddress?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantMembers?: ContractPdfMemberData[];
  // Apartment
  apartmentAddress?: string;
  apartmentNumber?: string;
  apartmentArea?: string;
  apartmentUsableArea?: string;
  apartmentBedrooms?: number;
  apartmentBathrooms?: number;
  apartmentCity?: string;
  apartmentDistrict?: string;
  // Contract terms
  startDate?: string;
  endDate?: string;
  monthlyRent?: string;
  depositAmount?: string;
  paymentDueDay?: number;
  paymentMethod?: string;
  specialConditions?: string;
  contractTerms?: string;
  // Signatures (null = blank)
  landlordSignature?: Buffer | null;
  tenantSignature?: Buffer | null;
}

export interface ContractPdfMemberData {
  fullName?: string;
  idNumber?: string;
  idIssueDate?: string;
  address?: string;
  phone?: string;
  email?: string;
  memberType?: string;
}

export interface PartnerCooperationPdfData {
  contractNumber: string;
  partyAName?: string;
  partyATaxCode?: string;
  partyAAddress?: string;
  partyAPhone?: string;
  partyARepresentative?: string;
  partyASignature?: Buffer | null;
  partnerName: string;
  partnerCompanyName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  partnerSignature?: Buffer | null;
  apartmentNumber?: string;
  apartmentAddress?: string;
  cooperationStartDate: string;
  cooperationEndDate: string;
  monthlyRevenueCommissionRate: string;
  notes?: string;
}

@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);
  private fontPath: string;
  private fontBoldPath: string;
  private fontItalicPath: string;
  private fontsAvailable = false;

  constructor() {
    // Try multiple paths to find fonts
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'assets', 'fonts'), // dist/modules/contracts -> dist/assets/fonts
      path.join(__dirname, '..', '..', '..', 'assets', 'fonts'), // extra level up
      path.join(process.cwd(), 'dist', 'assets', 'fonts'), // from project root
      path.join(process.cwd(), 'src', 'assets', 'fonts'), // src folder (dev)
    ];

    let assetsDir = '';
    for (const p of possiblePaths) {
      const testFont = path.join(p, 'Roboto-Regular.ttf');
      this.logger.debug(`Checking font path: ${testFont}`);
      if (fs.existsSync(testFont)) {
        assetsDir = p;
        this.logger.log(`Found fonts at: ${assetsDir}`);
        break;
      }
    }

    if (assetsDir) {
      this.fontPath = path.join(assetsDir, 'Roboto-Regular.ttf');
      this.fontBoldPath = path.join(assetsDir, 'Roboto-Bold.ttf');
      this.fontItalicPath = path.join(assetsDir, 'Roboto-Italic.ttf');

      if (
        fs.existsSync(this.fontPath) &&
        fs.existsSync(this.fontBoldPath) &&
        fs.existsSync(this.fontItalicPath)
      ) {
        this.fontsAvailable = true;
        this.logger.log('Vietnamese fonts loaded successfully');
      }
    }

    if (!this.fontsAvailable) {
      this.logger.warn(
        'Vietnamese fonts not found. Tried paths: ' +
          possiblePaths.join(', ') +
          '. PDF will use fallback fonts (Vietnamese may not render correctly).',
      );
    }
  }

  private getVietnameseWeekday(date: Date): string {
    const weekdays = [
      'Chủ nhật',
      'Thứ hai',
      'Thứ ba',
      'Thứ tư',
      'Thứ năm',
      'Thứ sáu',
      'Thứ bảy',
    ];
    return weekdays[date.getDay()] || 'Thứ hai';
  }

  async generateContractPdf(data: ContractPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register fonts
      if (this.fontsAvailable) {
        doc.registerFont('Regular', this.fontPath);
        doc.registerFont('Bold', this.fontBoldPath);
        doc.registerFont('Italic', this.fontItalicPath);
      } else {
        doc.registerFont('Regular', 'Helvetica');
        doc.registerFont('Bold', 'Helvetica-Bold');
        doc.registerFont('Italic', 'Helvetica-Oblique');
      }

      this.renderHeader(doc);
      this.renderParties(doc, data);
      this.renderArticle1(doc, data);
      this.renderArticle2(doc, data);
      this.renderArticle3(doc, data);
      this.renderArticle4(doc, data);
      this.renderArticle5(doc);
      this.renderArticle6(doc);
      this.renderArticle7(doc);
      this.renderAdditionalTerms(doc, data);
      this.renderSignatures(doc, data);

      doc.end();
    });
  }

  async generatePartnerCooperationPdf(
    data: PartnerCooperationPdfData,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (this.fontsAvailable) {
        doc.registerFont('Regular', this.fontPath);
        doc.registerFont('Bold', this.fontBoldPath);
        doc.registerFont('Italic', this.fontItalicPath);
      } else {
        doc.registerFont('Regular', 'Helvetica');
        doc.registerFont('Bold', 'Helvetica-Bold');
        doc.registerFont('Italic', 'Helvetica-Oblique');
      }

      doc
        .font('Bold')
        .fontSize(13)
        .text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc
        .font('Bold')
        .fontSize(12)
        .text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc
        .moveTo(doc.page.width / 2 - 80, doc.y)
        .lineTo(doc.page.width / 2 + 80, doc.y)
        .stroke();

      doc.moveDown(0.8);
      doc
        .font('Bold')
        .fontSize(16)
        .text('HỢP ĐỒNG HỢP TÁC KHAI THÁC CĂN HỘ', { align: 'center' });
      doc.moveDown(0.2);
      doc
        .font('Regular')
        .fontSize(11)
        .text(`Số hợp đồng: ${data.contractNumber}`, { align: 'center' });

      doc.moveDown(1);
      doc.font('Bold').fontSize(12).text('1. THÔNG TIN CÁC BÊN');
      doc.moveDown(0.3);
      doc
        .font('Regular')
        .fontSize(11)
        .text(
          `Bên A (Đơn vị khai thác): ${data.partyAName || 'Công ty TNHH IntelliServOps'}`,
        )
        .text(`Mã số thuế: ${data.partyATaxCode || 'Chưa cập nhật'}`)
        .text(`Địa chỉ: ${data.partyAAddress || 'TP. Hồ Chí Minh, Việt Nam'}`)
        .text(`Điện thoại: ${data.partyAPhone || '1900 0000'}`)
        .text(
          `Đại diện: ${data.partyARepresentative || 'Đại diện theo ủy quyền'}`,
        );

      doc.moveDown(0.4);
      doc
        .font('Regular')
        .fontSize(11)
        .text(`Bên B (Partner): ${data.partnerName}`)
        .text(`Công ty: ${data.partnerCompanyName || 'N/A'}`)
        .text(`Điện thoại: ${data.partnerPhone || 'N/A'}`)
        .text(`Email: ${data.partnerEmail || 'N/A'}`);

      doc.moveDown(0.8);
      doc.font('Bold').fontSize(12).text('2. NỘI DUNG HỢP TÁC');
      doc.moveDown(0.3);
      doc
        .font('Regular')
        .fontSize(11)
        .text(`Căn hộ hợp tác: ${data.apartmentNumber || 'N/A'}`)
        .text(`Địa chỉ căn hộ: ${data.apartmentAddress || 'N/A'}`)
        .text(
          `Thời hạn hợp tác: từ ${data.cooperationStartDate} đến ${data.cooperationEndDate}`,
        )
        .text(
          `Tỷ lệ hoa hồng trên doanh thu mỗi tháng: ${data.monthlyRevenueCommissionRate}%`,
        );

      if (data.notes) {
        doc.moveDown(0.3);
        doc.text(`Điều khoản bổ sung: ${data.notes}`);
      }

      doc.moveDown(1);
      doc.font('Bold').fontSize(12).text('3. XÁC NHẬN VÀ HIỆU LỰC');
      doc.moveDown(0.3);
      doc
        .font('Regular')
        .fontSize(11)
        .text(
          'Hợp đồng có hiệu lực kể từ ngày được các bên ký xác nhận và được lưu trữ trên hệ thống IntelliServOps.',
        )
        .text(
          'Doanh thu hằng tháng được đối soát định kỳ, hoa hồng được tính theo tỷ lệ đã thỏa thuận ở trên.',
        );

      doc.moveDown(1.5);
      const currentY = doc.y;
      const colWidth =
        (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;

      doc
        .font('Bold')
        .fontSize(11)
        .text('ĐẠI DIỆN BÊN A', doc.page.margins.left, currentY, {
          width: colWidth,
          align: 'center',
        })
        .font('Regular')
        .fontSize(10)
        .text('(Ký, ghi rõ họ tên)', doc.page.margins.left, currentY + 18, {
          width: colWidth,
          align: 'center',
        });

      doc
        .font('Bold')
        .fontSize(11)
        .text(
          'ĐẠI DIỆN BÊN B (PARTNER)',
          doc.page.margins.left + colWidth,
          currentY,
          {
            width: colWidth,
            align: 'center',
          },
        )
        .font('Regular')
        .fontSize(10)
        .text(
          '(Ký, ghi rõ họ tên)',
          doc.page.margins.left + colWidth,
          currentY + 18,
          {
            width: colWidth,
            align: 'center',
          },
        );

      const signatureY = currentY + 45;
      if (data.partyASignature) {
        doc.image(
          data.partyASignature,
          doc.page.margins.left + colWidth / 2 - 50,
          signatureY,
          {
            width: 100,
            height: 60,
          },
        );
      } else {
        doc
          .font('Italic')
          .fontSize(10)
          .text('Đã ký điện tử', doc.page.margins.left, signatureY + 18, {
            width: colWidth,
            align: 'center',
          })
          .text(
            data.partyAName || 'Công ty TNHH IntelliServOps',
            doc.page.margins.left,
            signatureY + 32,
            {
              width: colWidth,
              align: 'center',
            },
          );
      }

      if (data.partnerSignature) {
        doc.image(
          data.partnerSignature,
          doc.page.margins.left + colWidth + colWidth / 2 - 50,
          signatureY,
          {
            width: 100,
            height: 60,
          },
        );
      }

      const nameY = signatureY + 70;
      doc
        .font('Regular')
        .fontSize(11)
        .text(
          data.partyARepresentative ||
            data.partyAName ||
            'Công ty TNHH IntelliServOps',
          doc.page.margins.left,
          nameY,
          {
            width: colWidth,
            align: 'center',
          },
        )
        .text(data.partnerName || '', doc.page.margins.left + colWidth, nameY, {
          width: colWidth,
          align: 'center',
        });

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument) {
    doc
      .font('Bold')
      .fontSize(13)
      .text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });

    doc
      .font('Bold')
      .fontSize(12)
      .text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });

    doc
      .moveTo(doc.page.width / 2 - 80, doc.y)
      .lineTo(doc.page.width / 2 + 80, doc.y)
      .stroke();

    doc.moveDown(0.5);

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const weekday = this.getVietnameseWeekday(today);

    doc
      .font('Italic')
      .fontSize(11)
      .text(
        `TP. Hồ Chí Minh, ${weekday}, ngày ${day} tháng ${month} năm ${year}`,
        {
          align: 'right',
        },
      );

    doc.moveDown(0.5);

    doc
      .font('Bold')
      .fontSize(16)
      .text('HỢP ĐỒNG THUÊ NHÀ', { align: 'center' });

    doc.moveDown(0.5);

    doc.font('Italic').fontSize(10);
    doc.text('- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;');
    doc.text(
      '- Căn cứ vào Luật Thương mại số 36/2005/QH11 ngày 14 tháng 06 năm 2005;',
    );
    doc.text(
      '- Căn cứ vào nhu cầu và sự thỏa thuận của các bên tham gia Hợp đồng;',
    );

    doc.moveDown(0.5);

    doc
      .font('Regular')
      .fontSize(11)
      .text(
        `Hôm nay, ${weekday}, ngày ${day} tháng ${month} năm ${year}, các Bên gồm:`,
      );

    doc.moveDown(0.5);
  }

  private renderParties(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    // Party A - Landlord
    doc.font('Bold').fontSize(12).text('BÊN CHO THUÊ (Bên A):');
    doc.moveDown(0.3);

    doc.font('Regular').fontSize(11);
    doc.text(
      `Ông/Bà: ${data.landlordName || '.........................................'}`,
    );
    doc.text(
      `CMND/CCCD số: ${data.landlordIdNumber || '....................'}` +
        `     Ngày cấp: ${data.landlordIdIssueDate || '....................'}`,
    );
    doc.text(
      `Địa chỉ kinh doanh: ${data.landlordAddress || '................................'}`,
    );
    doc.text(
      `Điện thoại: ${data.landlordPhone || '........................................'}`,
    );

    doc.moveDown(0.5);

    // Party B - Tenant
    doc.font('Bold').fontSize(12).text('BÊN THUÊ (Bên B):');
    doc.moveDown(0.3);

    doc.font('Regular').fontSize(11);
    doc.text(
      `Ông/Bà: ${data.tenantName || '.........................................'}`,
    );
    doc.text(
      `CMND/CCCD số: ${data.tenantIdNumber || '....................'}` +
        `     Ngày cấp: ${data.tenantIdIssueDate || '....................'}`,
    );
    doc.text(
      `Nơi cấp: ${data.tenantIdIssuePlace || '.........................................'}`,
    );
    doc.text(
      `Nơi ĐKTT: ${data.tenantAddress || '........................................'}`,
    );
    doc.text(
      `Điện thoại: ${data.tenantPhone || '........................................'}`,
    );
    doc.text(
      `Email: ${data.tenantEmail || '........................................'}`,
    );

    if (data.tenantMembers && data.tenantMembers.length > 0) {
      doc.moveDown(0.3);
      doc
        .font('Bold')
        .fontSize(11)
        .text('Danh sach thanh vien ben B (kem CCCD):');
      doc.moveDown(0.2);

      data.tenantMembers.forEach((member, index) => {
        doc
          .font('Regular')
          .fontSize(10)
          .text(
            `${index + 1}. ${member.fullName || 'N/A'} - CCCD: ${member.idNumber || 'N/A'}`,
          );
      });
    }

    doc.moveDown(0.5);

    doc
      .font('Regular')
      .fontSize(11)
      .text('Bên A và Bên B sau đây gọi chung là ', { continued: true })
      .font('Bold')
      .text('"Hai Bên"', { continued: true })
      .font('Regular')
      .text(' hoặc ', { continued: true })
      .font('Bold')
      .text('"Các Bên".');

    doc.moveDown(0.3);
    doc
      .font('Regular')
      .fontSize(11)
      .text(
        'Sau khi thảo luận, Hai Bên thống nhất đi đến ký kết Hợp đồng thuê nhà ("Hợp Đồng") với các điều khoản và điều kiện dưới đây:',
      );

    doc.moveDown(0.5);
  }

  private renderArticle1(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    doc
      .font('Bold')
      .fontSize(12)
      .text('Điều 1. Nhà ở và các tài sản cho thuê kèm theo nhà ở:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    const fullAddress = [
      data.apartmentNumber ? `Căn hộ ${data.apartmentNumber}` : null,
      data.apartmentAddress,
      data.apartmentDistrict,
      data.apartmentCity,
    ]
      .filter(Boolean)
      .join(', ');

    doc.text(
      `1.1. Bên A đồng ý cho Bên B thuê và Bên B cũng đồng ý thuê quyền sử dụng đất và một căn nhà tại địa chỉ: ${fullAddress || '...........................'}  để sử dụng làm nơi để ở.`,
    );

    doc.moveDown(0.2);
    doc.text(
      `     Diện tích quyền sử dụng đất: ${data.apartmentArea || '...........'} m²;`,
    );
    doc.text(
      `     Diện tích sử dụng: ${data.apartmentUsableArea || '...........'} m²;`,
    );
    doc.text(
      `     Số phòng ngủ: ${data.apartmentBedrooms ?? '...'};     Số phòng tắm: ${data.apartmentBathrooms ?? '...'}`,
    );

    doc.moveDown(0.3);
    doc.text(
      '1.2. Bên A cam kết quyền sử dụng đất và căn nhà gắn liền trên đất trên là tài sản sở hữu hợp pháp của Bên A. Mọi tranh chấp phát sinh từ tài sản cho thuê trên Bên A hoàn toàn chịu trách nhiệm trước pháp luật.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle2(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    doc.font('Bold').fontSize(12).text('Điều 2. Thời hạn thuê:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text(
      `2.1. Thời hạn thuê là từ ngày ${data.startDate || '..../..../........'} đến ngày ${data.endDate || '..../..../........'}.`,
    );

    doc.moveDown(0.2);
    doc.text(
      '2.2. Hết thời hạn thuê nêu trên, nếu Bên B có nhu cầu tiếp tục thuê thì phải thông báo cho Bên A biết trước ít nhất 30 ngày. Bên A sẽ ưu tiên cho Bên B tiếp tục thuê.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle3(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    doc
      .font('Bold')
      .fontSize(12)
      .text('Điều 3. Giá thuê và phương thức thanh toán:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text(
      `3.1. Giá thuê nhà hàng tháng: ${data.monthlyRent || '...........'} VNĐ/tháng.`,
    );

    doc.moveDown(0.2);
    doc.text(`3.2. Tiền đặt cọc: ${data.depositAmount || '...........'} VNĐ.`);

    doc.moveDown(0.2);

    const paymentMethodMap: Record<string, string> = {
      bank_transfer: 'Chuyển khoản ngân hàng',
      cash: 'Tiền mặt',
      e_wallet: 'Ví điện tử',
      auto_debit: 'Trích nợ tự động',
      credit_card: 'Thẻ tín dụng',
      debit_card: 'Thẻ ghi nợ',
    };

    doc.text(
      `3.3. Phương thức thanh toán: ${paymentMethodMap[data.paymentMethod || ''] || data.paymentMethod || '.....................'}.`,
    );

    doc.moveDown(0.2);
    doc.text(
      `3.4. Ngày thanh toán hàng tháng: Ngày ${data.paymentDueDay || '...'} hàng tháng.`,
    );

    doc.moveDown(0.2);
    doc.text(
      '3.5. Trong thời gian thuê nhà, nếu Bên B không trả tiền thuê nhà liên tiếp trong 02 tháng trở lên mà không có lý do chính đáng thì Bên A có quyền đơn phương chấm dứt Hợp đồng.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle4(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    doc.font('Bold').fontSize(12).text('Điều 4. Nghĩa vụ và quyền của Bên A:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text(
      '4.1. Giao nhà ở và các tài sản gắn liền với nhà cho Bên B đúng thời hạn và đúng hiện trạng như đã thỏa thuận.',
    );
    doc.text(
      '4.2. Bảo đảm quyền sử dụng nhà ổn định cho Bên B trong thời hạn thuê.',
    );
    doc.text(
      '4.3. Bảo trì, sửa chữa nhà theo định kỳ hoặc theo thỏa thuận; nếu Bên A không bảo trì, sửa chữa nhà mà gây thiệt hại cho Bên B, thì phải bồi thường.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle5(doc: PDFKit.PDFDocument) {
    // Check if we need a new page
    if (doc.y > doc.page.height - 250) {
      doc.addPage();
    }

    doc.font('Bold').fontSize(12).text('Điều 5. Nghĩa vụ và quyền của Bên B:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text(
      '5.1. Sử dụng nhà đúng mục đích đã thỏa thuận, giữ gìn nhà ở và có trách nhiệm sửa chữa những hư hỏng do mình gây ra.',
    );
    doc.text('5.2. Trả tiền thuê nhà đầy đủ, đúng hạn đã thỏa thuận.');
    doc.text(
      '5.3. Trả tiền điện, nước, dịch vụ và các chi phí khác theo thỏa thuận.',
    );
    doc.text(
      '5.4. Trả nhà cho Bên A khi hết hạn hợp đồng thuê hoặc chấm dứt hợp đồng thuê.',
    );
    doc.text(
      '5.5. Không được cho người khác thuê lại nếu không có sự đồng ý bằng văn bản của Bên A.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle6(doc: PDFKit.PDFDocument) {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    doc.font('Bold').fontSize(12).text('Điều 6. Chấm dứt hợp đồng:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text('Hợp đồng thuê nhà sẽ chấm dứt trong các trường hợp sau:');
    doc.text('  a) Hết thời hạn thuê mà không có thỏa thuận gia hạn;');
    doc.text('  b) Hai bên thỏa thuận chấm dứt hợp đồng;');
    doc.text(
      '  c) Nhà cho thuê bị phá dỡ, bị tiêu huỷ theo quy định của pháp luật;',
    );
    doc.text(
      '  d) Bên thuê chết mà không có ai cùng chung sống tiếp tục thuê;',
    );
    doc.text(
      '  e) Một trong hai bên đơn phương chấm dứt hợp đồng theo quy định tại Điều 3.5 hoặc theo quy định pháp luật.',
    );

    doc.moveDown(0.5);
  }

  private renderArticle7(doc: PDFKit.PDFDocument) {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    doc.font('Bold').fontSize(12).text('Điều 7. Điều khoản chung:');

    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    doc.text(
      '7.1. Hai bên cam kết thực hiện đúng và đầy đủ các điều khoản đã ghi trong Hợp đồng. Trong quá trình thực hiện nếu có vấn đề phát sinh, hai bên sẽ cùng nhau bàn bạc giải quyết trên tinh thần hợp tác và thiện chí.',
    );

    doc.moveDown(0.2);
    doc.text(
      '7.2. Trường hợp hai bên không tự giải quyết được thì đưa ra Tòa án nhân dân có thẩm quyền để giải quyết.',
    );

    doc.moveDown(0.2);
    doc.text(
      '7.3. Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.',
    );

    doc.moveDown(1);
  }

  private renderAdditionalTerms(
    doc: PDFKit.PDFDocument,
    data: ContractPdfData,
  ) {
    const additionalSections = [
      data.specialConditions
        ? `Điều kiện đặc biệt: ${data.specialConditions}`
        : null,
      data.contractTerms ? `Điều khoản bổ sung: ${data.contractTerms}` : null,
    ].filter((value): value is string => !!value);

    if (!additionalSections.length) {
      return;
    }

    if (doc.y > doc.page.height - 240) {
      doc.addPage();
    }

    doc.font('Bold').fontSize(12).text('Điều 8. Điều khoản bổ sung:');
    doc.moveDown(0.3);
    doc.font('Regular').fontSize(11);

    additionalSections.forEach((content, index) => {
      doc.text(`8.${index + 1}. ${content}`);
      doc.moveDown(0.2);
    });

    doc.moveDown(0.6);
  }

  private renderSignatures(doc: PDFKit.PDFDocument, data: ContractPdfData) {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / 2;
    const leftX = doc.page.margins.left;
    const rightX = doc.page.margins.left + colWidth;
    const startY = doc.y;

    // Party A header
    doc.font('Bold').fontSize(12);
    doc.text('BÊN CHO THUÊ', leftX, startY, {
      width: colWidth,
      align: 'center',
    });

    // Party B header
    doc.text('BÊN THUÊ', rightX, startY, {
      width: colWidth,
      align: 'center',
    });

    const afterHeaderY = doc.y + 5;

    // Sub-text
    doc.font('Italic').fontSize(10);
    doc.text('(Ký và ghi rõ họ tên)', leftX, afterHeaderY, {
      width: colWidth,
      align: 'center',
    });
    doc.text('(Ký và ghi rõ họ tên)', rightX, afterHeaderY, {
      width: colWidth,
      align: 'center',
    });

    const signatureY = afterHeaderY + 25;

    // Render signatures if available, otherwise leave blank space
    if (data.landlordSignature) {
      doc.image(data.landlordSignature, leftX + colWidth / 2 - 50, signatureY, {
        width: 100,
        height: 60,
      });
    } else {
      doc
        .font('Italic')
        .fontSize(10)
        .text('Đã ký điện tử', leftX, signatureY + 18, {
          width: colWidth,
          align: 'center',
        })
        .text(data.landlordName || 'Bên A', leftX, signatureY + 32, {
          width: colWidth,
          align: 'center',
        });
    }

    if (data.tenantSignature) {
      doc.image(data.tenantSignature, rightX + colWidth / 2 - 50, signatureY, {
        width: 100,
        height: 60,
      });
    }

    // Names below signature area
    const nameY = signatureY + 70;

    doc.font('Regular').fontSize(11);
    doc.text(data.landlordName || '', leftX, nameY, {
      width: colWidth,
      align: 'center',
    });
    doc.text(data.tenantName || '', rightX, nameY, {
      width: colWidth,
      align: 'center',
    });
  }
}
