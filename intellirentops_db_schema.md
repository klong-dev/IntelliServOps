# IntelliRentOps - Database Schema Documentation

## I. ACTORS & AUTHENTICATION

### 1. Guest
**Description:** Web visitors who haven't signed a rental contract yet. They can browse listings and submit inquiries.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20)
- `full_name`: VARCHAR(255)
- `preferred_contact_method`: ENUM('email', 'phone', 'both')
- `ip_address`: VARCHAR(45)
- `session_token`: VARCHAR(255)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`
- INDEX: `session_token`

---

### 2. User
**Description:** Tenants who have signed rental contracts and use the mobile app. Multiple users can share one apartment.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20) NOT NULL
- `full_name`: VARCHAR(255) NOT NULL
- `date_of_birth`: DATE
- `national_id`: VARCHAR(50) UNIQUE
- `passport_number`: VARCHAR(50)
- `profile_image_url`: TEXT
- `emergency_contact_name`: VARCHAR(255)
- `emergency_contact_phone`: VARCHAR(20)
- `password_hash`: VARCHAR(255) NOT NULL
- `is_active`: BOOLEAN DEFAULT TRUE
- `is_verified`: BOOLEAN DEFAULT FALSE
- `last_login_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- `created_by_staff_id`: UUID (FK → Staff.id)

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`, `national_id`
- INDEX: `phone`, `created_by_staff_id`

**Associations:**
- User (1, N) → (1, N) UserContractMember
- User (1, N) → (0, N) Payment
- User (1, N) → (0, N) Ticket
- User (1, N) → (0, N) MaintenanceRequest
- User (N, 1) ← (1, 1) Staff (created_by)

---

### 3. Staff
**Description:** Employees who handle appointments, maintenance, and tenant support.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20) NOT NULL
- `full_name`: VARCHAR(255) NOT NULL
- `employee_code`: VARCHAR(50) NOT NULL UNIQUE
- `role`: ENUM('technician', 'customer_service', 'maintenance', 'general') NOT NULL
- `department`: VARCHAR(100)
- `hire_date`: DATE NOT NULL
- `password_hash`: VARCHAR(255) NOT NULL
- `is_active`: BOOLEAN DEFAULT TRUE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`, `employee_code`
- INDEX: `role`, `is_active`

**Associations:**
- Staff (1, N) → (0, N) Task
- Staff (1, N) → (0, N) Appointment
- Staff (1, N) → (0, N) User (authorized)

---

### 4. Operator
**Description:** Personnel who receive and assign requests from guests and coordinate operations.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20) NOT NULL
- `full_name`: VARCHAR(255) NOT NULL
- `employee_code`: VARCHAR(50) NOT NULL UNIQUE
- `shift`: ENUM('morning', 'afternoon', 'night', 'flexible')
- `password_hash`: VARCHAR(255) NOT NULL
- `is_active`: BOOLEAN DEFAULT TRUE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`, `employee_code`
- INDEX: `shift`, `is_active`

**Associations:**
- Operator (1, N) → (0, N) ContactRequest (received)
- Operator (1, N) → (0, N) Task (assigned)
- Operator (1, N) → (0, N) Apartment (approved)

---

### 5. Admin
**Description:** System administrators with full access to manage users, staff, operators, and properties.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20)
- `full_name`: VARCHAR(255) NOT NULL
- `username`: VARCHAR(100) NOT NULL UNIQUE
- `password_hash`: VARCHAR(255) NOT NULL
- `role_level`: ENUM('super_admin', 'admin', 'manager') DEFAULT 'admin'
- `permissions`: JSON
- `last_login_at`: TIMESTAMP
- `is_active`: BOOLEAN DEFAULT TRUE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`, `username`
- INDEX: `role_level`, `is_active`

**Associations:**
- Admin (1, N) → (0, N) User (managed)
- Admin (1, N) → (0, N) Staff (managed)
- Admin (1, N) → (0, N) Operator (managed)
- Admin (1, N) → (0, N) Apartment (managed)

---

### 6. Partner
**Description:** Property owners who submit their apartments for rental management.

- `id`: UUID (PK)
- `email`: VARCHAR(255) NOT NULL UNIQUE
- `phone`: VARCHAR(20) NOT NULL
- `full_name`: VARCHAR(255)
- `company_name`: VARCHAR(255)
- `tax_code`: VARCHAR(50)
- `national_id`: VARCHAR(50)
- `bank_account_number`: VARCHAR(50)
- `bank_name`: VARCHAR(100)
- `address`: TEXT
- `contract_start_date`: DATE
- `contract_end_date`: DATE
- `commission_rate`: DECIMAL(5,2)
- `payment_terms`: TEXT
- `is_verified`: BOOLEAN DEFAULT FALSE
- `is_active`: BOOLEAN DEFAULT TRUE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `email`, `tax_code`
- INDEX: `is_verified`, `is_active`

**Associations:**
- Partner (1, N) → (0, N) PartnerRequest
- Partner (1, N) → (0, N) Apartment (owned)

---

## II. ASSETS & PROPERTIES

### 7. Apartment
**Description:** Rental units that can contain multiple rooms. Each apartment has a unique address and specifications.

- `id`: UUID (PK)
- `building_name`: VARCHAR(255)
- `apartment_number`: VARCHAR(50) NOT NULL
- `floor_number`: INT
- `address`: TEXT NOT NULL
- `city`: VARCHAR(100) NOT NULL
- `district`: VARCHAR(100) NOT NULL
- `ward`: VARCHAR(100)
- `latitude`: DECIMAL(10,8)
- `longitude`: DECIMAL(11,8)
- `total_area`: DECIMAL(10,2) NOT NULL (square meters)
- `usable_area`: DECIMAL(10,2)
- `number_of_bedrooms`: INT DEFAULT 0
- `number_of_bathrooms`: INT DEFAULT 0
- `furnishing_status`: ENUM('unfurnished', 'semi_furnished', 'fully_furnished')
- `amenities`: JSON (e.g., ["wifi", "parking", "gym", "pool"])
- `base_rent_price`: DECIMAL(12,2) NOT NULL
- `deposit_amount`: DECIMAL(12,2)
- `status`: ENUM('available', 'occupied', 'maintenance', 'reserved', 'inactive') DEFAULT 'available'
- `description`: TEXT
- `images`: JSON (array of image URLs)
- `video_tour_url`: TEXT
- `year_built`: INT
- `partner_id`: UUID (FK → Partner.id)
- `approved_by_operator_id`: UUID (FK → Operator.id)
- `approved_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `status`, `city`, `district`, `partner_id`
- INDEX: `base_rent_price`, `number_of_bedrooms`

**Associations:**
- Apartment (1, N) → (0, N) Room
- Apartment (1, N) → (0, N) RentalContract
- Apartment (1, N) → (0, N) IoTDevice
- Apartment (1, N) → (0, N) UtilityMeter
- Apartment (N, 1) ← (1, 1) Partner
- Apartment (N, 1) ← (0, 1) Operator (approved_by)

---

### 8. Room
**Description:** Individual rooms within an apartment. Used for properties with multiple rentable rooms.

- `id`: UUID (PK)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `room_number`: VARCHAR(50) NOT NULL
- `room_type`: ENUM('bedroom', 'living_room', 'kitchen', 'bathroom', 'storage', 'balcony')
- `area`: DECIMAL(10,2) (square meters)
- `has_window`: BOOLEAN DEFAULT TRUE
- `has_air_conditioning`: BOOLEAN DEFAULT FALSE
- `has_private_bathroom`: BOOLEAN DEFAULT FALSE
- `max_occupancy`: INT DEFAULT 1
- `rent_price`: DECIMAL(12,2)
- `status`: ENUM('available', 'occupied', 'maintenance') DEFAULT 'available'
- `description`: TEXT
- `images`: JSON
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `apartment_id`, `status`, `room_type`
- UNIQUE: (`apartment_id`, `room_number`)

**Associations:**
- Room (N, 1) ← (1, 1) Apartment

---

## III. CONTRACTS & MEMBERSHIP

### 9. RentalContract
**Description:** Legal agreements between tenants and the rental service. Multiple users can be associated with one contract.

- `id`: UUID (PK)
- `contract_number`: VARCHAR(50) NOT NULL UNIQUE
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `start_date`: DATE NOT NULL
- `end_date`: DATE NOT NULL
- `monthly_rent`: DECIMAL(12,2) NOT NULL
- `deposit_amount`: DECIMAL(12,2) NOT NULL
- `payment_due_day`: INT NOT NULL (1-31)
- `payment_method`: ENUM('bank_transfer', 'cash', 'e_wallet', 'auto_debit')
- `utilities_included`: JSON (e.g., ["water", "internet"])
- `utilities_charges`: JSON (e.g., {"electricity": 3500, "water": 15000})
- `contract_terms`: TEXT
- `special_conditions`: TEXT
- `status`: ENUM('draft', 'pending', 'active', 'expired', 'terminated', 'renewed') DEFAULT 'draft'
- `signed_date`: DATE
- `contract_document_url`: TEXT
- `termination_date`: DATE
- `termination_reason`: TEXT
- `early_termination_fee`: DECIMAL(12,2)
- `created_by_staff_id`: UUID (FK → Staff.id)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `contract_number`
- INDEX: `apartment_id`, `status`, `start_date`, `end_date`

**Associations:**
- RentalContract (N, 1) ← (1, 1) Apartment
- RentalContract (1, N) → (1, N) UserContractMember
- RentalContract (1, N) → (0, N) Invoice
- RentalContract (1, N) → (0, N) Ticket

---

### 10. UserContractMember
**Description:** Junction table linking users to rental contracts. Supports multiple tenants per apartment scenario.

- `id`: UUID (PK)
- `user_id`: UUID NOT NULL (FK → User.id)
- `rental_contract_id`: UUID NOT NULL (FK → RentalContract.id)
- `member_type`: ENUM('primary', 'co_tenant', 'guarantor') DEFAULT 'co_tenant'
- `is_primary_contact`: BOOLEAN DEFAULT FALSE
- `move_in_date`: DATE
- `move_out_date`: DATE
- `notification_enabled`: BOOLEAN DEFAULT TRUE
- `access_level`: ENUM('full', 'limited', 'view_only') DEFAULT 'full'
- `share_percentage`: DECIMAL(5,2) (for split payments)
- `status`: ENUM('active', 'moved_out', 'inactive') DEFAULT 'active'
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: (`user_id`, `rental_contract_id`)
- INDEX: `user_id`, `rental_contract_id`, `status`

**Associations:**
- UserContractMember (N, 1) ← (1, 1) User
- UserContractMember (N, 1) ← (1, 1) RentalContract

**Business Rules:**
- One contract must have exactly one `primary` member
- Sum of `share_percentage` for all active members should equal 100%
- When `member_type` is 'primary', `is_primary_contact` must be TRUE

---

## IV. REQUESTS & INQUIRIES

### 11. ContactRequest
**Description:** Initial inquiries from guests interested in renting. First touchpoint in the customer journey.

- `id`: UUID (PK)
- `guest_id`: UUID (FK → Guest.id)
- `apartment_id`: UUID (FK → Apartment.id)
- `full_name`: VARCHAR(255) NOT NULL
- `email`: VARCHAR(255) NOT NULL
- `phone`: VARCHAR(20) NOT NULL
- `preferred_move_in_date`: DATE
- `message`: TEXT
- `budget_range_min`: DECIMAL(12,2)
- `budget_range_max`: DECIMAL(12,2)
- `number_of_occupants`: INT
- `preferred_contact_method`: ENUM('email', 'phone', 'whatsapp')
- `preferred_contact_time`: VARCHAR(100)
- `source`: ENUM('website', 'mobile_app', 'social_media', 'referral', 'walk_in')
- `utm_source`: VARCHAR(100)
- `utm_campaign`: VARCHAR(100)
- `status`: ENUM('new', 'contacted', 'scheduled', 'converted', 'lost', 'spam') DEFAULT 'new'
- `assigned_to_operator_id`: UUID (FK → Operator.id)
- `received_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `first_contacted_at`: TIMESTAMP
- `notes`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `guest_id`, `apartment_id`, `status`, `assigned_to_operator_id`
- INDEX: `received_at`, `email`, `phone`

**Associations:**
- ContactRequest (N, 1) ← (0, 1) Guest
- ContactRequest (N, 1) ← (0, 1) Apartment
- ContactRequest (N, 1) ← (0, 1) Operator (assigned_to)

---

### 12. BookingRequest
**Description:** Formal requests to reserve an apartment. Leads to contract creation if approved.

- `id`: UUID (PK)
- `guest_id`: UUID (FK → Guest.id)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `contact_request_id`: UUID (FK → ContactRequest.id)
- `desired_start_date`: DATE NOT NULL
- `desired_end_date`: DATE NOT NULL
- `number_of_occupants`: INT NOT NULL
- `total_amount`: DECIMAL(12,2) NOT NULL
- `deposit_amount`: DECIMAL(12,2) NOT NULL
- `special_requests`: TEXT
- `identification_documents`: JSON (URLs to ID, passport, etc.)
- `employment_verification`: JSON
- `status`: ENUM('pending', 'approved', 'rejected', 'cancelled', 'expired') DEFAULT 'pending'
- `rejection_reason`: TEXT
- `approved_by_operator_id`: UUID (FK → Operator.id)
- `approved_at`: TIMESTAMP
- `created_rental_contract_id`: UUID (FK → RentalContract.id)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `guest_id`, `apartment_id`, `status`
- INDEX: `contact_request_id`, `created_rental_contract_id`

**Associations:**
- BookingRequest (N, 1) ← (0, 1) Guest
- BookingRequest (N, 1) ← (1, 1) Apartment
- BookingRequest (N, 1) ← (0, 1) ContactRequest
- BookingRequest (1, 1) → (0, 1) RentalContract (creates)
- BookingRequest (N, 1) ← (0, 1) Operator (approved_by)

---

### 13. Appointment
**Description:** Scheduled property viewings arranged between guests and staff.

- `id`: UUID (PK)
- `guest_id`: UUID (FK → Guest.id)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `contact_request_id`: UUID (FK → ContactRequest.id)
- `assigned_staff_id`: UUID NOT NULL (FK → Staff.id)
- `appointment_date`: DATE NOT NULL
- `appointment_time`: TIME NOT NULL
- `duration_minutes`: INT DEFAULT 30
- `meeting_location`: TEXT
- `type`: ENUM('physical_viewing', 'virtual_tour', 'consultation') DEFAULT 'physical_viewing'
- `status`: ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled'
- `guest_notes`: TEXT
- `staff_notes`: TEXT
- `outcome`: ENUM('interested', 'not_interested', 'needs_followup', 'booked')
- `followup_required`: BOOLEAN DEFAULT FALSE
- `reminder_sent_at`: TIMESTAMP
- `cancelled_at`: TIMESTAMP
- `cancellation_reason`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `guest_id`, `apartment_id`, `assigned_staff_id`, `status`
- INDEX: `appointment_date`, `appointment_time`

**Associations:**
- Appointment (N, 1) ← (0, 1) Guest
- Appointment (N, 1) ← (1, 1) Apartment
- Appointment (N, 1) ← (0, 1) ContactRequest
- Appointment (N, 1) ← (1, 1) Staff (assigned_to)

---

### 14. PartnerRequest
**Description:** Submissions from property owners wanting to list their apartments for rental.

- `id`: UUID (PK)
- `partner_id`: UUID NOT NULL (FK → Partner.id)
- `property_type`: ENUM('apartment', 'house', 'condo', 'studio')
- `address`: TEXT NOT NULL
- `city`: VARCHAR(100) NOT NULL
- `district`: VARCHAR(100) NOT NULL
- `total_area`: DECIMAL(10,2)
- `number_of_units`: INT DEFAULT 1
- `expected_rent_price`: DECIMAL(12,2)
- `property_images`: JSON
- `property_documents`: JSON (ownership papers, blueprints)
- `description`: TEXT
- `amenities`: JSON
- `preferred_contract_type`: ENUM('exclusive', 'non_exclusive')
- `status`: ENUM('submitted', 'under_review', 'approved', 'rejected', 'on_hold') DEFAULT 'submitted'
- `reviewed_by_operator_id`: UUID (FK → Operator.id)
- `review_notes`: TEXT
- `rejection_reason`: TEXT
- `approved_at`: TIMESTAMP
- `created_apartment_ids`: JSON (array of created Apartment IDs)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `partner_id`, `status`, `reviewed_by_operator_id`
- INDEX: `city`, `district`

**Associations:**
- PartnerRequest (N, 1) ← (1, 1) Partner
- PartnerRequest (1, N) → (0, N) Apartment (creates after approval)
- PartnerRequest (N, 1) ← (0, 1) Operator (reviewed_by)

---

## V. OPERATIONS & MAINTENANCE

### 15. Task
**Description:** Work assignments for staff, including follow-ups, maintenance, inspections, and general duties.

- `id`: UUID (PK)
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT
- `task_type`: ENUM('followup', 'maintenance', 'inspection', 'delivery', 'cleaning', 'general') NOT NULL
- `priority`: ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium'
- `status`: ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending'
- `assigned_to_staff_id`: UUID (FK → Staff.id)
- `assigned_by_operator_id`: UUID (FK → Operator.id)
- `apartment_id`: UUID (FK → Apartment.id)
- `related_entity_type`: ENUM('contact_request', 'maintenance_request', 'appointment', 'inspection')
- `related_entity_id`: UUID
- `scheduled_date`: DATE
- `scheduled_time`: TIME
- `estimated_duration_minutes`: INT
- `actual_start_time`: TIMESTAMP
- `actual_end_time`: TIMESTAMP
- `completion_notes`: TEXT
- `attachments`: JSON (photos, documents)
- `requires_followup`: BOOLEAN DEFAULT FALSE
- `followup_date`: DATE
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `assigned_to_staff_id`, `assigned_by_operator_id`, `status`
- INDEX: `task_type`, `priority`, `scheduled_date`
- INDEX: `apartment_id`

**Associations:**
- Task (N, 1) ← (0, 1) Staff (assigned_to)
- Task (N, 1) ← (0, 1) Operator (assigned_by)
- Task (N, 1) ← (0, 1) Apartment
- Task (1, 1) ← (0, 1) MaintenanceRequest (converted_from)

---

### 16. MaintenanceRequest
**Description:** Repair and maintenance issues reported by tenants via mobile app.

- `id`: UUID (PK)
- `user_id`: UUID NOT NULL (FK → User.id)
- `rental_contract_id`: UUID NOT NULL (FK → RentalContract.id)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `room_id`: UUID (FK → Room.id)
- `category`: ENUM('plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'other') NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT NOT NULL
- `urgency`: ENUM('low', 'medium', 'high', 'emergency') DEFAULT 'medium'
- `images`: JSON (before photos)
- `preferred_date`: DATE
- `preferred_time_slot`: ENUM('morning', 'afternoon', 'evening', 'anytime')
- `is_tenant_present_required`: BOOLEAN DEFAULT FALSE
- `status`: ENUM('submitted', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'submitted'
- `assigned_task_id`: UUID (FK → Task.id)
- `completion_images`: JSON (after photos)
- `completion_notes`: TEXT
- `tenant_rating`: INT (1-5)
- `tenant_feedback`: TEXT
- `cost_estimate`: DECIMAL(12,2)
- `actual_cost`: DECIMAL(12,2)
- `cost_covered_by`: ENUM('landlord', 'tenant', 'insurance', 'warranty')
- `completed_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `user_id`, `rental_contract_id`, `apartment_id`, `status`
- INDEX: `category`, `urgency`, `created_at`

**Associations:**
- MaintenanceRequest (N, 1) ← (1, 1) User
- MaintenanceRequest (N, 1) ← (1, 1) RentalContract
- MaintenanceRequest (N, 1) ← (1, 1) Apartment
- MaintenanceRequest (N, 1) ← (0, 1) Room
- MaintenanceRequest (1, 1) → (0, 1) Task (converted_to)

---

### 17. Ticket
**Description:** General support requests from tenants regarding non-maintenance issues (billing, documents, questions).

- `id`: UUID (PK)
- `ticket_number`: VARCHAR(50) NOT NULL UNIQUE
- `user_id`: UUID NOT NULL (FK → User.id)
- `rental_contract_id`: UUID NOT NULL (FK → RentalContract.id)
- `category`: ENUM('billing', 'contract', 'account', 'complaint', 'inquiry', 'documentation', 'other') NOT NULL
- `subject`: VARCHAR(255) NOT NULL
- `description`: TEXT NOT NULL
- `priority`: ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium'
- `status`: ENUM('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'escalated') DEFAULT 'open'
- `assigned_to_staff_id`: UUID (FK → Staff.id)
- `attachments`: JSON
- `resolution_notes`: TEXT
- `satisfaction_rating`: INT (1-5)
- `satisfaction_feedback`: TEXT
- `first_response_at`: TIMESTAMP
- `resolved_at`: TIMESTAMP
- `closed_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `ticket_number`
- INDEX: `user_id`, `rental_contract_id`, `status`
- INDEX: `category`, `priority`, `assigned_to_staff_id`

**Associations:**
- Ticket (N, 1) ← (1, 1) User
- Ticket (N, 1) ← (1, 1) RentalContract
- Ticket (N, 1) ← (0, 1) Staff (assigned_to)

---

## VI. FINANCIAL

### 18. Invoice
**Description:** Monthly rental bills and additional charges generated for each contract.

- `id`: UUID (PK)
- `invoice_number`: VARCHAR(50) NOT NULL UNIQUE
- `rental_contract_id`: UUID NOT NULL (FK → RentalContract.id)
- `billing_period_start`: DATE NOT NULL
- `billing_period_end`: DATE NOT NULL
- `issue_date`: DATE NOT NULL
- `due_date`: DATE NOT NULL
- `base_rent`: DECIMAL(12,2) NOT NULL
- `utility_charges`: JSON ({"electricity": 150000, "water": 45000, "internet": 200000})
- `additional_charges`: JSON ({"parking": 50000, "late_fee": 100000})
- `discounts`: JSON ({"promotion": 50000})
- `tax_amount`: DECIMAL(12,2) DEFAULT 0
- `total_amount`: DECIMAL(12,2) NOT NULL
- `currency`: VARCHAR(3) DEFAULT 'VND'
- `status`: ENUM('draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled') DEFAULT 'draft'
- `payment_method`: ENUM('bank_transfer', 'cash', 'e_wallet', 'credit_card')
- `invoice_document_url`: TEXT
- `notes`: TEXT
- `sent_at`: TIMESTAMP
- `paid_at`: TIMESTAMP
- `cancelled_at`: TIMESTAMP
- `cancellation_reason`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `invoice_number`
- INDEX: `rental_contract_id`, `status`, `due_date`
- INDEX: `billing_period_start`, `billing_period_end`

**Associations:**
- Invoice (N, 1) ← (1, 1) RentalContract
- Invoice (1, N) → (0, N) Payment
- Invoice (N, N) ← (0, N) UtilityMeter (records_from)

---

### 19. Payment
**Description:** Records of actual payments made by tenants for invoices.

- `id`: UUID (PK)
- `payment_reference`: VARCHAR(100) NOT NULL UNIQUE
- `invoice_id`: UUID NOT NULL (FK → Invoice.id)
- `user_id`: UUID NOT NULL (FK → User.id)
- `amount`: DECIMAL(12,2) NOT NULL
- `currency`: VARCHAR(3) DEFAULT 'VND'
- `payment_method`: ENUM('bank_transfer', 'cash', 'e_wallet', 'credit_card', 'debit_card') NOT NULL
- `payment_gateway`: VARCHAR(100) (e.g., 'VNPay', 'Momo', 'ZaloPay')
- `transaction_id`: VARCHAR(255)
- `payment_date`: TIMESTAMP NOT NULL
- `status`: ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'pending'
- `payment_proof_url`: TEXT
- `bank_name`: VARCHAR(100)
- `account_number`: VARCHAR(50)
- `notes`: TEXT
- `processed_by_staff_id`: UUID (FK → Staff.id)
- `refund_amount`: DECIMAL(12,2)
- `refund_date`: TIMESTAMP
- `refund_reason`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `payment_reference`
- INDEX: `invoice_id`, `user_id`, `status`
- INDEX: `payment_date`, `transaction_id`

**Associations:**
- Payment (N, 1) ← (1, 1) Invoice
- Payment (N, 1) ← (1, 1) User
- Payment (N, 1) ← (0, 1) Staff (processed_by)

---

## VII. DEVICES & IOT

### 20. IoTDevice
**Description:** Smart home devices installed in apartments (locks, lights, thermostats, cameras).

- `id`: UUID (PK)
- `device_name`: VARCHAR(255) NOT NULL
- `device_type`: ENUM('smart_lock', 'thermostat', 'light', 'camera', 'sensor', 'alarm', 'doorbell') NOT NULL
- `brand`: VARCHAR(100)
- `model`: VARCHAR(100)
- `serial_number`: VARCHAR(100) UNIQUE
- `mac_address`: VARCHAR(50)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `room_id`: UUID (FK → Room.id)
- `location_description`: VARCHAR(255)
- `firmware_version`: VARCHAR(50)
- `status`: ENUM('active', 'inactive', 'maintenance', 'error') DEFAULT 'active'
- `is_controllable_by_tenant`: BOOLEAN DEFAULT TRUE
- `last_online_at`: TIMESTAMP
- `last_maintenance_date`: DATE
- `next_maintenance_date`: DATE
- `installation_date`: DATE
- `warranty_expiry_date`: DATE
- `configuration`: JSON (device-specific settings)
- `access_logs_enabled`: BOOLEAN DEFAULT TRUE
- `notes`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `serial_number`
- INDEX: `apartment_id`, `room_id`, `device_type`, `status`
- INDEX: `mac_address`

**Associations:**
- IoTDevice (N, 1) ← (1, 1) Apartment
- IoTDevice (N, 1) ← (0, 1) Room
- IoTDevice (N, N) ← (0, N) User (controlled_by, through active RentalContract)

---

### 21. UtilityMeter
**Description:** Meters tracking utility consumption (electricity, water, gas) for billing purposes.

- `id`: UUID (PK)
- `meter_number`: VARCHAR(100) NOT NULL UNIQUE
- `meter_type`: ENUM('electricity', 'water', 'gas', 'internet') NOT NULL
- `brand`: VARCHAR(100)
- `model`: VARCHAR(100)
- `apartment_id`: UUID NOT NULL (FK → Apartment.id)
- `installation_date`: DATE NOT NULL
- `last_inspection_date`: DATE
- `next_inspection_date`: DATE
- `unit_of_measurement`: VARCHAR(20) (kWh, m³, etc.)
- `rate_per_unit`: DECIMAL(10,2)
- `current_reading`: DECIMAL(12,2)
- `previous_reading`: DECIMAL(12,2)
- `reading_date`: DATE
- `status`: ENUM('active', 'inactive', 'faulty', 'replaced') DEFAULT 'active'
- `is_digital`: BOOLEAN DEFAULT FALSE
- `calibration_date`: DATE
- `next_calibration_date`: DATE
- `notes`: TEXT
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `meter_number`
- INDEX: `apartment_id`, `meter_type`, `status`
- INDEX: `reading_date`

**Associations:**
- UtilityMeter (N, 1) ← (1, 1) Apartment
- UtilityMeter (1, N) → (0, N) UtilityReading
- UtilityMeter (N, N) → (0, N) Invoice (contributes_to)

---

### 22. UtilityReading
**Description:** Historical records of meter readings for tracking consumption over time.

- `id`: UUID (PK)
- `utility_meter_id`: UUID NOT NULL (FK → UtilityMeter.id)
- `rental_contract_id`: UUID (FK → RentalContract.id)
- `reading_date`: DATE NOT NULL
- `reading_value`: DECIMAL(12,2) NOT NULL
- `previous_reading_value`: DECIMAL(12,2)
- `consumption`: DECIMAL(12,2) (calculated: current - previous)
- `reading_type`: ENUM('manual', 'automatic', 'estimated')
- `read_by_staff_id`: UUID (FK → Staff.id)
- `images`: JSON (photos of meter)
- `notes`: TEXT
- `is_verified`: BOOLEAN DEFAULT FALSE
- `verified_by_staff_id`: UUID (FK → Staff.id)
- `verified_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `utility_meter_id`, `rental_contract_id`, `reading_date`
- INDEX: `read_by_staff_id`, `reading_type`

**Associations:**
- UtilityReading (N, 1) ← (1, 1) UtilityMeter
- UtilityReading (N, 1) ← (0, 1) RentalContract
- UtilityReading (N, 1) ← (0, 1) Staff (read_by)
- UtilityReading (N, 1) ← (0, 1) Staff (verified_by)

---

## VIII. DOCUMENTS & POLICIES

### 23. Policy
**Description:** Terms of service, privacy policies, rental rules displayed to guests and users.

- `id`: UUID (PK)
- `policy_type`: ENUM('terms_of_service', 'privacy_policy', 'rental_rules', 'cancellation_policy', 'community_guidelines') NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `content`: LONGTEXT NOT NULL
- `version`: VARCHAR(20) NOT NULL
- `language`: VARCHAR(10) DEFAULT 'vi'
- `effective_date`: DATE NOT NULL
- `expiry_date`: DATE
- `is_active`: BOOLEAN DEFAULT TRUE
- `requires_acceptance`: BOOLEAN DEFAULT FALSE
- `display_order`: INT DEFAULT 0
- `created_by_admin_id`: UUID (FK → Admin.id)
- `approved_by_admin_id`: UUID (FK → Admin.id)
- `approved_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `policy_type`, `is_active`, `effective_date`
- INDEX: `version`, `language`

**Associations:**
- Policy (N, 1) ← (0, 1) Admin (created_by)
- Policy (N, 1) ← (0, 1) Admin (approved_by)
- Policy (N, N) ← (0, N) Guest (viewed_by)
- Policy (N, N) ← (0, N) User (accepted_by)

---

### 24. LegalDocument
**Description:** Legal forms, templates, and compliance documents (contracts, addendums, disclosures).

- `id`: UUID (PK)
- `document_type`: ENUM('contract_template', 'addendum', 'disclosure', 'consent_form', 'inspection_report', 'other') NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT
- `file_url`: TEXT NOT NULL
- `file_type`: VARCHAR(50) (pdf, docx, etc.)
- `file_size_bytes`: BIGINT
- `category`: VARCHAR(100)
- `language`: VARCHAR(10) DEFAULT 'vi'
- `version`: VARCHAR(20)
- `is_template`: BOOLEAN DEFAULT FALSE
- `requires_signature`: BOOLEAN DEFAULT FALSE
- `is_public`: BOOLEAN DEFAULT FALSE (viewable by guests)
- `tags`: JSON
- `effective_date`: DATE
- `created_by_admin_id`: UUID (FK → Admin.id)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `document_type`, `category`, `is_public`
- INDEX: `is_template`, `language`

**Associations:**
- LegalDocument (N, 1) ← (0, 1) Admin (created_by)
- LegalDocument (N, N) ← (0, N) Guest (viewed_by)
- LegalDocument (N, N) ← (0, N) RentalContract (attached_to)

---

## IX. AUDIT & LOGGING

### 25. ActivityLog
**Description:** System-wide audit trail for tracking user actions and system events.

- `id`: UUID (PK)
- `actor_type`: ENUM('guest', 'user', 'staff', 'operator', 'admin', 'partner', 'system') NOT NULL
- `actor_id`: UUID NOT NULL
- `action`: VARCHAR(255) NOT NULL (e.g., 'login', 'update_profile', 'create_contract')
- `entity_type`: VARCHAR(100) (e.g., 'User', 'Invoice', 'Apartment')
- `entity_id`: UUID
- `description`: TEXT
- `changes`: JSON (old and new values for updates)
- `ip_address`: VARCHAR(45)
- `user_agent`: TEXT
- `request_id`: VARCHAR(100)
- `status`: ENUM('success', 'failure', 'pending')
- `error_message`: TEXT
- `metadata`: JSON
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `actor_type`, `actor_id`, `created_at`
- INDEX: `entity_type`, `entity_id`
- INDEX: `action`, `status`

**Note:** This table supports tracking all actor actions throughout the system for compliance and debugging.

---

### 26. Notification
**Description:** In-app notifications, push notifications, SMS, and email messages sent to users.

- `id`: UUID (PK)
- `recipient_type`: ENUM('guest', 'user', 'staff', 'operator', 'admin', 'partner') NOT NULL
- `recipient_id`: UUID NOT NULL
- `notification_type`: ENUM('info', 'warning', 'success', 'error', 'reminder', 'promotion')
- `channel`: ENUM('in_app', 'email', 'sms', 'push', 'webhook') NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `message`: TEXT NOT NULL
- `action_url`: TEXT
- `action_label`: VARCHAR(100)
- `priority`: ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium'
- `related_entity_type`: VARCHAR(100)
- `related_entity_id`: UUID
- `is_read`: BOOLEAN DEFAULT FALSE
- `read_at`: TIMESTAMP
- `sent_at`: TIMESTAMP
- `delivery_status`: ENUM('pending', 'sent', 'delivered', 'failed', 'bounced')
- `failure_reason`: TEXT
- `retry_count`: INT DEFAULT 0
- `metadata`: JSON
- `expires_at`: TIMESTAMP
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `recipient_type`, `recipient_id`, `is_read`
- INDEX: `notification_type`, `channel`, `sent_at`
- INDEX: `delivery_status`, `created_at`

---

## X. RELATIONSHIP SUMMARY

### Many-to-Many Relationships (via Junction Tables)

1. **User ↔ RentalContract**
   - Junction: `UserContractMember`
   - Business Rule: Multiple users can share one apartment, one user can have multiple contracts over time

2. **Apartment ↔ Invoice ↔ UtilityMeter**
   - Utility meters contribute readings to invoices through `UtilityReading` records
   
3. **User ↔ IoTDevice** (implicit through RentalContract)
   - Users control IoT devices in their contracted apartment
   - Controlled via active contract status

### One-to-Many Relationships

- **Apartment → Room** (1:N)
- **Apartment → RentalContract** (1:N)
- **Apartment → IoTDevice** (1:N)
- **Apartment → UtilityMeter** (1:N)
- **RentalContract → Invoice** (1:N)
- **Invoice → Payment** (1:N)
- **User → Payment** (1:N)
- **User → Ticket** (1:N)
- **User → MaintenanceRequest** (1:N)
- **Partner → Apartment** (1:N)
- **Partner → PartnerRequest** (1:N)
- **Staff → Task** (1:N)
- **Staff → Appointment** (1:N)
- **Operator → ContactRequest** (1:N)
- **Operator → Task** (1:N assigned)

### Key Business Constraints

1. **Contract Membership:**
   - Each RentalContract must have exactly one PRIMARY member
   - Sum of share_percentage must equal 100% for active members
   
2. **Apartment Availability:**
   - Apartment status must be 'available' to accept new BookingRequest
   - Only one active RentalContract per Apartment at a time
   
3. **Payment Processing:**
   - Payment amount cannot exceed Invoice total_amount
   - Invoice status changes to 'paid' when sum(Payments) >= total_amount
   
4. **IoT Device Control:**
   - Users can only control devices in their currently active contracted apartment
   - Device access revoked when contract expires or terminates
   
5. **Maintenance Request Workflow:**
   - MaintenanceRequest creates Task when acknowledged
   - Task completion triggers MaintenanceRequest status update to 'completed'
   
6. **Guest to User Transition:**
   - BookingRequest approval creates RentalContract
   - Staff authorizes User account creation
   - Guest record remains for historical tracking

---

## XI. INDEXES & PERFORMANCE OPTIMIZATION

### Composite Indexes (Recommended)

```sql
-- User authentication and lookups
CREATE INDEX idx_user_email_active ON User(email, is_active);
CREATE INDEX idx_user_phone_verified ON User(phone, is_verified);

-- Contract searches
CREATE INDEX idx_contract_apt_dates ON RentalContract(apartment_id, start_date, end_date);
CREATE INDEX idx_contract_status_dates ON RentalContract(status, end_date, start_date);

-- Invoice management
CREATE INDEX idx_invoice_contract_status ON Invoice(rental_contract_id, status, due_date);
CREATE INDEX idx_invoice_overdue ON Invoice(status, due_date) WHERE status != 'paid';

-- Maintenance tracking
CREATE INDEX idx_maintenance_apt_status ON MaintenanceRequest(apartment_id, status, created_at);
CREATE INDEX idx_maintenance_urgency ON MaintenanceRequest(urgency, status, created_at);

-- Task management
CREATE INDEX idx_task_staff_status ON Task(assigned_to_staff_id, status, scheduled_date);
CREATE INDEX idx_task_priority ON Task(priority, status, created_at);

-- Apartment searches
CREATE INDEX idx_apt_location_status ON Apartment(city, district, status);
CREATE INDEX idx_apt_price_bedrooms ON Apartment(base_rent_price, number_of_bedrooms, status);

-- Activity logging (partitioned by date)
CREATE INDEX idx_activity_actor_date ON ActivityLog(actor_type, actor_id, created_at);
CREATE INDEX idx_activity_entity_date ON ActivityLog(entity_type, entity_id, created_at);
```

### Partitioning Strategy

**Time-series tables** (high volume, historical data):
- `ActivityLog`: Partition by month (created_at)
- `Notification`: Partition by month (created_at)
- `UtilityReading`: Partition by quarter (reading_date)
- `Payment`: Partition by year (payment_date)

---

## XII. DATA ARCHIVAL POLICY

### Archive After Contract Expiration

Tables with retention policies:
- **RentalContract:** Archive 7 years after termination (legal requirement)
- **Invoice:** Archive 7 years after paid
- **Payment:** Archive 7 years after completion
- **MaintenanceRequest:** Archive 3 years after completion
- **Ticket:** Archive 2 years after closure
- **ActivityLog:** Archive 1 year for non-critical actions

### Soft Delete Strategy

Entities using `is_active` or `deleted_at`:
- User, Staff, Operator, Admin, Partner
- Apartment, Room
- IoTDevice, UtilityMeter

**Never hard delete:**
- Financial records (Invoice, Payment)
- Contracts (RentalContract)
- Audit logs (ActivityLog)

---

## XIII. SECURITY CONSIDERATIONS

### Sensitive Data Encryption

Fields requiring encryption at rest:
- User.password_hash (bcrypt/argon2)
- User.national_id
- User.passport_number
- Payment.transaction_id
- Payment.account_number
- Partner.bank_account_number

### Access Control Rules

**Guest:**
- Read: Policy, LegalDocument, Apartment (public listings)
- Write: ContactRequest, BookingRequest

**User (Tenant):**
- Read: Own RentalContract, Invoice, Payment, Apartment (contracted), IoTDevice (contracted)
- Write: Payment, Ticket, MaintenanceRequest
- Control: IoTDevice (in contracted apartment only)

**Staff:**
- Read: Assigned Task, Appointment, MaintenanceRequest, Ticket
- Write: Task completion, Appointment updates, User creation (authorized)

**Operator:**
- Read: ContactRequest, BookingRequest, PartnerRequest, all operational data
- Write: Task assignment, Appointment scheduling, Request status updates

**Admin:**
- Full CRUD access to all entities
- Cannot delete financial records or audit logs

**Partner:**
- Read: Own PartnerRequest, owned Apartments
- Write: PartnerRequest, Apartment updates (own properties only)

---

## XIV. API ENDPOINT MAPPING (Reference)

### Guest Endpoints
- `GET /api/apartments` → List available apartments
- `GET /api/apartments/:id` → View apartment details
- `POST /api/contact-requests` → Submit inquiry
- `GET /api/policies` → View policies

### User Endpoints
- `GET /api/user/contracts` → View rental contracts
- `GET /api/user/invoices` → View invoices
- `POST /api/user/payments` → Make payment
- `GET /api/user/iot-devices` → List controllable devices
- `POST /api/user/iot-devices/:id/control` → Control device
- `POST /api/user/tickets` → Submit support ticket
- `POST /api/user/maintenance-requests` → Request maintenance

### Staff Endpoints
- `GET /api/staff/tasks` → View assigned tasks
- `PATCH /api/staff/tasks/:id` → Update task status
- `GET /api/staff/appointments` → View scheduled appointments
- `POST /api/users` → Create new user account (after authorization)

### Operator Endpoints
- `GET /api/operator/contact-requests` → View incoming requests
- `PATCH /api/operator/contact-requests/:id` → Update request status
- `POST /api/operator/tasks` → Create and assign task
- `POST /api/operator/apartments/:id/approve` → Approve apartment listing

### Admin Endpoints
- `GET /api/admin/users` → List all users
- `PATCH /api/admin/users/:id` → Update user
- `GET /api/admin/analytics` → System analytics dashboard

---

This database schema provides a comprehensive foundation for the IntelliRentOps platform, supporting all business workflows from guest inquiry through to tenant management, maintenance, billing, and IoT device control.