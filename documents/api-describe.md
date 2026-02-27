# IntelliRentOps — Mô Tả API & Module

> Tài liệu mô tả toàn bộ API, module và cách sử dụng theo từng flow nghiệp vụ.
> Tổng cộng: **17 module**, **107 endpoints**.
> Base URL: `/api/v1` — Swagger UI: `/docs`

---

## Mục Lục

- [I. Flow Tìm Và Liên Hệ Thuê Nhà (Guest)](#i-flow-tìm-và-liên-hệ-thuê-nhà-guest)
- [II. Flow Đăng Ký & Đăng Nhập](#ii-flow-đăng-ký--đăng-nhập)
- [III. Flow Quản Lý Hợp Đồng Thuê](#iii-flow-quản-lý-hợp-đồng-thuê)
- [IV. Flow Hóa Đơn & Thanh Toán](#iv-flow-hóa-đơn--thanh-toán)
- [V. Flow Bảo Trì (Maintenance)](#v-flow-bảo-trì-maintenance)
- [VI. Flow Hỗ Trợ (Tickets)](#vi-flow-hỗ-trợ-tickets)
- [VII. Flow Quản Lý Công Việc Nội Bộ (Tasks)](#vii-flow-quản-lý-công-việc-nội-bộ-tasks)
- [VIII. Flow Ghi Chú Khách Hàng (Staff Notes)](#viii-flow-ghi-chú-khách-hàng-staff-notes)
- [IX. Flow Đối Tác / Chủ Nhà (Partners)](#ix-flow-đối-tác--chủ-nhà-partners)
- [X. Flow IoT & Tiện Ích](#x-flow-iot--tiện-ích)
- [XI. Flow Thông Báo (Notifications)](#xi-flow-thông-báo-notifications)
- [XII. Flow Chính Sách & Pháp Lý (Policies)](#xii-flow-chính-sách--pháp-lý-policies)
- [XIII. Nhật Ký Hoạt Động (Activity Logs)](#xiii-nhật-ký-hoạt-động-activity-logs)
- [XIV. Quản Lý Người Dùng (Users)](#xiv-quản-lý-người-dùng-users)
- [XV. Sơ Đồ Liên Kết Giữa Các Module](#xv-sơ-đồ-liên-kết-giữa-các-module)
- [XVI. Tổng Hợp API Theo Role](#xvi-tổng-hợp-api-theo-role)

---

## I. Flow Tìm Và Liên Hệ Thuê Nhà (Guest)

**Mục đích:** Khách vãng lai (Guest) tìm kiếm căn hộ trên website, xem chi tiết, rồi để lại thông tin liên hệ để Staff liên hệ tư vấn và đặt lịch xem nhà.

**Module liên quan:** `Apartments`, `ViewingRequests`

### Luồng hoạt động

```
Guest truy cập website
  → Tìm kiếm căn hộ (GET /apartments/search)
  → Xem chi tiết 1 căn hộ (GET /apartments/:id)
  → Để lại thông tin liên hệ (POST /viewing-requests)
  → Hệ thống tự động gán Staff gần nhất
  → Staff nhận thông báo, gọi điện xác nhận
  → Staff tạo lịch hẹn xem nhà (POST /viewing-requests/:id/appointments)
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/apartments/search` | Public | Tìm kiếm căn hộ theo bộ lọc (địa chỉ, giá, loại, nội thất...) — có phân trang |
| 2 | `GET` | `/apartments/:id` | Public | Xem chi tiết 1 căn hộ (thông tin, ảnh, phòng, tiện ích) |
| 3 | `POST` | `/viewing-requests` | Public | Guest để lại thông tin: `fullName`, `email`, `phone`, `apartmentId`, `preferredMoveInDate`, `message`, `numberOfOccupants` |
| 4 | `GET` | `/viewing-requests/my-assigned` | Staff, Operator, Admin | Staff xem danh sách yêu cầu xem nhà được gán cho mình |
| 5 | `POST` | `/viewing-requests/:contactRequestId/appointments` | Staff, Operator, Admin | Staff tạo lịch hẹn: `appointmentDate`, `appointmentTime`, `durationMinutes`, `meetingLocation`, `staffNotes` |
| 6 | `GET` | `/viewing-requests/apartments/:apartmentId/appointments?date=YYYY-MM-DD` | Staff, Operator, Admin | Xem lịch hẹn của căn hộ theo ngày (để check slot trống) |

### Logic đặc biệt
- **Auto-assign Staff:** Hệ thống tìm Staff theo `workingDistrict` → `workingCity` → Staff bất kỳ
- **Slot limit:** Mỗi căn hộ có `maxConcurrentViewings` — nếu vượt quá sẽ từ chối (409)

---

## II. Flow Đăng Ký & Đăng Nhập

**Mục đích:** Xử lý xác thực cho tất cả các role. Hỗ trợ đăng ký bằng email/password, đăng nhập bằng email hoặc số điện thoại (đa role, 1 tài khoản nhiều role), đăng nhập qua Google, quên/đổi mật khẩu.

**Module liên quan:** `Auth`

### Luồng đăng ký

```
Guest
  → POST /auth/register (email, phone?, fullName, password)
  → phone chấp nhận bắt đầu bằng 0 hoặc +84 (VD: 0901234567 hoặc +84901234567)
  → Hệ thống kiểm tra trùng email + phone (cả 2 format 0xx và +84xx)
  → Tạo User với role mặc định = "user"
  → Trả về accessToken + refreshToken
```

### Luồng đăng nhập (đa role)

```
User/Staff/Admin/...
  → POST /auth/login (identifier, password, actorType?)
  → identifier có thể là email HOẶC số điện thoại (bắt đầu bằng 0 hoặc +84)
  → Hệ thống detect: có '@' → tìm theo email, không có → tìm theo phone
  → Khi tìm theo phone, hệ thống tự động tìm cả 2 format (0xx ↔ +84xx)
  → Kiểm tra tồn tại ở bảng nào (User, Staff, Operator, Admin, Partner)
  → Trả về: accessToken, refreshToken, userInfo, availableRoles: ["user", "staff", ...]
  → Nếu không chỉ định actorType:
      + Nếu có role "user" → dùng "user" làm mặc định
      + Nếu KHÔNG có role "user" → dùng role đầu tiên trong availableRoles
        Ví dụ: availableRoles = ["staff", "operator"] → tự động login với role "staff"
  → Nếu chỉ định actorType không nằm trong availableRoles → lỗi 401
```

### Luồng Google OAuth

```
User
  → Đăng nhập Google trên frontend (Supabase OAuth)
  → Frontend nhận accessToken từ Supabase
  → POST /auth/google { accessToken }
  → Backend verify token với Supabase REST API
  → Tạo hoặc liên kết tài khoản → Trả tokens
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `POST` | `/auth/register` | Public | Đăng ký tài khoản mới: `email`, `phone?` (0xx hoặc +84xx), `fullName`, `password` (min 8 ký tự) |
| 2 | `POST` | `/auth/login` | Public | Đăng nhập: `identifier` (email hoặc phone), `password`, `actorType?` — trả `availableRoles[]` |
| 3 | `POST` | `/auth/google` | Public | Đăng nhập Google: `accessToken` (từ Supabase) |
| 4 | `POST` | `/auth/refresh` | Public | Làm mới token: `refreshToken` → trả accessToken + refreshToken mới |
| 5 | `POST` | `/auth/logout` | Public | Đăng xuất: revoke `refreshToken` |
| 6 | `POST` | `/auth/forgot-password` | Public | Quên mật khẩu: gửi `email` → tạo reset token |
| 7 | `POST` | `/auth/reset-password` | Public | Đặt lại mật khẩu: `token` + `newPassword` |
| 8 | `POST` | `/auth/change-password` | Bearer (bất kỳ) | Đổi mật khẩu: `currentPassword` + `newPassword` → revoke tất cả token cũ |

### Cơ chế đa role
- 1 email/phone có thể tồn tại ở nhiều bảng: User, Staff, Operator, Admin, Partner
- Khi login, hệ thống trả `availableRoles` cho FE biết user có những role nào
- User chọn `actorType` để đăng nhập với role cụ thể → token chứa `role` + `actorType`
- Khi đăng nhập bằng phone, hệ thống tự động tìm cả 2 format (0xx và +84xx)

---

## III. Flow Quản Lý Hợp Đồng Thuê

**Mục đích:** Sau khi Guest xem nhà và đồng ý thuê, Operator/Staff tạo hợp đồng → kích hoạt → quản lý → chấm dứt.

**Module liên quan:** `Contracts` ← liên kết → `Apartments`, `Users`

### Luồng hoạt động

```
Sau khi Guest đồng ý thuê
  → Staff/Operator tạo hợp đồng (POST /contracts) — trạng thái: DRAFT
  → Ký kết → Operator kích hoạt (PATCH /contracts/:id/activate) — trạng thái: ACTIVE
  → Căn hộ chuyển sang trạng thái "occupied"
  → Hết hạn/Chấm dứt (PATCH /contracts/:id/terminate) — apartment → "available"
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/contracts` | Bearer | Danh sách hợp đồng — User: chỉ thấy của mình, Staff/Operator/Admin: thấy tất cả. Filter `status?` |
| 2 | `GET` | `/contracts/:id` | Bearer | Chi tiết hợp đồng + thành viên + căn hộ |
| 3 | `POST` | `/contracts` | Staff, Operator, Admin | Tạo hợp đồng: `apartmentId`, `userId`, `startDate`, `endDate`, `monthlyRent`, `deposit`... |
| 4 | `PATCH` | `/contracts/:id` | Staff, Operator, Admin | Cập nhật thông tin hợp đồng |
| 5 | `PATCH` | `/contracts/:id/activate` | Operator, Admin | Kích hoạt hợp đồng (DRAFT/PENDING → ACTIVE) |
| 6 | `PATCH` | `/contracts/:id/terminate` | Operator, Admin | Chấm dứt hợp đồng: `reason`, `terminationFee?` |

### Liên kết
- **Apartments:** Hợp đồng gắn với `apartmentId` → khi activate, apartment trạng thái thay đổi
- **Users:** `UserContractMember` — 1 hợp đồng có thể gồm nhiều thành viên
- **Invoices:** Từ hợp đồng active → hệ thống sinh hóa đơn hàng tháng

---

## IV. Flow Hóa Đơn & Thanh Toán

**Mục đích:** Tạo hóa đơn hàng tháng cho người thuê, người thuê thanh toán qua PayOS. Sau khi thanh toán → hóa đơn được đánh dấu đã trả.

**Module liên quan:** `Invoices` ← liên kết → `Contracts` ; `Payments` ← liên kết → `Invoices`

### Luồng hoạt động

```
Hợp đồng ACTIVE
  → Staff/Hệ thống tạo hóa đơn (POST /invoices) — trạng thái: DRAFT → ISSUED → SENT
  → User xem hóa đơn (GET /invoices)
  → User tạo thanh toán (POST /payments) — hệ thống tạo link PayOS
  → User thanh toán qua PayOS
  → PayOS gọi webhook (POST /payments/webhook/payos)
  → Hệ thống xác nhận → Invoice = PAID
```

### Invoices API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/invoices` | Bearer | Danh sách hóa đơn — User: của mình, Staff+: tất cả. Filter `status?` |
| 2 | `GET` | `/invoices/:id` | Bearer | Chi tiết hóa đơn + hợp đồng liên quan |
| 3 | `POST` | `/invoices` | Staff, Operator, Admin | Tạo hóa đơn: `contractId`, `amount`, `dueDate`, `description`... |
| 4 | `PATCH` | `/invoices/:id` | Staff, Operator, Admin | Cập nhật hóa đơn |

### Payments API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/payments` | Bearer | Danh sách thanh toán. Filter `status?` |
| 2 | `GET` | `/payments/:id` | Bearer | Chi tiết thanh toán |
| 3 | `POST` | `/payments` | Bearer (cả User) | Tạo thanh toán cho hóa đơn → nhận link PayOS |
| 4 | `POST` | `/payments/:id/confirm` | Staff, Operator, Admin | Xác nhận thanh toán thủ công (nếu cần) |
| 5 | `POST` | `/payments/webhook/payos` | Bearer* | PayOS webhook callback — tự động cập nhật trạng thái |

### Liên kết
- **Contracts → Invoices:** Hóa đơn được tạo dựa trên `contractId`
- **Invoices → Payments:** Thanh toán gắn với `invoiceId`
- **PayOS:** Tích hợp cổng thanh toán, cấu hình qua `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`

---

## V. Flow Bảo Trì (Maintenance)

**Mục đích:** User báo lỗi thiết bị/hạ tầng trong căn hộ → Staff nhận và xử lý → hoàn thành.

**Module liên quan:** `Maintenance` ← liên kết → `Apartments`, `Contracts`, `Tasks`

### Luồng hoạt động

```
User phát hiện vấn đề (điều hòa hỏng, ống nước rò...)
  → POST /maintenance (mô tả, ảnh, mức ưu tiên)
  → Staff nhận yêu cầu (GET /maintenance)
  → Staff cập nhật tiến độ (PATCH /maintenance/:id)
  → Staff hoàn thành (PATCH /maintenance/:id/complete) + ghi chú chi phí
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/maintenance` | Bearer | Danh sách yêu cầu bảo trì — User: của mình, Staff+: tất cả. Filter `status?` |
| 2 | `GET` | `/maintenance/:id` | Bearer | Chi tiết yêu cầu bảo trì |
| 3 | `POST` | `/maintenance` | Bearer (cả User) | Tạo yêu cầu: `apartmentId`, `description`, `priority`, `images`... |
| 4 | `PATCH` | `/maintenance/:id` | Staff, Operator, Admin | Cập nhật trạng thái/thông tin |
| 5 | `PATCH` | `/maintenance/:id/complete` | Staff, Operator, Admin | Đánh dấu hoàn thành: `resolutionNotes`, `cost?` |

### Liên kết
- **Apartments:** Yêu cầu bảo trì gắn với căn hộ cụ thể
- **Contracts:** Kiểm tra user có hợp đồng active với căn hộ không
- **Tasks:** Có thể tạo Task nội bộ từ yêu cầu bảo trì để phân công Staff

---

## VI. Flow Hỗ Trợ (Tickets)

**Mục đích:** User tạo ticket hỗ trợ cho các vấn đề tổng quát (hóa đơn, hợp đồng, khiếu nại...). Staff xử lý và giải quyết.

**Module liên quan:** `Tickets` ← liên kết → `Users`, `Contracts`

### Luồng hoạt động

```
User gặp vấn đề
  → POST /tickets (category, subject, description)
  → Operator gán ticket cho Staff (PATCH /tickets/:id/assign)
  → Staff xử lý → giải quyết (PATCH /tickets/:id/resolve)
  → User xác nhận → đóng ticket (PATCH /tickets/:id/close)
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/tickets` | Bearer | Danh sách tickets. Filter `status?` |
| 2 | `GET` | `/tickets/:id` | Bearer | Chi tiết ticket |
| 3 | `POST` | `/tickets` | Bearer (cả User) | Tạo ticket: `category` (billing/contract/account/complaint/inquiry/documentation), `subject`, `description` |
| 4 | `PATCH` | `/tickets/:id` | Staff, Operator, Admin | Cập nhật ticket |
| 5 | `PATCH` | `/tickets/:id/assign` | Operator, Admin | Gán ticket cho Staff: `{ staffId }` |
| 6 | `PATCH` | `/tickets/:id/resolve` | Staff, Operator, Admin | Đánh dấu đã giải quyết: `{ resolutionNotes }` |
| 7 | `PATCH` | `/tickets/:id/close` | Bearer (cả User) | Đóng ticket |

### Loại ticket (category)
| Category | Mô tả |
|----------|-------|
| `billing` | Vấn đề hóa đơn, thanh toán |
| `contract` | Vấn đề hợp đồng |
| `account` | Vấn đề tài khoản |
| `complaint` | Khiếu nại |
| `inquiry` | Hỏi thông tin |
| `documentation` | Yêu cầu giấy tờ |

---

## VII. Flow Quản Lý Công Việc Nội Bộ (Tasks)

**Mục đích:** Operator/Admin tạo và phân công công việc cho Staff. Dùng để quản lý nội bộ: kiểm tra căn hộ, bảo trì định kỳ, chuẩn bị phòng...

**Module liên quan:** `Tasks` ← liên kết → `Apartments`, `Maintenance`

### Luồng hoạt động

```
Operator/Admin tạo task (POST /tasks)
  → Phân công cho Staff (PATCH /tasks/:id/assign)
  → Staff bắt đầu làm (PATCH /tasks/:id/start)
  → Hoàn thành (PATCH /tasks/:id/complete) + ghi chú
  → Hoặc hủy nếu không cần (PATCH /tasks/:id/cancel)
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/tasks` | Staff, Operator, Admin | Danh sách task — Staff: của mình, Admin/Operator: tất cả. Filter `status?` |
| 2 | `GET` | `/tasks/:id` | Staff, Operator, Admin | Chi tiết task |
| 3 | `POST` | `/tasks` | Operator, Admin | Tạo task: `title`, `description`, `priority`, `dueDate`, `apartmentId?` |
| 4 | `PATCH` | `/tasks/:id` | Staff, Operator, Admin | Cập nhật task |
| 5 | `PATCH` | `/tasks/:id/assign` | Operator, Admin | Phân công: `{ staffId }` |
| 6 | `PATCH` | `/tasks/:id/start` | Staff, Operator, Admin | Bắt đầu thực hiện task |
| 7 | `PATCH` | `/tasks/:id/complete` | Staff, Operator, Admin | Hoàn thành: `{ completionNotes }` |
| 8 | `PATCH` | `/tasks/:id/cancel` | Operator, Admin | Hủy task |

### Liên kết
- **Apartments:** Task có thể gắn với `apartmentId` (ví dụ: kiểm tra căn hộ A)
- **Maintenance:** Từ yêu cầu bảo trì có thể tạo task để giao cho Staff

---

## VIII. Flow Ghi Chú Khách Hàng (Staff Notes)

**Mục đích:** Staff ghi chú về tương tác / cuộc gọi / trao đổi với khách hàng. Các Staff khác có thể xem để nắm lịch sử khách hàng.

**Module liên quan:** `StaffNotes` ← liên kết → `Users`

### Luồng hoạt động

```
Staff gọi điện / chat với khách
  → Ghi chú lại nội dung (POST /staff-notes)
  → Staff khác xem ghi chú của khách hàng (GET /staff-notes/user/:userId)
  → Cập nhật nếu cần (PATCH /staff-notes/:id) — chỉ người tạo
  → Xóa (DELETE /staff-notes/:id) — người tạo hoặc Admin
```

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `POST` | `/staff-notes` | Staff, Operator, Admin | Tạo ghi chú: `userId` (khách hàng), `content` (1-5000 ký tự) |
| 2 | `GET` | `/staff-notes/user/:userId` | Staff, Operator, Admin | Xem ghi chú của 1 khách hàng — phân trang `page?`, `limit?` |
| 3 | `GET` | `/staff-notes/:id` | Staff, Operator, Admin | Xem chi tiết 1 ghi chú (kèm thông tin staff + user) |
| 4 | `PATCH` | `/staff-notes/:id` | Staff, Operator, Admin | Sửa ghi chú — chỉ người tạo mới được sửa |
| 5 | `DELETE` | `/staff-notes/:id` | Staff, Operator, Admin | Xóa ghi chú — người tạo hoặc Admin |

### Liên kết
- **Users:** Ghi chú về 1 `userId` cụ thể (khách hàng)
- **Staff:** Ghi chú được tạo bởi 1 `staffId`

---

## IX. Flow Đối Tác / Chủ Nhà (Partners)

**Mục đích:** Chủ nhà (Partner) đăng ký đối tác, gửi yêu cầu, được duyệt → đăng căn hộ cho thuê → Operator duyệt căn hộ.

**Module liên quan:** `Partners` ← liên kết → `Apartments`

### Luồng hoạt động

```
Chủ nhà đăng ký tài khoản Partner
  → Gửi yêu cầu đối tác (POST /partners/requests)
  → Operator duyệt (PATCH /partners/requests/:id/review)
  → Partner đăng căn hộ (POST /apartments)
  → Operator duyệt căn hộ (PATCH /apartments/:id/approve)
  → Căn hộ xuất hiện trên web cho Guest tìm kiếm
```

### Partners API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/partners` | Operator, Admin | Danh sách tất cả đối tác. Filter `isActive?` |
| 2 | `GET` | `/partners/profile` | Partner | Xem profile đối tác của mình |
| 3 | `GET` | `/partners/:id` | Operator, Admin | Xem chi tiết 1 đối tác |

### Partner Requests API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 4 | `GET` | `/partners/requests/all` | Operator, Admin | Tất cả yêu cầu đối tác |
| 5 | `GET` | `/partners/requests/my` | Partner | Yêu cầu đối tác của mình |
| 6 | `GET` | `/partners/requests/:id` | Partner, Operator, Admin | Chi tiết yêu cầu |
| 7 | `POST` | `/partners/requests` | Partner | Gửi yêu cầu đối tác mới |
| 8 | `PATCH` | `/partners/requests/:id` | Partner | Cập nhật yêu cầu (chỉ người tạo) |
| 9 | `PATCH` | `/partners/requests/:id/review` | Operator, Admin | Duyệt/Từ chối: `status` (approved/rejected), `reviewNotes` |

### Apartments API (cho Partner)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 10 | `POST` | `/apartments` | Partner, Operator, Admin | Đăng căn hộ mới |
| 11 | `PATCH` | `/apartments/:id` | Partner, Operator, Admin | Cập nhật thông tin căn hộ |
| 12 | `GET` | `/apartments/partner/:partnerId` | Partner, Operator, Admin | Xem danh sách căn hộ của 1 partner |
| 13 | `PATCH` | `/apartments/:id/approve` | Operator, Admin | Duyệt đăng căn hộ |
| 14 | `DELETE` | `/apartments/:id` | Admin | Xóa căn hộ (soft-delete) |

### Liên kết
- **Apartments:** Partner sở hữu nhiều căn hộ (`Partner.id` = `Apartment.partnerId`)
- **Viewing Requests:** Căn hộ đã duyệt → Guest có thể tìm thấy và đăng ký xem

---

## X. Flow IoT & Tiện Ích

**Mục đích:** Quản lý thiết bị IoT (camera, khóa thông minh...) và đồng hồ tiện ích (điện, nước) trong căn hộ. Ghi nhận chỉ số, điều khiển thiết bị.

**Module liên quan:** `IoT` ← liên kết → `Apartments`, `Contracts`

### IoT Devices API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/iot/devices` | Staff, Operator, Admin | Danh sách thiết bị. Filter `apartmentId?`, `status?` |
| 2 | `GET` | `/iot/devices/:id` | Staff, Operator, Admin | Chi tiết thiết bị |
| 3 | `GET` | `/iot/apartments/:apartmentId/devices` | Bearer (cả User) | Thiết bị theo căn hộ — User chỉ thấy thiết bị được phép |
| 4 | `POST` | `/iot/devices` | Staff, Operator, Admin | Đăng ký thiết bị mới: `type`, `tuyaDeviceId`, `apartmentId`, `roomId?`... |
| 5 | `PATCH` | `/iot/devices/:id` | Staff, Operator, Admin | Cập nhật thiết bị |
| 6 | `DELETE` | `/iot/devices/:id` | Admin | Vô hiệu hóa thiết bị |
| 7 | `POST` | `/iot/devices/:id/control` | Bearer (cả User) | Điều khiển thiết bị: `command`, `params` — User cần có hợp đồng active |

### Utility Meters API (Đồng hồ tiện ích)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 8 | `GET` | `/iot/meters` | Staff, Operator, Admin | Danh sách đồng hồ. Filter `apartmentId?`, `status?` |
| 9 | `GET` | `/iot/meters/:id` | Staff, Operator, Admin | Chi tiết đồng hồ + lịch sử đọc chỉ số |
| 10 | `POST` | `/iot/meters` | Staff, Operator, Admin | Đăng ký đồng hồ mới: `meterType` (ELECTRICITY/WATER/GAS), `apartmentId`... |
| 11 | `PATCH` | `/iot/meters/:id` | Staff, Operator, Admin | Cập nhật đồng hồ |

### Utility Readings API (Chỉ số tiện ích)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 12 | `POST` | `/iot/readings` | Staff, Operator, Admin | Ghi chỉ số: `meterId`, `readingValue`, `readingDate`, `evidence?` |
| 13 | `GET` | `/iot/meters/:meterId/readings` | Bearer (cả User) | Lịch sử đọc chỉ số. Query `limit?` |
| 14 | `PATCH` | `/iot/readings/:id/verify` | Staff, Operator, Admin | Xác nhận chỉ số đã ghi |

### Liên kết
- **Apartments:** Thiết bị + đồng hồ gắn với `apartmentId` (và `roomId` nếu có)
- **Contracts:** User điều khiển thiết bị phải có hợp đồng active với căn hộ đó
- **Invoices:** Chỉ số tiện ích → tính toán chi phí → đưa vào hóa đơn
- **Tuya Platform:** Tích hợp thiết bị Tuya IoT — cấu hình qua `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`

---

## XI. Flow Thông Báo (Notifications)

**Mục đích:** Quản lý thông báo hệ thống gửi cho người dùng (hóa đơn, bảo trì, lịch hẹn...).

**Module liên quan:** `Notifications` — module độc lập, được các module khác sử dụng thông qua service

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/notifications/my` | Bearer (tất cả role) | Thông báo của tôi. Filter `isRead?` |
| 2 | `GET` | `/notifications/unread-count` | Bearer (tất cả role) | Đếm số thông báo chưa đọc |
| 3 | `POST` | `/notifications` | Operator, Admin | Gửi thông báo: `recipientId`, `recipientType`, `title`, `message`, `type` |
| 4 | `PATCH` | `/notifications/:id/read` | Bearer (tất cả role) | Đánh dấu đã đọc 1 thông báo |
| 5 | `PATCH` | `/notifications/read-all` | Bearer (tất cả role) | Đánh dấu đã đọc tất cả |

### Liên kết
- Module Notifications được gọi nội bộ bởi các flow khác:
  - **Viewing Requests:** Thông báo cho Staff khi có Guest mới
  - **Invoices:** Thông báo cho User khi có hóa đơn mới
  - **Maintenance:** Thông báo tiến độ bảo trì
  - **Tickets:** Thông báo cập nhật ticket

---

## XII. Flow Chính Sách & Pháp Lý (Policies)

**Mục đích:** Quản lý chính sách cho thuê, quy chế chung cư, và các tài liệu pháp lý (hợp đồng mẫu, giấy phép...).

**Module liên quan:** `Policies` — module độc lập

### Policies API

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/policies` | Bearer (tất cả role) | Danh sách chính sách. Filter `type?`, `isActive?` |
| 2 | `GET` | `/policies/public` | Public | Chính sách công khai (không cần login) |
| 3 | `GET` | `/policies/:id` | Bearer (tất cả role) | Chi tiết chính sách |
| 4 | `POST` | `/policies` | Admin | Tạo chính sách mới |
| 5 | `PATCH` | `/policies/:id` | Admin | Cập nhật chính sách |
| 6 | `PATCH` | `/policies/:id/approve` | Admin | Duyệt chính sách |

### Legal Documents API (Tài liệu pháp lý)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 7 | `GET` | `/policies/legal-documents/all` | Bearer (tất cả role) | Danh sách tài liệu pháp lý. Filter `documentType?`, `isPublic?` |
| 8 | `GET` | `/policies/legal-documents/public` | Public | Tài liệu pháp lý công khai |
| 9 | `GET` | `/policies/legal-documents/:id` | Bearer (tất cả role) | Chi tiết tài liệu |
| 10 | `POST` | `/policies/legal-documents` | Admin | Upload tài liệu pháp lý |
| 11 | `PATCH` | `/policies/legal-documents/:id` | Admin | Cập nhật tài liệu |

---

## XIII. Nhật Ký Hoạt Động (Activity Logs)

**Mục đích:** Ghi lại mọi hành động quan trọng trong hệ thống để kiểm soát và audit.

**Module liên quan:** `ActivityLogs` — module độc lập

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/activity-logs` | Operator, Admin | Xem nhật ký. Filter: `actorType?`, `actorId?`, `entityType?`, `entityId?`, `action?`, `startDate?`, `endDate?` |

### Liên kết
- Module này ghi nhận hành động từ **tất cả module khác** (login, CRUD hợp đồng, thanh toán...)
- Dữ liệu: `actorType`, `actorId`, `action`, `entityType`, `entityId`, `metadata`, `ipAddress`

---

## XIV. Quản Lý Người Dùng (Users)

**Mục đích:** Admin/Operator quản lý tài khoản người dùng, xem profile.

**Module liên quan:** `Users` ← liên kết → `Auth`

### API chi tiết

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | `GET` | `/users` | Operator, Admin | Danh sách người dùng. Query `search?` (tìm theo tên/email) |
| 2 | `GET` | `/users/profile` | Bearer (tất cả role) | Xem profile của mình |
| 3 | `GET` | `/users/:id` | Bearer | Xem profile người dùng theo ID |
| 4 | `POST` | `/users` | Staff, Operator, Admin | Tạo tài khoản người dùng (bởi nhân viên) |
| 5 | `PATCH` | `/users/:id` | User, Operator, Admin | Cập nhật thông tin. User chỉ sửa được của mình |
| 6 | `DELETE` | `/users/:id` | Admin | Soft-delete tài khoản |

---

## XV. Sơ Đồ Liên Kết Giữa Các Module

### Mối quan hệ chính

```
┌─────────────┐     sở hữu      ┌──────────────┐     tìm thấy     ┌──────────────┐
│   Partners   │ ──────────────→ │  Apartments  │ ←──────────────── │    Guest     │
│  (Chủ nhà)   │                 │  (Căn hộ)    │                   │ (Khách vãng  │
└─────────────┘                  └──────┬───────┘                   │    lai)      │
                                        │                           └──────┬───────┘
                                        │ có nhiều                         │
                                        ▼                                  │ gửi yêu cầu
                                 ┌──────────────┐                  ┌──────▼───────┐
                                 │    Rooms     │                  │   Viewing    │
                                 │   (Phòng)    │                  │  Requests    │
                                 └──────────────┘                  └──────┬───────┘
                                        │                                  │
                    ┌───────────────────┼──────────────────┐               │ Staff tạo
                    │                   │                  │               ▼
                    ▼                   ▼                  ▼        ┌──────────────┐
             ┌────────────┐    ┌──────────────┐   ┌────────────┐   │ Appointments │
             │ IoT Devices│    │Utility Meters│   │ Contracts  │   └──────────────┘
             │(Thiết bị)  │    │   (Đồng hồ)  │   │(Hợp đồng) │
             └────────────┘    └──────┬───────┘   └──────┬─────┘
                                      │                  │
                                      ▼                  ├──────────────────┐
                               ┌──────────────┐          │                  │
                               │   Readings   │          ▼                  ▼
                               │  (Chỉ số)    │   ┌────────────┐   ┌──────────────┐
                               └──────────────┘   │  Invoices  │   │ Maintenance  │
                                                  │ (Hóa đơn)  │   │  (Bảo trì)   │
                                                  └──────┬─────┘   └──────────────┘
                                                         │
                                                         ▼
                                                  ┌────────────┐
                                                  │  Payments  │
                                                  │(Thanh toán)│
                                                  └────────────┘
```

### Module hỗ trợ chéo (Cross-cutting)

```
┌──────────────────────────────────────────────────────────┐
│                    Tất cả Module                         │
│  Auth ← Users ← Contracts ← Invoices ← Payments        │
│  Apartments ← IoT ← Maintenance ← Tickets ← Tasks      │
│  Partners ← ViewingRequests ← StaffNotes                │
├──────────────────────────────────────────────────────────┤
│            ↓ Sử dụng chung ↓                             │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │Notifications│  │ Activity Logs │  │   Policies    │  │
│  │ (Thông báo) │  │(Nhật ký h.đ.) │  │(Chính sách)   │  │
│  └─────────────┘  └───────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Bảng liên kết Model chi tiết

| Model | Liên kết với | Quan hệ |
|-------|-------------|---------|
| **Partner** | Apartment | 1 Partner → nhiều Apartment |
| **Apartment** | Room | 1 Apartment → nhiều Room |
| **Apartment** | RentalContract | 1 Apartment → nhiều Contract (theo thời gian) |
| **Apartment** | IoTDevice | 1 Apartment → nhiều IoT Device |
| **Apartment** | UtilityMeter | 1 Apartment → nhiều Meter |
| **Apartment** | ContactRequest | 1 Apartment → nhiều Viewing Request |
| **Room** | IoTDevice | 1 Room → nhiều IoT Device |
| **RentalContract** | UserContractMember | 1 Contract → nhiều thành viên |
| **RentalContract** | Invoice | 1 Contract → nhiều Invoice (hàng tháng) |
| **RentalContract** | MaintenanceRequest | 1 Contract → nhiều yêu cầu bảo trì |
| **Invoice** | Payment | 1 Invoice → nhiều Payment (trả góp/trả lại) |
| **User** | RentalContract | 1 User → nhiều Contract (qua UserContractMember) |
| **User** | Ticket | 1 User → nhiều Ticket |
| **User** | MaintenanceRequest | 1 User → nhiều yêu cầu bảo trì |
| **User** | StaffNote | 1 User → nhiều Staff Note (về mình) |
| **Staff** | StaffNote | 1 Staff → nhiều Staff Note (viết bởi mình) |
| **Staff** | Task | 1 Staff → nhiều Task được gán |
| **Staff** | Appointment | 1 Staff → nhiều lịch hẹn |
| **Guest** | ContactRequest | 1 Guest → nhiều yêu cầu xem nhà |

---

## XVI. Tổng Hợp API Theo Role

### Guest (Public — không cần đăng nhập)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/apartments/search` | Tìm kiếm căn hộ |
| `GET` | `/apartments/:id` | Chi tiết căn hộ |
| `POST` | `/viewing-requests` | Để lại thông tin xem nhà |
| `POST` | `/auth/register` | Đăng ký tài khoản |
| `POST` | `/auth/login` | Đăng nhập |
| `POST` | `/auth/google` | Đăng nhập Google |
| `POST` | `/auth/forgot-password` | Quên mật khẩu |
| `POST` | `/auth/reset-password` | Đặt lại mật khẩu |
| `GET` | `/policies/public` | Xem chính sách |
| `GET` | `/policies/legal-documents/public` | Xem tài liệu pháp lý |
| `GET` | `/` | API info |
| `GET` | `/health` | Health check |

### User (Người thuê)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/users/profile` | Xem profile |
| `PATCH` | `/users/:id` | Cập nhật profile |
| `GET` | `/contracts` | Xem hợp đồng của mình |
| `GET` | `/invoices` | Xem hóa đơn |
| `POST` | `/payments` | Thanh toán hóa đơn |
| `POST` | `/maintenance` | Báo lỗi bảo trì |
| `POST` | `/tickets` | Tạo ticket hỗ trợ |
| `PATCH` | `/tickets/:id/close` | Đóng ticket |
| `GET` | `/notifications/my` | Xem thông báo |
| `POST` | `/iot/devices/:id/control` | Điều khiển thiết bị IoT |
| `POST` | `/auth/change-password` | Đổi mật khẩu |

### Staff (Nhân viên)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/viewing-requests/my-assigned` | Xem yêu cầu xem nhà |
| `POST` | `/viewing-requests/:id/appointments` | Tạo lịch hẹn |
| `POST` | `/staff-notes` | Ghi chú khách hàng |
| `GET` | `/staff-notes/user/:userId` | Xem ghi chú khách hàng |
| `GET` | `/maintenance` | Xem yêu cầu bảo trì |
| `PATCH` | `/maintenance/:id/complete` | Hoàn thành bảo trì |
| `GET` | `/tickets` | Xem tickets |
| `PATCH` | `/tickets/:id/resolve` | Giải quyết ticket |
| `GET` | `/tasks` | Xem task được gán |
| `PATCH` | `/tasks/:id/start` | Bắt đầu task |
| `PATCH` | `/tasks/:id/complete` | Hoàn thành task |
| `POST` | `/iot/readings` | Ghi chỉ số đồng hồ |
| `POST` | `/contracts` | Tạo hợp đồng |

### Operator (Điều hành viên)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `PATCH` | `/apartments/:id/approve` | Duyệt căn hộ |
| `PATCH` | `/contracts/:id/activate` | Kích hoạt hợp đồng |
| `PATCH` | `/contracts/:id/terminate` | Chấm dứt hợp đồng |
| `POST` | `/tasks` | Tạo task cho Staff |
| `PATCH` | `/tasks/:id/assign` | Phân công task |
| `PATCH` | `/tickets/:id/assign` | Gán ticket cho Staff |
| `PATCH` | `/partners/requests/:id/review` | Duyệt yêu cầu đối tác |
| `POST` | `/notifications` | Gửi thông báo |
| `GET` | `/activity-logs` | Xem nhật ký hệ thống |
| `GET` | `/users` | Quản lý user |

### Admin (Quản trị viên)

> Admin có **toàn quyền** trên tất cả API. Ngoài những API của role khác, Admin còn có thêm:

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `DELETE` | `/apartments/:id` | Xóa căn hộ |
| `DELETE` | `/users/:id` | Xóa tài khoản |
| `DELETE` | `/iot/devices/:id` | Vô hiệu hóa thiết bị |
| `POST` | `/policies` | Tạo chính sách |
| `POST` | `/policies/legal-documents` | Upload tài liệu pháp lý |
| `PATCH` | `/policies/:id/approve` | Duyệt chính sách |

### Partner (Đối tác / Chủ nhà)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/partners/profile` | Xem profile đối tác |
| `POST` | `/partners/requests` | Gửi yêu cầu đối tác |
| `GET` | `/partners/requests/my` | Xem yêu cầu của mình |
| `POST` | `/apartments` | Đăng căn hộ cho thuê |
| `PATCH` | `/apartments/:id` | Cập nhật căn hộ |
| `GET` | `/apartments/partner/:partnerId` | Xem căn hộ của mình |

---

## Phụ Lục: Cấu Hình Hạ Tầng

| Thành phần | Mô tả |
|------------|-------|
| **PostgreSQL** | Database chính — `vps.klong.dev:5432` |
| **Redis** | Cache + BullMQ queue — `nong-vps:6379` |
| **BullMQ** | Job queue: EMAIL, NOTIFICATION, PAYMENT, IOT, INVOICE, SMS |
| **PayOS** | Cổng thanh toán online |
| **Supabase** | Google OAuth verification |
| **Tuya IoT** | Nền tảng IoT cho thiết bị thông minh |
| **Prisma ORM** | Database access layer |
| **Swagger** | API documentation tại `/docs` |
