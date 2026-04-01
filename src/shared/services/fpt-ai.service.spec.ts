import { ConfigService } from '@nestjs/config';
import { FptAiService, type FptAiResponse } from './fpt-ai.service';

describe('FptAiService', () => {
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'fptAi.apiKey') return 'test-key';
      if (key === 'fptAi.apiUrl') return 'https://api.example.com';
      if (key === 'fptAi.enabled') return true;
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: FptAiService;

  beforeEach(() => {
    service = new FptAiService(mockConfigService);
  });

  it('should verify back side even when id is missing', () => {
    const backOnlyResponse: FptAiResponse = {
      errorCode: 0,
      errorMessage: '',
      data: [
        {
          id: 'N/A',
          issue_date: '01/01/2020',
          features: 'Seo roi mau toc den',
        },
      ],
    };

    expect(
      service.isVerificationSuccessfulForSide(backOnlyResponse, 'back'),
    ).toBe(true);
  });

  it('should fail front side when id is missing', () => {
    const frontWithoutIdResponse: FptAiResponse = {
      errorCode: 0,
      errorMessage: '',
      data: [
        {
          id: 'N/A',
          name: 'Nguyen Van A',
          dob: '01/01/1990',
        },
      ],
    };

    expect(
      service.isVerificationSuccessfulForSide(frontWithoutIdResponse, 'front'),
    ).toBe(false);
  });

  it('should extract back side info when id is missing', () => {
    const backOnlyResponse: FptAiResponse = {
      errorCode: 0,
      errorMessage: '',
      data: [
        {
          id: 'N/A',
          issue_date: '01/01/2020',
          features: 'Seo roi mau toc den',
        },
      ],
    };

    const extracted = service.extractUserInfo(backOnlyResponse);

    expect(extracted).toMatchObject({
      issueDate: '01/01/2020',
      features: 'Seo roi mau toc den',
    });
  });
});
