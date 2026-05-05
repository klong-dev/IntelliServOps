# Module and API Ownership

- Generated on: 2026-04-27
- Scope: `src/modules`
- Rule: nếu một API có nhiều người cùng làm, owner được chọn là người có số dòng đóng góp nhiều hơn theo `git blame`.
- Alias đã gộp: `Hoang Kim Long` + `Hoàng Kim Long` => `Hoang Kim Long`; `DuyAnh68` + `Duy` => `Duy Anh`.
- Lưu ý: owner API được tính theo method endpoint trong `controller`; owner module được tính theo toàn bộ file `.ts` trong module, bỏ qua `*.spec.ts`, `index.ts`, `*.bak`.
- Nếu số dòng đóng góp bằng nhau, tài liệu ghi là `Tie`.

## Summary

| Module | Main owner | REST API count | Contribution breakdown |
|---|---|---:|---|
| `activity-logs` | Hoang Kim Long | 1 | Hoang Kim Long: 277, Duy Anh: 15 |
| `amenities` | Duy Anh | 5 | Duy Anh: 451 |
| `apartment-policies` | Duy Anh | 8 | Duy Anh: 692, Hoang Kim Long: 2 |
| `apartments` | Duy Anh | 14 | Duy Anh: 3077, Hoang Kim Long: 1765 |
| `auth` | Hoang Kim Long | 9 | Hoang Kim Long: 1453, Duy Anh: 30 |
| `chat` | Hoang Kim Long | 6 | Hoang Kim Long: 2267, Duy Anh: 93 |
| `contracts` | Duy Anh | 15 | Duy Anh: 4530, Hoang Kim Long: 1722 |
| `invoices` | Hoang Kim Long | 14 | Hoang Kim Long: 3921, Duy Anh: 801 |
| `iot` | Hoang Kim Long | 17 | Hoang Kim Long: 6929, Duy Anh: 12 |
| `maintenance` | Duy Anh | 9 | Duy Anh: 1315, Hoang Kim Long: 482 |
| `notifications` | Hoang Kim Long | 8 | Hoang Kim Long: 1260, Duy Anh: 169 |
| `payments` | Duy Anh | 10 | Duy Anh: 2618, Hoang Kim Long: 619 |
| `reservations` | Duy Anh | 4 | Duy Anh: 722, Hoang Kim Long: 32 |
| `sms` | Hoang Kim Long | 0 | Hoang Kim Long: 175 |
| `user-apartments` | Duy Anh | 4 | Duy Anh: 1340, Hoang Kim Long: 100 |
| `users` | Duy Anh | 20 | Duy Anh: 1830, Hoang Kim Long: 596 |
| `viewing-requests` | Duy Anh | 8 | Duy Anh: 1491, Hoang Kim Long: 339 |

## Activity Logs

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 277, Duy Anh: 15

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/activity-logs` | Hoang Kim Long | Hoang Kim Long: 27, Duy Anh: 14 |

## Amenities

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 451

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/amenities` | Duy Anh | Duy Anh: 14 |
| POST | `/amenities` | Duy Anh | Duy Anh: 30 |
| DELETE | `/amenities/:id` | Duy Anh | Duy Anh: 14 |
| GET | `/amenities/:id` | Duy Anh | Duy Anh: 10 |
| PATCH | `/amenities/:id` | Duy Anh | Duy Anh: 31 |

## Apartment Policies

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 692, Hoang Kim Long: 2

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/apartment-policies` | Duy Anh | Duy Anh: 18 |
| POST | `/apartment-policies` | Duy Anh | Duy Anh: 16 |
| DELETE | `/apartment-policies/:id` | Duy Anh | Duy Anh: 9 |
| GET | `/apartment-policies/:id` | Duy Anh | Duy Anh: 11 |
| PATCH | `/apartment-policies/:id` | Duy Anh | Duy Anh: 14 |
| GET | `/apartment-policies/apartment/:apartmentId` | Duy Anh | Duy Anh: 15 |
| POST | `/apartment-policies/bulk-assign/:policyId` | Duy Anh | Duy Anh: 29 |
| GET | `/apartment-policies/policy/:policyId` | Duy Anh | Duy Anh: 14 |

## Apartments

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 3077, Hoang Kim Long: 1765

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| POST | `/apartments` | Hoang Kim Long | Hoang Kim Long: 16 |
| DELETE | `/apartments/:id` | Hoang Kim Long | Hoang Kim Long: 8, Duy Anh: 3 |
| GET | `/apartments/:id` | Duy Anh | Duy Anh: 7, Hoang Kim Long: 6 |
| PATCH | `/apartments/:id` | Hoang Kim Long | Hoang Kim Long: 13, Duy Anh: 3 |
| PATCH | `/apartments/:id/approve-cooperation` | Duy Anh | Duy Anh: 26 |
| GET | `/apartments/:id/cooperation-contract` | Duy Anh | Duy Anh: 22 |
| PATCH | `/apartments/:id/cooperation-media` | Duy Anh | Duy Anh: 22, Hoang Kim Long: 3 |
| POST | `/apartments/:id/rating` | Duy Anh | Duy Anh: 21, Hoang Kim Long: 1 |
| PATCH | `/apartments/:id/reject-cooperation` | Duy Anh | Duy Anh: 24 |
| GET | `/apartments/cooperation-contracts/:contractId/pdf` | Duy Anh | Duy Anh: 10 |
| GET | `/apartments/cooperation-contracts/pdf/view` | Duy Anh | Duy Anh: 24 |
| GET | `/apartments/owner/:ownerId` | Hoang Kim Long | Hoang Kim Long: 11 |
| POST | `/apartments/partner/cooperation` | Duy Anh | Duy Anh: 17, Hoang Kim Long: 3 |
| GET | `/apartments/search` | Hoang Kim Long | Hoang Kim Long: 13, Duy Anh: 2 |

## Auth

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 1453, Duy Anh: 30

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| POST | `/auth/change-password` | Hoang Kim Long | Hoang Kim Long: 19 |
| POST | `/auth/forgot-password` | Hoang Kim Long | Hoang Kim Long: 10, Duy Anh: 3 |
| POST | `/auth/google` | Hoang Kim Long | Hoang Kim Long: 10, Duy Anh: 6 |
| POST | `/auth/login` | Hoang Kim Long | Hoang Kim Long: 16 |
| POST | `/auth/logout` | Hoang Kim Long | Hoang Kim Long: 12 |
| POST | `/auth/refresh` | Hoang Kim Long | Hoang Kim Long: 12 |
| POST | `/auth/register` | Duy Anh | Duy Anh: 10, Hoang Kim Long: 8 |
| POST | `/auth/reset-password` | Hoang Kim Long | Hoang Kim Long: 11, Duy Anh: 3 |
| GET | `/auth/supabaseUrl` | Hoang Kim Long | Hoang Kim Long: 11, Duy Anh: 2 |

## Chat

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 2267, Duy Anh: 93

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/chat/conversations` | Hoang Kim Long | Hoang Kim Long: 16, Duy Anh: 7 |
| POST | `/chat/conversations` | Hoang Kim Long | Hoang Kim Long: 18, Duy Anh: 4 |
| GET | `/chat/conversations/:id` | Hoang Kim Long | Hoang Kim Long: 7, Duy Anh: 5 |
| PATCH | `/chat/conversations/:id/archive` | Hoang Kim Long | Hoang Kim Long: 8, Duy Anh: 5 |
| GET | `/chat/conversations/:id/messages` | Tie | Duy Anh: 8, Hoang Kim Long: 8 |
| POST | `/chat/upload-images` | Hoang Kim Long | Hoang Kim Long: 44, Duy Anh: 16 |

## Contracts

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 4530, Hoang Kim Long: 1722

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/contracts` | Duy Anh | Duy Anh: 11, Hoang Kim Long: 8 |
| POST | `/contracts` | Duy Anh | Duy Anh: 44, Hoang Kim Long: 9 |
| GET | `/contracts/:id` | Hoang Kim Long | Hoang Kim Long: 11 |
| PATCH | `/contracts/:id` | Hoang Kim Long | Hoang Kim Long: 11 |
| PATCH | `/contracts/:id/activate-paid` | Duy Anh | Duy Anh: 15, Hoang Kim Long: 6 |
| PATCH | `/contracts/:id/cancel` | Duy Anh | Duy Anh: 15 |
| POST | `/contracts/:id/members` | Duy Anh | Duy Anh: 34 |
| GET | `/contracts/:id/pdf` | Duy Anh | Duy Anh: 13 |
| PATCH | `/contracts/:id/pdf-content` | Duy Anh | Duy Anh: 41, Hoang Kim Long: 10 |
| POST | `/contracts/:id/renew` | Duy Anh | Duy Anh: 43 |
| POST | `/contracts/:id/upload` | Duy Anh | Duy Anh: 33 |
| PATCH | `/contracts/cooperation/:id/cancel` | Duy Anh | Duy Anh: 24 |
| POST | `/contracts/cooperation/:id/sign` | Duy Anh | Duy Anh: 53, Hoang Kim Long: 2 |
| PUT | `/contracts/cooperation/commission-phases` | Duy Anh | Duy Anh: 24 |
| GET | `/contracts/pdf/view` | Duy Anh | Duy Anh: 22 |

## Invoices

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 3921, Duy Anh: 801

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/invoices` | Hoang Kim Long | Hoang Kim Long: 8, Duy Anh: 7 |
| GET | `/invoices/:id` | Hoang Kim Long | Hoang Kim Long: 11 |
| GET | `/invoices/dashboard` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/invoices/me` | Hoang Kim Long | Hoang Kim Long: 16 |
| GET | `/invoices/me/overview` | Hoang Kim Long | Hoang Kim Long: 16 |
| GET | `/invoices/me/transactions` | Hoang Kim Long | Hoang Kim Long: 16 |
| GET | `/invoices/overdue/apartments-tenants` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/invoices/overview` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/invoices/partners` | Hoang Kim Long | Hoang Kim Long: 16 |
| GET | `/invoices/staff/partner-payouts` | Hoang Kim Long | Hoang Kim Long: 15 |
| POST | `/invoices/staff/partner-payouts/confirm` | Hoang Kim Long | Hoang Kim Long: 54 |
| GET | `/invoices/timeseries` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/invoices/transactions` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/invoices/utility/monthly` | Hoang Kim Long | Hoang Kim Long: 15 |

## Iot

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 6929, Duy Anh: 12

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/iot/boards` | Hoang Kim Long | Hoang Kim Long: 16 |
| POST | `/iot/boards` | Hoang Kim Long | Hoang Kim Long: 11 |
| DELETE | `/iot/boards/:boardId` | Hoang Kim Long | Hoang Kim Long: 10 |
| GET | `/iot/boards/:boardId` | Hoang Kim Long | Hoang Kim Long: 11 |
| PATCH | `/iot/boards/:boardId` | Hoang Kim Long | Hoang Kim Long: 13 |
| POST | `/iot/boards/:boardId/devices` | Hoang Kim Long | Hoang Kim Long: 17 |
| DELETE | `/iot/boards/:boardId/devices/:deviceId` | Hoang Kim Long | Hoang Kim Long: 13 |
| PATCH | `/iot/boards/:boardId/devices/:deviceId` | Hoang Kim Long | Hoang Kim Long: 14 |
| PATCH | `/iot/boards/:boardId/unlink-apartment` | Hoang Kim Long | Hoang Kim Long: 10 |
| PATCH | `/iot/boards/unlink-apartment-by-apartment/:apartmentId` | Hoang Kim Long | Hoang Kim Long: 12 |
| POST | `/iot/devices/:espId/:deviceId` | Hoang Kim Long | Hoang Kim Long: 24 |
| GET | `/iot/devices/:espId/check-health` | Hoang Kim Long | Hoang Kim Long: 12 |
| PATCH | `/iot/doors/:boardId/:deviceId/pin` | Hoang Kim Long | Hoang Kim Long: 24 |
| PATCH | `/iot/doors/:boardId/:deviceId/pin/reset` | Hoang Kim Long | Hoang Kim Long: 22 |
| POST | `/iot/doors/:boardId/:deviceId/unlock` | Hoang Kim Long | Hoang Kim Long: 18 |
| GET | `/iot/doors/history` | Hoang Kim Long | Hoang Kim Long: 15 |
| GET | `/iot/meter` | Hoang Kim Long | Hoang Kim Long: 21 |

## Maintenance

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 1315, Hoang Kim Long: 482

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/maintenance` | Hoang Kim Long | Hoang Kim Long: 10, Duy Anh: 4 |
| POST | `/maintenance` | Duy Anh | Duy Anh: 13, Hoang Kim Long: 5 |
| GET | `/maintenance/:id` | Duy Anh | Duy Anh: 8, Hoang Kim Long: 5 |
| PATCH | `/maintenance/:id` | Duy Anh | Duy Anh: 15 |
| PATCH | `/maintenance/:id/accept` | Duy Anh | Duy Anh: 13 |
| PATCH | `/maintenance/:id/complete` | Duy Anh | Duy Anh: 4, Hoang Kim Long: 1 |
| PATCH | `/maintenance/:id/rate` | Duy Anh | Duy Anh: 15, Hoang Kim Long: 1 |
| PATCH | `/maintenance/:id/reject` | Duy Anh | Duy Anh: 18 |
| GET | `/maintenance/history` | Duy Anh | Duy Anh: 14 |

## Notifications

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 1260, Duy Anh: 169

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| POST | `/notifications` | Hoang Kim Long | Hoang Kim Long: 7, Duy Anh: 3 |
| PATCH | `/notifications/:id/read` | Hoang Kim Long | Hoang Kim Long: 10 |
| DELETE | `/notifications/fcm-token` | Hoang Kim Long | Hoang Kim Long: 10 |
| POST | `/notifications/fcm-token` | Hoang Kim Long | Hoang Kim Long: 10 |
| GET | `/notifications/my` | Hoang Kim Long | Hoang Kim Long: 10, Duy Anh: 4 |
| PATCH | `/notifications/read-all` | Hoang Kim Long | Hoang Kim Long: 6 |
| POST | `/notifications/test-push-all` | Hoang Kim Long | Hoang Kim Long: 11 |
| GET | `/notifications/unread-count` | Hoang Kim Long | Hoang Kim Long: 6 |

## Payments

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 2618, Hoang Kim Long: 619

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/payments` | Duy Anh | Duy Anh: 11, Hoang Kim Long: 7 |
| GET | `/payments/:id` | Hoang Kim Long | Hoang Kim Long: 11 |
| POST | `/payments/contract-deposit-payouts/confirm` | Duy Anh | Duy Anh: 40 |
| GET | `/payments/contract-deposit-payouts/due` | Duy Anh | Duy Anh: 21 |
| GET | `/payments/invoice/:invoiceId` | Duy Anh | Duy Anh: 18, Hoang Kim Long: 1 |
| POST | `/payments/invoice/:invoiceId/mock-success` | Duy Anh | Duy Anh: 21 |
| POST | `/payments/partner-monthly-payouts/confirm` | Duy Anh | Duy Anh: 39 |
| GET | `/payments/partner-monthly-payouts/due` | Duy Anh | Duy Anh: 20 |
| POST | `/payments/payos/create-link` | Duy Anh | Duy Anh: 13 |
| POST | `/payments/payos/webhook` | Hoang Kim Long | Hoang Kim Long: 13 |

## Reservations

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 722, Hoang Kim Long: 32

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/reservations` | Duy Anh | Duy Anh: 10 |
| POST | `/reservations` | Duy Anh | Duy Anh: 29 |
| GET | `/reservations/:id` | Duy Anh | Duy Anh: 13 |
| PATCH | `/reservations/:id/cancel` | Duy Anh | Duy Anh: 21 |

## Sms

- Module owner: **Hoang Kim Long**
- Module contribution: Hoang Kim Long: 175
- REST API: Không có controller REST trong module này.

## User Apartments

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 1340, Hoang Kim Long: 100

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/user-apartments/:id` | Duy Anh | Duy Anh: 23 |
| PATCH | `/user-apartments/:id/access-info` | Duy Anh | Duy Anh: 42 |
| PATCH | `/user-apartments/:id/house-password` | Duy Anh | Duy Anh: 32, Hoang Kim Long: 3 |
| GET | `/user-apartments/my` | Duy Anh | Duy Anh: 14 |

## Users

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 1830, Hoang Kim Long: 596

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/users` | Duy Anh | Duy Anh: 8, Hoang Kim Long: 3 |
| POST | `/users` | Hoang Kim Long | Hoang Kim Long: 10, Duy Anh: 4 |
| DELETE | `/users/:id` | Hoang Kim Long | Hoang Kim Long: 8 |
| GET | `/users/:id` | Hoang Kim Long | Hoang Kim Long: 11 |
| PATCH | `/users/:id` | Hoang Kim Long | Hoang Kim Long: 11, Duy Anh: 1 |
| GET | `/users/:id/identity` | Duy Anh | Duy Anh: 17 |
| GET | `/users/operators` | Duy Anh | Duy Anh: 6 |
| POST | `/users/operators` | Duy Anh | Duy Anh: 6 |
| DELETE | `/users/operators/:id` | Duy Anh | Duy Anh: 6 |
| GET | `/users/operators/:id` | Duy Anh | Duy Anh: 6 |
| PATCH | `/users/operators/:id` | Duy Anh | Duy Anh: 9 |
| GET | `/users/profile` | Duy Anh | Duy Anh: 9, Hoang Kim Long: 4 |
| GET | `/users/profile/identity` | Duy Anh | Duy Anh: 11 |
| POST | `/users/profile/verify-identity` | Duy Anh | Duy Anh: 6 |
| GET | `/users/search/by-national-id` | Duy Anh | Duy Anh: 22 |
| GET | `/users/staff` | Duy Anh | Duy Anh: 6 |
| POST | `/users/staff` | Duy Anh | Duy Anh: 6 |
| DELETE | `/users/staff/:id` | Duy Anh | Duy Anh: 6 |
| GET | `/users/staff/:id` | Duy Anh | Duy Anh: 6 |
| PATCH | `/users/staff/:id` | Duy Anh | Duy Anh: 9 |

## Viewing Requests

- Module owner: **Duy Anh**
- Module contribution: Duy Anh: 1491, Hoang Kim Long: 339

| Method | Endpoint | Main owner | Contribution breakdown |
|---|---|---|---|
| GET | `/viewing-requests/apartments/:apartmentId/appointments` | Tie | Duy Anh: 9, Hoang Kim Long: 9 |
| PATCH | `/viewing-requests/appointments/:appointmentId/cancel` | Duy Anh | Duy Anh: 47, Hoang Kim Long: 1 |
| PATCH | `/viewing-requests/appointments/:appointmentId/done` | Duy Anh | Duy Anh: 48 |
| GET | `/viewing-requests/my` | Duy Anh | Duy Anh: 38 |
| GET | `/viewing-requests/my-assigned` | Hoang Kim Long | Hoang Kim Long: 6, Duy Anh: 5 |
| PATCH | `/viewing-requests/staff/accept` | Duy Anh | Duy Anh: 24 |
| PATCH | `/viewing-requests/staff/deny` | Duy Anh | Duy Anh: 23 |
| POST | `/viewing-requests/user/book` | Duy Anh | Duy Anh: 50 |
