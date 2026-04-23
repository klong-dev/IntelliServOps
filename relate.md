# Table Relations from `physical1.drawio`

- Tong so bang: 23
- Chi tinh lien ket giua cac bang xuat hien trong file ERD nay.
- Thu tu sap xep: giam dan theo so bang lien ket, bang nhau thi theo ten bang.

## apartments (12 lien ket)
- apartment_amenities
- apartment_policies
- apartment_ratings
- appointments
- booking_requests
- iot_boards
- iot_devices
- operators
- rental_contracts
- reservations
- user_apartments
- users

## users (10 lien ket)
- apartment_ratings
- apartments
- chat_conversations
- partner_monthly_payouts
- payments
- reservations
- staff
- user_apartments
- user_contract_members
- user_identities

## rental_contracts (7 lien ket)
- apartment_ratings
- apartments
- invoices
- reservations
- staff
- user_apartments
- user_contract_members

## staff (5 lien ket)
- appointments
- partner_monthly_payouts
- payments
- rental_contracts
- users

## apartment_ratings (3 lien ket)
- apartments
- rental_contracts
- users

## payments (3 lien ket)
- invoices
- staff
- users

## reservations (3 lien ket)
- apartments
- rental_contracts
- users

## user_apartments (3 lien ket)
- apartments
- rental_contracts
- users

## apartment_amenities (2 lien ket)
- amenities
- apartments

## apartment_policies (2 lien ket)
- apartments
- policies

## appointments (2 lien ket)
- apartments
- staff

## booking_requests (2 lien ket)
- apartments
- operators

## invoices (2 lien ket)
- payments
- rental_contracts

## operators (2 lien ket)
- apartments
- booking_requests

## partner_monthly_payouts (2 lien ket)
- staff
- users

## policies (2 lien ket)
- admins
- apartment_policies

## user_contract_members (2 lien ket)
- rental_contracts
- users

## admins (1 lien ket)
- policies

## amenities (1 lien ket)
- apartment_amenities

## chat_conversations (1 lien ket)
- users

## iot_boards (1 lien ket)
- apartments

## iot_devices (1 lien ket)
- apartments

## user_identities (1 lien ket)
- users
