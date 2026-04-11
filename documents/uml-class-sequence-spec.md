# IntelliServOps Diagram Catalog for AI Drawing

## 1. Muc tieu

Tai lieu nay la nguon dau vao de AI co the ho tro ve diagram dong nhat.

Pham vi:

- 14 class diagram theo list da chot
- 16 sequence diagram theo list da chot
- Moi diagram co scope, thanh phan, quan he/luong, va prompt goi y cho AI

Quy uoc ten:

- CD-xx: Class Diagram
- SD-xx: Sequence Diagram

## 2. Class Diagram Specifications

### CD-01 Identity and Access Core

Muc tieu: Mo hinh hoa nhom danh tinh, quyen truy cap, token, otp.
Classes: User, UserIdentity, Staff, Operator, Admin, RefreshToken, PasswordResetToken, OtpVerification.
Quan he can ve:

- User 1..1 UserIdentity
- User 1..\* RefreshToken
- User 1..\* PasswordResetToken
- User 1..\* OtpVerification
- Staff, Operator, Admin la actor quan tri cap quyen vao User
  Goi y bo cuc: Dat User o trung tam; token va otp o ben duoi; actor quan tri o ben phai.
  Prompt AI:
  "Draw UML class diagram CD-01 for IntelliServOps with User as central class. Include UserIdentity, RefreshToken, PasswordResetToken, OtpVerification as associated classes with cardinalities. Add Staff, Operator, Admin as access management roles. Show key attributes only and keep service-agnostic domain view."

### CD-02 User Occupancy and Membership

Muc tieu: Hien thi quan he user tham gia hop dong va o can ho.
Classes: User, UserApartment, RentalContract, UserContractMember.
Quan he can ve:

- User 1..\* UserApartment
- RentalContract 1..\* UserApartment
- User 1..\* UserContractMember
- RentalContract 1..\* UserContractMember
  Goi y bo cuc: User ben trai, RentalContract ben phai, 2 bang lien ket o giua.
  Prompt AI:
  "Draw CD-02 with User and RentalContract connected through UserApartment and UserContractMember association classes. Show cardinalities and role fields where relevant."

### CD-03 Property Structure

Muc tieu: Mo hinh hoa cau truc tai san va tien ich.
Classes: Apartment, Room, Amenity, ApartmentAmenity.
Quan he can ve:

- Apartment 1..\* Room
- Apartment _.._ Amenity qua ApartmentAmenity
  Goi y bo cuc: Apartment trung tam; Room ben trai; Amenity ben phai; ApartmentAmenity o giua.
  Prompt AI:
  "Draw CD-03 property structure with Apartment composition to Room and many-to-many Apartment-Amenity via ApartmentAmenity."

### CD-04 Policy Application

Muc tieu: Mo hinh hoa chinh sach ap dung tren can ho.
Classes: Policy, ApartmentPolicy, Apartment.
Quan he can ve:

- Apartment _.._ Policy qua ApartmentPolicy
  Goi y bo cuc: Policy ben trai, Apartment ben phai, ApartmentPolicy o giua.
  Prompt AI:
  "Draw CD-04 showing policy application using association class ApartmentPolicy between Policy and Apartment."

### CD-05 Booking and Appointment Flow

Muc tieu: Mo hinh hoa dat lich xem can.
Classes: BookingRequest, Appointment, User, Apartment, Operator, Staff.
Quan he can ve:

- User 1..\* BookingRequest
- Apartment 1..\* BookingRequest
- Operator 1..\* BookingRequest (handled)
- BookingRequest 1..\* Appointment
- Appointment \*..1 Staff (assigned)
- Appointment _..1 User, _..1 Apartment
  Goi y bo cuc: BookingRequest va Appointment o trung tam; User/Apartment trai; Operator/Staff phai.
  Prompt AI:
  "Draw CD-05 with BookingRequest and Appointment lifecycle. Include handledBy operator and assigned staff relationships with cardinalities."

### CD-06 Reservation to Contract

Muc tieu: Luong tu dat cho sang hop dong.
Classes: Reservation, RentalContract, User, Apartment.
Quan he can ve:

- User 1..\* Reservation
- Apartment 1..\* Reservation
- Reservation 0..1 -> 1 RentalContract (converted)
- RentalContract \*..1 Apartment
  Goi y bo cuc: Reservation truoc, mui ten conversion sang RentalContract.
  Prompt AI:
  "Draw CD-06 focusing on conversion from Reservation to RentalContract and ownership by User and Apartment."

### CD-07 Contract Billing

Muc tieu: Cau truc hoa don va thanh toan.
Classes: RentalContract, Invoice, Payment.
Quan he can ve:

- RentalContract 1..\* Invoice
- Invoice 1..\* Payment
  Goi y bo cuc: Chuoi trai sang phai RentalContract -> Invoice -> Payment.
  Prompt AI:
  "Draw CD-07 contract billing chain from RentalContract to Invoice to Payment with one-to-many cardinalities."

### CD-08 Maintenance Operation

Muc tieu: Van hanh bao tri va phan cong.
Classes: MaintenanceRequest, Task, User, Staff, Operator, Apartment, RentalContract.
Quan he can ve:

- User 1..\* MaintenanceRequest
- Apartment 1..\* MaintenanceRequest
- RentalContract 1..\* MaintenanceRequest
- MaintenanceRequest 1..\* Task
- Task \*..1 Staff (assigned)
- Task \*..1 Operator (assignedBy)
  Goi y bo cuc: MaintenanceRequest trung tam, Task ben phai, actor ben ngoai.
  Prompt AI:
  "Draw CD-08 maintenance domain with request-task split and assignment roles (staff/operator)."

### CD-09 Partner Cooperation and Payout

Muc tieu: Luong hop tac va chi tra doi tac.
Classes: PartnerCooperationContract, CooperationCommissionPhase, PartnerMonthlyPayout, PartnerPayoutTransfer, User, Staff, Apartment.
Quan he can ve:

- User(partner) 1..\* PartnerCooperationContract
- Apartment 1..\* PartnerCooperationContract
- PartnerCooperationContract 1..\* CooperationCommissionPhase
- User(partner) 1..\* PartnerMonthlyPayout
- PartnerMonthlyPayout 1..\* PartnerPayoutTransfer
- Staff xac nhan payout/transfer
  Goi y bo cuc: Contract va commission o tren; payout va transfer o duoi.
  Prompt AI:
  "Draw CD-09 partner cooperation and payout with contract, commission phases, monthly payout, and payout transfer including staff confirmation relationship."

### CD-10 IoT Topology

Muc tieu: Topology thiet bi IoT trong can ho.
Classes: IoTBoard, IoTDevice, Apartment, Room.
Quan he can ve:

- Apartment 1..\* IoTBoard
- Apartment 1..\* IoTDevice
- Room 0..\* IoTDevice
  Goi y bo cuc: Apartment trung tam; Room ben trai; IoTBoard/IoTDevice ben phai.
  Prompt AI:
  "Draw CD-10 IoT topology where Apartment hosts IoTBoard and IoTDevice, and Room optionally contains IoTDevice."

### CD-11 Utility Metering

Muc tieu: Do chi so tien ich va doi soat hop dong.
Classes: UtilityMeter, UtilityReading, Apartment, RentalContract.
Quan he can ve:

- Apartment 1..\* UtilityMeter
- UtilityMeter 1..\* UtilityReading
- UtilityReading \*..1 RentalContract (allocation)
  Goi y bo cuc: Apartment -> UtilityMeter -> UtilityReading, RentalContract noi vao UtilityReading.
  Prompt AI:
  "Draw CD-11 utility metering with reading history and allocation to RentalContract."

### CD-12 Communication and Notification

Muc tieu: Chat va thong bao su kien.
Classes: ChatConversation, ChatMessage, Notification, FcmToken, User, Staff.
Quan he can ve:

- User 1..\* ChatConversation
- ChatConversation 1..\* ChatMessage
- Staff co the gui ChatMessage
- User/Staff 1..\* Notification
- User/Staff 1..\* FcmToken
  Goi y bo cuc: Chat o mot cum, Notification/FcmToken o cum khac.
  Prompt AI:
  "Draw CD-12 communication model including chat conversation/message and notification delivery via FcmToken for user/staff actors."

### CD-13 Audit Trail

Muc tieu: Luu vet hanh dong he thong.
Classes: ActivityLog, User, Staff, Operator.
Quan he can ve:

- User 1..\* ActivityLog
- Staff 1..\* ActivityLog
- Operator 1..\* ActivityLog
  Goi y bo cuc: ActivityLog trung tam, actor xung quanh.
  Prompt AI:
  "Draw CD-13 with ActivityLog as central class and polymorphic actor links from User, Staff, Operator."

### CD-14 Experience and Rating

Muc tieu: Danh gia can ho tu nguoi dung.
Classes: ApartmentRating, User, Apartment.
Quan he can ve:

- User 1..\* ApartmentRating
- Apartment 1..\* ApartmentRating
  Goi y bo cuc: Rating o giua User va Apartment.
  Prompt AI:
  "Draw CD-14 showing ApartmentRating as association entity between User and Apartment with score and comment attributes."

## 3. Sequence Diagram Specifications

### SD-01 Dang nhap va phat hanh token

Participants: User, AuthController, AuthService, UserIdentityRepo, TokenService.
Main flow:

1. User gui thong tin dang nhap.
2. AuthService xac thuc user va identity.
3. TokenService phat access token + refresh token.
4. Tra ket qua dang nhap.
   Alt flow: sai thong tin dang nhap -> unauthorized.
   Prompt AI:
   "Draw SD-01 login token issuance with User, AuthController, AuthService, UserIdentityRepo, TokenService and include invalid credential branch."

### SD-02 Refresh token

Participants: User, AuthController, AuthService, RefreshTokenRepo, TokenService.
Main flow:

1. User gui refresh token.
2. AuthService verify refresh token.
3. Rotate refresh token, issue access token moi.
   Prompt AI:
   "Draw SD-02 refresh token rotation with token verification and re-issuance."

### SD-03 Tao booking request

Participants: User, BookingController, BookingService, ApartmentRepo, BookingRequestRepo.
Main flow:

1. User tao booking request.
2. BookingService check apartment availability/rules.
3. Luu booking request.
4. Tra booking id.
   Prompt AI:
   "Draw SD-03 user creates booking request with apartment validation and persistence."

### SD-04 Operator xu ly booking request

Participants: Operator, BookingController, BookingService, BookingRequestRepo, NotificationService.
Main flow:

1. Operator nhan request pending.
2. Cap nhat trang thai approve/reject.
3. Gui notification cho user.
   Prompt AI:
   "Draw SD-04 operator handles booking request and sends notification after status update."

### SD-05 Tao lich hen tu booking request

Participants: Operator, AppointmentController, AppointmentService, BookingService, StaffService, NotificationService.
Main flow:

1. Operator tao appointment tu booking request.
2. Chon va assign staff.
3. Gui thong bao cho user va staff.
   Prompt AI:
   "Draw SD-05 create appointment from booking request with staff assignment and notifications."

### SD-06 Staff xac nhan hoac doi lich hen

Participants: Staff, AppointmentController, AppointmentService, NotificationService.
Main flow:

1. Staff xac nhan/doi lich.
2. Cap nhat appointment status/time.
3. Gui thong bao cho user.
   Prompt AI:
   "Draw SD-06 appointment confirmation/reschedule by staff with status update and notify user."

### SD-07 Tao reservation

Participants: User, ReservationController, ReservationService, ApartmentRepo, ReservationRepo.
Main flow:

1. User tao reservation.
2. Check availability.
3. Tao ban ghi reservation.
   Prompt AI:
   "Draw SD-07 reservation creation with apartment availability check and save."

### SD-08 Chuyen reservation thanh rental contract

Participants: Operator, ContractController, ContractService, ReservationRepo, RentalContractRepo, UserContractMemberRepo, UserApartmentRepo.
Main flow:

1. Lay reservation hop le.
2. Tao rental contract.
3. Tao user contract members.
4. Tao user apartment assignment.
   Prompt AI:
   "Draw SD-08 conversion from reservation to rental contract including member and occupancy records."

### SD-09 Sinh invoice dinh ky

Participants: Scheduler/Operator, BillingController, BillingService, RentalContractRepo, InvoiceRepo.
Main flow:

1. Trigger theo ky.
2. Lay contract con hieu luc.
3. Tao invoice.
   Prompt AI:
   "Draw SD-09 periodic invoice generation from active rental contracts."

### SD-10 Thanh toan invoice

Participants: User, PaymentController, PaymentService, InvoiceRepo, PaymentRepo, ActivityLogService.
Main flow:

1. User thanh toan.
2. Tao payment record.
3. Cap nhat invoice status.
4. Ghi activity log.
   Prompt AI:
   "Draw SD-10 invoice payment flow including payment persistence, invoice update, and activity logging."

### SD-11 Gui yeu cau bao tri

Participants: User, MaintenanceController, MaintenanceService, MaintenanceRequestRepo, OperatorQueue.
Main flow:

1. User tao maintenance request.
2. Luu request.
3. Day vao queue cho operator.
   Prompt AI:
   "Draw SD-11 maintenance request submission from user to operator queue."

### SD-12 Phan cong va xu ly task bao tri

Participants: Operator, TaskController, TaskService, Staff, MaintenanceService, NotificationService.
Main flow:

1. Operator assign task cho staff.
2. Staff xu ly va complete task.
3. Dong maintenance request.
4. Gui notification.
   Prompt AI:
   "Draw SD-12 maintenance task assignment and completion, ending with request closure and notifications."

### SD-13 Chat ho tro

Participants: User/Staff, ChatController, ChatService, ConversationRepo, MessageRepo.
Main flow:

1. Mo conversation neu chua co.
2. Gui/nhan message.
3. Luu lich su chat.
   Prompt AI:
   "Draw SD-13 support chat with conversation open-or-reuse logic and message persistence."

### SD-14 Ghi nhan chi so utility

Participants: IoTDevice/Staff, UtilityController, UtilityService, UtilityMeterRepo, UtilityReadingRepo, BillingService.
Main flow:

1. Nhan chi so moi.
2. Validate meter.
3. Luu utility reading.
4. Trigger doi soat billing neu can.
   Prompt AI:
   "Draw SD-14 utility reading ingestion from IoT or staff and optional billing reconciliation trigger."

### SD-15 Doi soat va chi tra partner

Participants: FinanceJob, PartnerPayoutService, PartnerContractRepo, PartnerMonthlyPayoutRepo, PartnerPayoutTransferRepo, Staff.
Main flow:

1. Tong hop du lieu theo thang.
2. Tao partner monthly payout.
3. Tao payout transfer.
4. Staff xac nhan.
   Prompt AI:
   "Draw SD-15 monthly partner payout reconciliation and transfer confirmation workflow."

### SD-16 Danh gia can ho

Participants: User, RatingController, RatingService, ApartmentRatingRepo, ApartmentRepo.
Main flow:

1. User gui danh gia.
2. Validate quyen danh gia.
3. Luu apartment rating.
4. Cap nhat thong ke diem trung binh.
   Prompt AI:
   "Draw SD-16 apartment rating submission, validation, persistence, and aggregate update."

## 4. Class Specification Mau de dung lai cho tung CD

### 4.1 Bang mo ta class

| No  | Class          | Type    | Responsibility          | Key Attributes | Key Methods          |
| --- | -------------- | ------- | ----------------------- | -------------- | -------------------- |
| 1   | ExampleService | Service | Mo ta trach nhiem chinh | depA, depB     | methodA(), methodB() |

### 4.2 Bang mo ta method

| No  | Method Signature | Description                    |
| --- | ---------------- | ------------------------------ |
| 1   | methodA(input)   | Mo ta ngan gon logic va output |

## 5. Cach su dung tai lieu voi AI

1. Chon ma diagram, vi du CD-05 hoac SD-10.
2. Copy phan Prompt AI cua diagram do.
3. Neu can chi tiet hon, bo sung:
   - ten thuoc tinh chinh
   - ten method/module thuc te trong code
   - style cong cu (Mermaid, PlantUML, draw.io)
4. Giu dung scope cua diagram, khong tron domain khac vao cung mot hinh.
