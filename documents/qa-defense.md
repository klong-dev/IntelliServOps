# Bo cau hoi va cau tra loi (co minh chung)

Tai lieu nay tong hop cac cau hoi quan trong (nghiep vu, tech, code) kem minh chung tu code va tai lieu trong repo. Neu co cho lech giua tai lieu va code, minh ghi ro ngay trong phan tra loi.

## I. Nghiep vu

### 1) Vi sao he thong can nhieu actor (guest, user, staff, operator, admin, partner)?

**Tra loi:** Moi actor tuong ung vai tro va quyen khac nhau trong quy trinh thue nha (guest chi xem va gui yeu cau; staff xu ly lich hen, maintenance; operator duyet van hanh; admin full quyen; partner quan ly tai san). Cach tach role nay giup phan quyen ro rang va giam rui ro lo du lieu.
**Minh chung:** [documents/main-flow.md](documents/main-flow.md), [documents/system-architecture.md](documents/system-architecture.md)

### 2) Luong Guest xem nha dien ra nhu the nao?

**Tra loi:** Guest xem/loc can ho, gui yeu cau xem nha. He thong gan staff phu trach, staff lien he va tao lich hen. Luong nay duoc mo ta ro trong tai lieu main flow.
**Minh chung:** [documents/main-flow.md](documents/main-flow.md)

### 3) Co phai staff duoc gan theo district -> city -> bat ky?

**Tra loi:** Tai lieu mo ta logic gan staff theo khu vuc (district -> city -> bat ky). Tuy nhien trong code hien tai, ham chon staff chi loc theo role customer_service va loai bo nhung staff da co lich trung khung gio; chua dung workingDistrict/workingCity. Day la diem can biet khi hoi dong hoi tinh nhat quan giua doc va code.
**Minh chung:** [documents/flows.md](documents/flows.md), [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L919-L972), [prisma/schema.prisma](prisma/schema.prisma#L524-L525)

### 4) He thong kiem tra trung khung gio lich hen bang logic gi?

**Tra loi:** Khi tao lich, he thong tinh khoang thoi gian tu appointmentTime + durationMinutes. Sau do query cac appointment cung can ho (status scheduled/confirmed) trong cua so thoi gian lien quan, va dung ham hasAppointmentOverlap de kiem tra overlap giua hai khoang. Neu trung, tra loi 409.
**Minh chung:** [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L1013-L1051), [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L995-L1012), [prisma/schema.prisma](prisma/schema.prisma#L1012-L1023)

### 5) MaxConcurrentViewings co duoc ap dung khong?

**Tra loi:** Field maxConcurrentViewings co trong Apartment schema nhung logic check slot trong code hien tai chi kiem tra overlap, khong dem so lich de so sanh voi maxConcurrentViewings. Neu can “dem so luong lich”, can them logic count va so sanh.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L606-L610), [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L1013-L1051)

### 6) Reservation khac gi Contract?

**Tra loi:** Reservation dung de giu cho tam thoi (pending/confirmed/cancelled/expired). Contract la rang buoc phap ly dai han (draft/signed/active/terminated/expired). Hai enum va state machine khac nhau nen khong nham lan nghiep vu.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L102-L110), [prisma/schema.prisma](prisma/schema.prisma#L186-L193), [documents/state-machine-catalog.md](documents/state-machine-catalog.md#L228-L252), [documents/state-machine-catalog.md](documents/state-machine-catalog.md#L417-L435)

### 7) Khi contract active thi trang thai can ho thay doi ra sao?

**Tra loi:** Contract kich hoat se chuyen can ho sang occupied; khi chamt dut thi can ho ve available. Dieu nay dong bo tinh trang kinh doanh cua can ho voi hop dong.
**Minh chung:** [documents/state-machine-catalog.md](documents/state-machine-catalog.md#L44-L76), [documents/main-flow.md](documents/main-flow.md)

### 8) Vong doi hoa don duoc quan ly the nao?

**Tra loi:** Invoice co cac trang thai draft -> issued -> sent -> paid/overdue. Khi payment duoc xac nhan, invoice duoc update sang paid.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L290-L297), [documents/main-flow.md](documents/main-flow.md), [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L967-L989)

### 9) Thanh toan PayOS duoc xu ly ra sao?

**Tra loi:** User tao payment, he thong tao link PayOS. Sau khi thanh toan, PayOS goi webhook; he thong verify chu ky va cap nhat payment/invoice.
**Minh chung:** [documents/main-flow.md](documents/main-flow.md), [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L1325-L1333)

### 10) Luong maintenance quan ly theo trang thai gi?

**Tra loi:** Maintenance co trang thai submitted -> in_progress -> completed (va cac trang thai khac nhu acknowledged/scheduled/cancelled trong schema). Luong nghiep vu trong tai lieu phu hop voi enum.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L256-L262), [documents/main-flow.md](documents/main-flow.md)

### 11) Ticket flow ket thuc khi nao?

**Tra loi:** Ticket di tu open -> in_progress -> resolved -> closed; user xac nhan dong ticket sau khi staff xu ly xong.
**Minh chung:** [documents/main-flow.md](documents/main-flow.md)

### 12) Partner flow co buoc kiem duyet gi?

**Tra loi:** Partner dang ky, operator review/approve, sau do partner dang can ho va tiep tuc duoc operator duyet listing. Buoc nay dam bao chat luong du lieu listing.
**Minh chung:** [documents/main-flow.md](documents/main-flow.md)

### 13) Payout cho partner duoc tong hop nhu the nao?

**Tra loi:** He thong tao ban ghi payout theo thang voi grossRevenue, commissionAmount, payoutAmount, dueDate, va trang thai pending/paid. Staff co quyen xac nhan payout.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L1230-L1254), [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L119-L176), [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L201-L260)

### 14) IoT dong vai tro gi trong nghiep vu?

**Tra loi:** IoT board/device/meter quan ly trang thai thiet bi, phuc vu dieu khien va ghi nhan tien ich (dien/nuoc). Trang thai IoT co state machine ro rang.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L332-L339), [documents/state-machine-catalog.md](documents/state-machine-catalog.md#L124-L193)

## II. Tech / Architecture

### 1) Vi sao chon Shared Database voi RBAC?

**Tra loi:** Tai lieu kien truc cho thay he thong chon Shared Database with Discriminator de giam chi phi, de truy van tong hop, va cach ly du lieu bang RBAC.
**Minh chung:** [documents/system-architecture.md](documents/system-architecture.md#L15-L49)

### 2) Clean Architecture duoc ap dung the nao?

**Tra loi:** He thong tach lop presentation/application/domain/infrastructure. Cac thanh phan nhu Prisma, Redis, BullMQ, PayOS, Tuya nam o lop ha tang.
**Minh chung:** [documents/system-architecture.md](documents/system-architecture.md#L150-L177)

### 3) Cac module chinh dang hoat dong?

**Tra loi:** README liệt kê cac module chinh (auth, apartments, contracts, invoices, payments, maintenance, iot, notifications...).
**Minh chung:** [README.md](README.md)

### 4) Tech stack chinh cua he thong?

**Tra loi:** NestJS, PostgreSQL, Prisma, Redis, BullMQ, PayOS, Supabase, Swagger.
**Minh chung:** [README.md](README.md), [documents/dev-note.md](documents/dev-note.md)

### 5) RBAC enforce o dau?

**Tra loi:** Global guard `JwtAuthGuard` + `RolesGuard` kiem tra token va role. `@Roles`/`@Public` giam sat quyen tren controller.
**Minh chung:** [src/app.module.ts](src/app.module.ts#L97-L102), [src/common/guards/roles.guard.ts](src/common/guards/roles.guard.ts#L12-L34), [src/common/guards/jwt-auth.guard.ts](src/common/guards/jwt-auth.guard.ts#L7-L23), [src/common/decorators/roles.decorator.ts](src/common/decorators/roles.decorator.ts#L4-L5), [src/common/decorators/public.decorator.ts](src/common/decorators/public.decorator.ts#L3-L4)

### 6) Login da role hoat dong the nao?

**Tra loi:** AuthService tim tat ca role theo email/phone, cho phep chon actorType; neu khong chon thi uu tien user. Token chua actorType va role tuong ung.
**Minh chung:** [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts#L80-L149)

### 7) Chuan hoa so dien thoai 0xx va +84?

**Tra loi:** Ham getPhoneVariants tao 2 bien the 0xx va +84xx de tim kiem chung 1 tai khoan.
**Minh chung:** [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts#L417-L429)

### 8) API versioning va Swagger khai bao o dau?

**Tra loi:** main.ts set global prefix api/v1 va setup Swagger /docs, cung cap OpenAPI JSON/YAML.
**Minh chung:** [src/main.ts](src/main.ts#L17-L74)

### 9) Supabase Storage duoc tich hop nhu the nao?

**Tra loi:** SupabaseStorageService upload file vao bucket, lay public URL, co ham upload anh CCCD.
**Minh chung:** [src/shared/services/supabase-storage.service.ts](src/shared/services/supabase-storage.service.ts#L1-L137)

### 10) FPT AI xac thuc CCCD duoc dung ra sao?

**Tra loi:** UsersService goi FPT AI cho ca mat truoc/mat sau, chi chap nhan khi ca hai mat duoc xac minh dung phia.
**Minh chung:** [src/modules/users/users.service.ts](src/modules/users/users.service.ts#L940-L1000)

### 11) Testing dang tap trung vao dau?

**Tra loi:** Tai lieu testing cho thay cac module auth/users/tickets/notifications co unit test day du, cac module khac dang pending.
**Minh chung:** [documents/testing.md](documents/testing.md#L34-L62)

## III. Code / Implementation

### 1) Check trung lich hen dung field nao?

**Tra loi:** Dung Appointment.appointmentTime, durationMinutes, status, apartmentId, guestId, assignedStaffId de loc va tinh overlap.
**Minh chung:** [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L127-L200), [prisma/schema.prisma](prisma/schema.prisma#L1012-L1023)

### 2) Chon staff ranh theo logic nao?

**Tra loi:** findBestMatchingStaff loc staff role customer_service, sau do loai bo staff co lich overlap trong khoang thoi gian dang dat.
**Minh chung:** [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L919-L972)

### 3) Kiem tra slot can ho theo logic nao?

**Tra loi:** ensureApartmentSlotAvailable query cac appointment cung apartmentId va dung hasAppointmentOverlap de phat hien trung.
**Minh chung:** [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L1013-L1051)

### 4) Xac nhan payment vi sao dung transaction?

**Tra loi:** Can update dong thoi payment va invoice, nen dung Prisma transaction de dam bao atomicity.
**Minh chung:** [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L967-L989)

### 5) Webhook PayOS kiem tra chu ky ra sao?

**Tra loi:** handlePayOSWebhook goi payos.webhooks.verify va nem loi neu chu ky khong hop le.
**Minh chung:** [src/modules/payments/payments.service.ts](src/modules/payments/payments.service.ts#L1325-L1333)

### 6) Notification ho tro da kenh dua tren field gi?

**Tra loi:** Schema co NotificationChannel va DeliveryStatus, model Notification luu channel, notificationType, deliveryStatus.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L374-L391), [prisma/schema.prisma](prisma/schema.prisma#L1522-L1534)

### 7) User chi xem du lieu cua minh bang cach nao?

**Tra loi:** getMyViewingRequests filter theo guest.email khi actorType=user; staff chi xem appointment duoc gan; role khac bi cam.
**Minh chung:** [src/modules/viewing-requests/viewing-requests.service.ts](src/modules/viewing-requests/viewing-requests.service.ts#L271-L295)

### 8) FPT AI xac thuc CCCD co check mat truoc/mat sau khong?

**Tra loi:** UsersService goi AI ca 2 mat va dung isVerificationSuccessfulForSide cho front/back. Neu khong du ca 2 mat thi tra loi loi.
**Minh chung:** [src/modules/users/users.service.ts](src/modules/users/users.service.ts#L940-L1000)

### 9) Supabase upload anh CCCD luu o dau?

**Tra loi:** SupabaseStorageService upload vao bucket identities va tra ve public URL, khong luu file vao DB.
**Minh chung:** [src/shared/services/supabase-storage.service.ts](src/shared/services/supabase-storage.service.ts#L103-L137)

### 10) Partner duoc luu chung bang User nhu the nao?

**Tra loi:** Schema ghi ro Partner da gop vao User, va cac field nhu companyName, taxCode, commissionRate, paymentTerms luu trong User.
**Minh chung:** [prisma/schema.prisma](prisma/schema.prisma#L449-L457), [prisma/schema.prisma](prisma/schema.prisma#L598)
