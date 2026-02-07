# Twilio SMS Integration - Setup Guide

## ✅ Đã tích hợp Twilio SDK

Dự án đã được tích hợp với Twilio để gửi SMS OTP. Twilio là SMS provider phổ biến nhất, được Firebase và nhiều nền tảng lớn sử dụng.

---

## 🔧 Setup Twilio

### Bước 1: Tạo tài khoản Twilio

1. Truy cập: https://www.twilio.com/try-twilio
2. Đăng ký tài khoản miễn phí (Free Trial)
3. Xác thực số điện thoại của bạn

### Bước 2: Lấy credentials

1. Đăng nhập vào [Twilio Console](https://console.twilio.com/)
2. Trên Dashboard, copy:
   - **Account SID** (ví dụ: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (click "Show" để xem)

### Bước 3: Mua số điện thoại Twilio

1. Vào **Phone Numbers** → **Buy a Number**
2. Chọn quốc gia (ví dụ: United States)
3. Tìm số có khả năng **SMS**
4. Mua số (Free trial có $15 credit)
5. Copy số điện thoại (ví dụ: `+15017122661`)

### Bước 4: Cấu hình .env

Thêm vào file `.env`:

```env
# Twilio SMS (for OTP)
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15017122661
```

### Bước 5: Kiểm tra

Restart server:
```bash
npm run start:dev
```

Test endpoint:
```bash
POST http://localhost:3000/api/v1/auth/request-otp
{
  "phone": "0901234567"
}
```

---

## 💰 Giá cước Twilio

| Loại | Giá |
|------|-----|
| SMS gửi đi (Outbound) | ~$0.0075/SMS (US) |
| SMS gửi đi (Vietnam) | ~$0.0492/SMS |
| Free Trial Credit | $15 (~ 300 SMS) |

---

## 🌏 Gửi SMS tới Việt Nam

Twilio hỗ trợ gửi SMS quốc tế, bao gồm Việt Nam (+84).

**Lưu ý:**
- Số điện thoại phải có định dạng quốc tế: `+84901234567`
- Code đã tự động chuyển `0901234567` → `+84901234567`
- Giá SMS tới VN cao hơn US (~$0.05/SMS)

---

## 🧪 Development Mode

Nếu chưa setup Twilio (`TWILIO_ENABLED=false`), SMS sẽ được log ra console:

```
[SmsService] [DEV MODE] SMS to 090***4567: [IntelliRentOps] Ma xac thuc OTP...
[SmsService] [DEV] Full SMS Content: [IntelliRentOps] Ma xac thuc OTP cua ban la: 123456...
```

---

## 🔐 Bảo mật

- **KHÔNG** commit `.env` lên Git
- Dùng `.env.example` làm template
- Twilio Auth Token cần được bảo mật tuyệt đối
- Giới hạn IP whitelist nếu có thể

---

## 🚀 Production Setup

### Khuyến nghị:

1. **Nâng cấp tài khoản** Twilio (vượt free trial)
2. **Verify số gửi**: Verify phone number trên Twilio
3. **Enable Geo Permissions**: 
   - Vào Settings → Geo Permissions
   - Enable Vietnam để gửi SMS tới VN
4. **Monitor usage**: Theo dõi số lượng SMS đã gửi
5. **Set up billing alerts**: Cảnh báo khi gần hết credit

---

## 🔄 Alternatives (nếu cần)

Nếu không muốn dùng Twilio, có thể thay bằng:

| Provider | Ưu điểm | Link |
|----------|---------|------|
| **SpeedSMS** | Giá rẻ, phù hợp VN | speedsms.vn |
| **eSMS** | Nhiều tính năng | esms.vn |
| **Vonage (Nexmo)** | Toàn cầu | vonage.com |
| **AWS SNS** | Tích hợp AWS | aws.amazon.com/sns |

Để thay đổi provider, chỉ cần sửa method `sendSmsDirectly()` trong [sms.service.ts](../src/modules/sms/sms.service.ts).

---

## 📞 Support

- Twilio Docs: https://www.twilio.com/docs/sms
- Twilio Support: https://support.twilio.com/

---

**Tạo bởi:** IntelliRentOps Team  
**Ngày:** 2026-02-07
