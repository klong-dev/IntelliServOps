import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

export interface FptAiResponse {
  errorCode: number;
  errorMessage: string;
  data: FptAiIdCardData[];
}

export interface FptAiIdCardData {
  id?: string;
  id_prob?: string;
  name?: string;
  name_prob?: string;
  dob?: string;
  dob_prob?: string;
  sex?: string;
  sex_prob?: string;
  nationality?: string;
  nationality_prob?: string;
  home?: string;
  home_prob?: string;
  address?: string;
  address_prob?: string;
  address_entities?: {
    province?: string;
    district?: string;
    ward?: string;
    street?: string;
  };
  doe?: string;
  doe_prob?: string;
  type?: string;
  type_new?: string;
  // Back side
  religion?: string;
  religion_prob?: string;
  ethnicity?: string;
  ethnicity_prob?: string;
  features?: string;
  features_prob?: string;
  issue_date?: string;
  issue_date_prob?: string;
  issue_loc?: string;
  issue_loc_prob?: string;
}

@Injectable()
export class FptAiService {
  private readonly logger = new Logger(FptAiService.name);
  private axios: AxiosInstance;
  private apiKey: string;
  private apiUrl: string;
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('fptAi.apiKey') || '';
    this.apiUrl =
      this.configService.get<string>('fptAi.apiUrl') ||
      'https://api.fpt.ai/vision/idr/vnm/';
    this.enabled = this.configService.get<boolean>('fptAi.enabled') ?? true;

    // Initialize axios instance with headers
    this.axios = axios.create({
      headers: {
        'api-key': this.apiKey,
      },
      timeout: 30000,
    });
  }

  /**
   * Verify ID card from image URL
   * @param imageUrl URL of the ID card image
   * @returns FPT AI API response with extracted data
   */
  async verifyIdCardFromUrl(imageUrl: string): Promise<FptAiResponse> {
    if (!this.enabled || !this.apiKey) {
      this.logger.warn('FPT AI is disabled or API key not configured');
      return {
        errorCode: 0,
        errorMessage: '',
        data: [],
      };
    }

    try {
      const formData = new FormData();
      formData.append('image_url', imageUrl);

      const response = await this.axios.post<FptAiResponse>(this.apiUrl, formData, {
        headers: formData.getHeaders(),
      });

      return response.data;
    } catch (error) {
      this.logger.error('FPT AI Error:', error.message);
      throw new BadRequestException(
        `FPT AI verification failed: ${error.response?.data?.errorMessage || error.message}`,
      );
    }
  }

  /**
   * Verify ID card from base64 encoded image
   * @param base64Data Base64 encoded image data (without data URI prefix)
   * @returns FPT AI API response with extracted data
   */
  async verifyIdCardFromBase64(base64Data: string): Promise<FptAiResponse> {
    if (!this.enabled || !this.apiKey) {
      this.logger.warn('FPT AI is disabled or API key not configured');
      return {
        errorCode: 0,
        errorMessage: '',
        data: [],
      };
    }

    try {
      const formData = new FormData();
      formData.append('image_base64', base64Data);

      const response = await this.axios.post<FptAiResponse>(this.apiUrl, formData, {
        headers: formData.getHeaders(),
      });

      return response.data;
    } catch (error) {
      this.logger.error('FPT AI Base64 Error:', error.message);
      throw new BadRequestException(
        `FPT AI verification failed: ${error.response?.data?.errorMessage || error.message}`,
      );
    }
  }

  /**
   * Verify ID card from image file
   * @param filePath Path to the ID card image file
   * @returns FPT AI API response with extracted data
   */
  async verifyIdCardFromFile(filePath: string): Promise<FptAiResponse> {
    if (!this.enabled || !this.apiKey) {
      this.logger.warn('FPT AI is disabled or API key not configured');
      return {
        errorCode: 0,
        errorMessage: '',
        data: [],
      };
    }

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const formData = new FormData();
      formData.append('image', fs.createReadStream(filePath));

      const response = await this.axios.post<FptAiResponse>(this.apiUrl, formData, {
        headers: formData.getHeaders(),
      });

      return response.data;
    } catch (error) {
      this.logger.error('FPT AI File Error:', error.message);
      throw new BadRequestException(
        `FPT AI verification failed: ${error.response?.data?.errorMessage || error.message}`,
      );
    }
  }

  /**
   * Check if verification was successful
   * @param response FPT AI API response
   * @returns true if no errors and data exists
   */
  isVerificationSuccessful(response: FptAiResponse | null | undefined): boolean {
    if (!response || !Array.isArray(response.data) || response.data.length === 0) {
      return false;
    }

    const isErrorFree = response.errorCode === 0;
    const hasId = !!response.data[0].id && response.data[0].id !== 'N/A';

    return isErrorFree && hasId;
  }

  /**
   * Extract ID number from verification response
   * @param response FPT AI API response
   * @returns ID number or null
   */
  extractIdNumber(response: FptAiResponse | null | undefined): string | null {
    if (response && response.data && response.data.length > 0 && response.data[0].id) {
      return response.data[0].id !== 'N/A' ? response.data[0].id : null;
    }
    return null;
  }

  /**
   * Extract user info from verification response
   * @param response FPT AI API response
   * @returns Object containing extracted user info for database
   */
  extractUserInfo(
    response: FptAiResponse | null | undefined,
  ): {
    id?: string;
    name?: string;
    dob?: string;
    sex?: string;
    nationality?: string;
    home?: string;
    address?: string;
    province?: string;
    district?: string;
    ward?: string;
    street?: string;
    type?: string;
  } | null {
    if (!this.isVerificationSuccessful(response)) {
      return null;
    }

    const data = response!.data[0];
    const result: any = {};

    // Only add fields that have valid values (not "N/A")
    if (data.id && data.id !== 'N/A') {
      result.id = data.id;
    }

    if (data.name && data.name !== 'N/A') {
      result.name = data.name;
    }

    if (data.dob && data.dob !== 'N/A') {
      result.dob = data.dob;
    }

    if (data.sex && data.sex !== 'N/A') {
      result.sex = data.sex;
    }

    if (data.nationality && data.nationality !== 'N/A') {
      result.nationality = data.nationality;
    }

    if (data.home && data.home !== 'N/A') {
      result.home = data.home;
    }

    if (data.address && data.address !== 'N/A') {
      result.address = data.address;
    }

    // Extract address entities
    if (data.address_entities) {
      if (data.address_entities.province) {
        result.province = data.address_entities.province;
      }
      if (data.address_entities.district) {
        result.district = data.address_entities.district;
      }
      if (data.address_entities.ward) {
        result.ward = data.address_entities.ward;
      }
      if (data.address_entities.street) {
        result.street = data.address_entities.street;
      }
    }

    result.type = data.type;

    return Object.keys(result).length > 1 ? result : null;
  }

  /**
   * Get error message from FPT AI error code
   * @param errorCode Error code from FPT AI
   * @returns Human-readable error message in Vietnamese
   */
  getErrorMessage(errorCode: number): string {
    const errorMessages: Record<number, string> = {
      0: 'Không có lỗi',
      1: 'Thông số request không hợp lệ',
      2: 'CMND/CCCD bị thiếu góc, không thể xác nhận',
      3: 'Không tìm thấy CMND/CCCD trong ảnh hoặc chất lượng ảnh kém',
      5: 'URL ảnh không có trong request',
      6: 'Không thể mở được URL ảnh',
      7: 'File gửi lên không phải là file ảnh',
      8: 'File ảnh bị hỏng hoặc định dạng không được hỗ trợ',
      9: 'Base64 string không có trong request',
      10: 'Base64 string không hợp lệ',
    };

    return errorMessages[errorCode] || 'Lỗi không xác định';
  }
}
