# Handoff Invoice Module

Updated date: 2026-04-17

## 1) Muc tieu thay doi

Tai cau truc read-side tai module Invoice de gom nghiep vu hien thi hoa don va payout ve mot endpoint duy nhat:

- GET /invoices/me

Endpoint nay duoc thiet ke role-aware:

- Staff: lay worklist cac khoan can xu ly chuyen tien (partner monthly payout + contract deposit payout)
- User: lay cac hoa don can thanh toan
- Partner: lay cac hoa don duoc thanh toan tien thue, kem payout breakdown de tinh doanh thu

Dong thoi giu lai cac endpoint invoice cu:

- GET /invoices
- GET /invoices/:id

## 2) Cac thay doi da implement

### 2.1 Controller

File: src/modules/invoices/invoices.controller.ts

Da them endpoint:

- GET /invoices/me

Roles:

- ADMIN, OPERATOR, STAFF, USER

### 2.2 DTO moi

Files:

- src/modules/invoices/dto/invoice-me-query.dto.ts
- src/modules/invoices/dto/invoice-me-response.dto.ts
- src/modules/invoices/dto/index.ts

Da bo sung:

- Query DTO cho bo loc linh dong
- Response DTO role-aware cho feed tong hop

### 2.3 Service logic moi

File: src/modules/invoices/invoices.service.ts

Da bo sung:

- findMe(currentUser, query)
- resolveMeScope(...): tu dong xac dinh scope theo actor
- getStaffWorkItems(...)
- getUserPayableItems(...)
- getPartnerReceivableItems(...)
- applyCommonInvoiceMeFilters(...)

### 2.4 Wiring module

File: src/modules/invoices/invoices.module.ts

- InvoicesModule da import PaymentsModule de tai su dung logic payout due cho staff worklist.

### 2.5 Ho tro schema cho filter moi

File: prisma/schema.prisma

- Invoice.them billingMonth (String?)
- Payment.them receiverUserId (String?) + relation receiverUser
- Bo sung indexes de query nhanh theo filter invoice/me

Migration:

- prisma/migrations/20260416123000_add_invoice_billing_month_and_payment_receiver/migration.sql

## 3) API contract: GET /invoices/me

## 3.1 Query parameters

| Param          | Type                                                         | Required | Meaning                                                                     |
| -------------- | ------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| actorScope     | auto \| staff_worklist \| user_payable \| partner_receivable | No       | Scope override, mac dinh auto                                               |
| invoiceType    | InvoiceType                                                  | No       | Loc theo loai hoa don                                                       |
| invoiceStatus  | InvoiceStatus                                                | No       | Loc theo trang thai hoa don                                                 |
| paymentStatus  | PaymentStatus                                                | No       | Loc theo trang thai paymentSummary                                          |
| paymentMethod  | PaymentMethodType                                            | No       | Loc theo hinh thuc thanh toan                                               |
| billingMonth   | YYYY-MM                                                      | No       | Loc theo chu ky thang                                                       |
| payerUserId    | UUID                                                         | No       | Loc theo nguoi tra                                                          |
| receiverUserId | UUID                                                         | No       | Loc theo nguoi nhan                                                         |
| dueFrom        | ISO date string                                              | No       | Loc dueDate tu ngay                                                         |
| dueTo          | ISO date string                                              | No       | Loc dueDate den ngay                                                        |
| paidFrom       | ISO date string                                              | No       | Loc paidAt tu ngay                                                          |
| paidTo         | ISO date string                                              | No       | Loc paidAt den ngay                                                         |
| search         | string                                                       | No       | Tim theo invoiceNumber, contractNumber, apartmentNumber, ten payer/receiver |
| page           | number                                                       | No       | Paging, default 1                                                           |
| limit          | number                                                       | No       | Paging, default 20, max 100                                                 |

## 3.2 Rule actorScope

Service xac dinh roleContext nhu sau:

- staff/operator/admin:
  - Chi hop le: auto hoac staff_worklist
  - Neu gui user_payable hoac partner_receivable -> 403
- user:
  - Neu user la partner:
    - auto -> partner_receivable
    - user_payable -> user_payable
    - partner_receivable -> partner_receivable
  - Neu user khong phai partner:
    - auto -> user_payable
    - partner_receivable -> 403

## 3.3 Response shape

Response data tra ve InvoiceMeListDto:

- roleContext: staff_worklist | user_payable | partner_receivable
- items: InvoiceMeItemDto[]
- total, page, limit, totalPages

InvoiceMeItemDto co cac cum thong tin:

- Nhom nhan dien item: itemType, itemId
- Nhom invoice: invoiceId, invoiceNumber, invoiceType, invoiceStatus, billingMonth, billingPeriodStart, billingPeriodEnd, dueDate, paidAt
- Nhom so tien: totalAmount, currency, paymentMethod
- Nhom paymentSummary: paymentId, paymentReference, status, paymentDate
- Nhom lien ket contract/apartment: contractId, contractNumber, apartmentId, apartmentNumber
- Nhom doi tuong: payer, receiver
- Nhom doanh thu: payoutBreakdown (co cho partner/staff item lien quan)
- Nhom nghiep vu staff: workMeta (payoutMonth, transferProofUrl, transferReference, transferNote, confirmedAt, confirmedByStaffId)

## 4) Hanh vi theo role

## 4.1 Staff dashboard

Call:

- GET /invoices/me?actorScope=staff_worklist&billingMonth=2026-03

Nguon du lieu:

- paymentsService.listDuePartnerMonthlyPayouts(...)
- paymentsService.listDueContractDepositPayouts(...)

itemType staff nhan duoc:

- partner_monthly_payout
- contract_deposit_payout

Luu y:

- invoiceId va invoiceNumber co the null voi item payout (vi day la work item tong hop)
- paymentSummary.status co mapping:
  - partner payout: paid -> completed, cancelled -> cancelled, con lai -> pending
  - contract deposit payout: refunded -> completed, con lai giu nguyen

## 4.2 User app

Call:

- GET /invoices/me?actorScope=user_payable&invoiceStatus=overdue

Nguon du lieu:

- Invoice cua cac contract ma user la member

Default invoiceStatus neu khong truyen:

- draft, issued, sent, partially_paid, overdue

Output itemType:

- invoice

receiver:

- Chu can ho (owner)

payer:

- Uu tien payment gan nhat
- Neu chua co payment -> lay primary member/primary contact trong contract

## 4.3 Partner portal

Call:

- GET /invoices/me?actorScope=partner_receivable&billingMonth=2026-04

Nguon du lieu:

- Invoice cua apartment co ownerId = currentUser.sub

Default filter neu khong truyen:

- invoiceType = rent
- invoiceStatus = paid

Output itemType:

- invoice

Co them payoutBreakdown:

- grossRevenue = invoice.totalAmount
- systemCommissionRate = commission rate ap dung
- systemCommissionAmount = grossRevenue \* rate/100
- netPayoutAmount = grossRevenue - systemCommissionAmount

Commission rate lay theo uu tien:

1. Partner cooperation contract phu hop theo thoi diem paidAt (hoac billingPeriodEnd neu chua paid)
2. Neu khong co contract phu hop -> fallback contract hop le moi nhat
3. Neu khong co cooperation contract -> fallback owner.commissionRate
4. Neu owner khong la partner -> rate = 0

## 5) Vi du request/response

## 5.1 Staff

Request:

```http
GET /invoices/me?actorScope=staff_worklist&billingMonth=2026-03&page=1&limit=20
Authorization: Bearer <staff_token>
```

Response data sample (rut gon):

```json
{
  "roleContext": "staff_worklist",
  "items": [
    {
      "itemType": "partner_monthly_payout",
      "itemId": "partner-monthly-<partnerId>-2026-03",
      "invoiceId": null,
      "billingMonth": "2026-03",
      "dueDate": "2026-04-05T00:00:00.000Z",
      "totalAmount": "45000000.00",
      "currency": "VND",
      "paymentSummary": {
        "status": "pending"
      },
      "receiver": {
        "id": "<partnerUserId>",
        "fullName": "Nguyen Van A",
        "companyName": "A Property Co., Ltd"
      },
      "payoutBreakdown": {
        "grossRevenue": 50000000,
        "systemCommissionRate": 10,
        "systemCommissionAmount": 5000000,
        "netPayoutAmount": 45000000
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

## 5.2 User

Request:

```http
GET /invoices/me?actorScope=user_payable&invoiceType=utility&invoiceStatus=issued
Authorization: Bearer <user_token>
```

Response data sample (rut gon):

```json
{
  "roleContext": "user_payable",
  "items": [
    {
      "itemType": "invoice",
      "invoiceId": "<invoiceId>",
      "invoiceNumber": "INV-202604-00012",
      "invoiceType": "utility",
      "invoiceStatus": "issued",
      "billingMonth": "2026-04",
      "dueDate": "2026-04-10T00:00:00.000Z",
      "totalAmount": "1200000.00",
      "paymentMethod": "bank_transfer",
      "payer": {
        "id": "<userId>",
        "fullName": "Tran Van B"
      },
      "receiver": {
        "id": "<ownerId>",
        "fullName": "Le Van C"
      }
    }
  ]
}
```

## 5.3 Partner

Request:

```http
GET /invoices/me?actorScope=partner_receivable&billingMonth=2026-04&paymentStatus=completed
Authorization: Bearer <partner_user_token>
```

Response data sample (rut gon):

```json
{
  "roleContext": "partner_receivable",
  "items": [
    {
      "itemType": "invoice",
      "invoiceId": "<invoiceId>",
      "invoiceNumber": "INV-202604-00022",
      "invoiceType": "rent",
      "invoiceStatus": "paid",
      "billingMonth": "2026-04",
      "paidAt": "2026-04-05T02:10:00.000Z",
      "totalAmount": "15000000.00",
      "paymentSummary": {
        "status": "completed"
      },
      "payoutBreakdown": {
        "grossRevenue": 15000000,
        "systemCommissionRate": 8,
        "systemCommissionAmount": 1200000,
        "netPayoutAmount": 13800000
      }
    }
  ]
}
```

## 6) Luu y ky thuat quan trong

- findMe, findAll, findOne deu goi markOverdue truoc khi tra du lieu.
- Filter invoiceType/invoiceStatus/paymentStatus/paymentMethod/billingMonth/payerUserId/receiverUserId/paid-due/search duoc ap dung bo sung tren feed da map.
- paging cua invoices/me la in-memory sau khi da map va filter (khong paging truoc tren DB cho staff mixed feed).
- Khi query billingMonth, service user/partner query theo range billingPeriodStart (YYYY-MM), sau do co them filter billingMonth o lop chung.

## 7) Huong dan frontend tich hop

## 7.1 Mapping theo tab UI

Goi y map tab nhu sau:

- Staff:
  - Tab "Payout partner" -> itemType = partner_monthly_payout
  - Tab "Hoan coc" -> itemType = contract_deposit_payout
- User:
  - Tab "Can thanh toan" -> actorScope=user_payable + invoiceStatus in unpaid statuses
  - Tab "Da thanh toan" -> actorScope=user_payable + paymentStatus=completed
- Partner:
  - Tab "Doanh thu" -> actorScope=partner_receivable
  - Tong hop doanh thu thang: sum payoutBreakdown.netPayoutAmount

## 7.2 Cac bo loc nen mo tren UI

- invoiceType
- invoiceStatus
- paymentStatus
- paymentMethod
- billingMonth
- dueFrom/dueTo
- paidFrom/paidTo
- search

## 8) Error handling

Nhung loi thuong gap:

- 400 BadRequestException:
  - billingMonth sai dinh dang YYYY-MM
  - date filter khong hop le
- 403 ForbiddenException:
  - actorScope khong hop le voi actor hien tai
  - user khong phai partner nhung yeu cau partner_receivable

## 9) Backward compatibility va migration

- GET /invoices va GET /invoices/:id van dung duoc.
- Read-side cua Revenue da duoc thay the boi /invoices/me.
- Neu he thong da ngung expose RevenueModule trong AppModule, frontend can chuyen dashboard doanh thu/payout sang /invoices/me.

## 10) Checklist handover QA

- Staff token:
  - Test actorScope=staff_worklist
  - Test billingMonth + paymentStatus
- User token:
  - Test actorScope=user_payable
  - Test unpaid + paid filters
- Partner token:
  - Test actorScope=partner_receivable
  - Verify payoutBreakdown formula
- Permission:
  - User khong phai partner goi partner_receivable -> 403
  - Staff goi user_payable -> 403

## 11) File tham chieu

- src/modules/invoices/invoices.controller.ts
- src/modules/invoices/invoices.service.ts
- src/modules/invoices/dto/invoice-me-query.dto.ts
- src/modules/invoices/dto/invoice-me-response.dto.ts
- src/modules/invoices/dto/index.ts
- src/modules/invoices/invoices.module.ts
- prisma/schema.prisma
- prisma/migrations/20260416123000_add_invoice_billing_month_and_payment_receiver/migration.sql
