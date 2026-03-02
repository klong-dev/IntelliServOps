# IntelliRentOps - Physical Database ERD

```mermaid
erDiagram
    guests {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        ENUM_PreferredContactMethod preferred_contact_method
        VARCHAR ip_address
        VARCHAR session_token
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    users {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        TIMESTAMPTZ date_of_birth
        VARCHAR national_id FK
        VARCHAR passport_number
        VARCHAR profile_image_url
        VARCHAR emergency_contact_name
        VARCHAR emergency_contact_phone
        VARCHAR password_hash
        VARCHAR supabase_id FK
        BOOLEAN is_active
        BOOLEAN is_verified
        TIMESTAMPTZ last_login_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        VARCHAR created_by_staff_id FK
    }

    staff {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        VARCHAR employee_code UK
        ENUM_StaffRole role
        VARCHAR department
        VARCHAR working_city
        VARCHAR working_district
        DECIMAL_10_8 latitude
        DECIMAL_11_8 longitude
        TIMESTAMPTZ hire_date
        VARCHAR password_hash
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    operators {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        VARCHAR employee_code UK
        ENUM_OperatorShift shift
        VARCHAR password_hash
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    admins {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        VARCHAR username UK
        VARCHAR password_hash
        ENUM_AdminRoleLevel role_level
        JSONB permissions
        TIMESTAMPTZ last_login_at
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    partners {
        VARCHAR id PK
        VARCHAR email UK
        VARCHAR phone
        VARCHAR full_name
        VARCHAR company_name
        VARCHAR tax_code UK
        VARCHAR national_id FK
        VARCHAR bank_account_number
        VARCHAR bank_name
        VARCHAR address
        TIMESTAMPTZ contract_start_date
        TIMESTAMPTZ contract_end_date
        DECIMAL_5_2 commission_rate
        VARCHAR payment_terms
        BOOLEAN is_verified
        BOOLEAN is_active
        VARCHAR password_hash
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    apartments {
        VARCHAR id PK
        VARCHAR building_name
        VARCHAR apartment_number
        VARCHAR apartment_type
        INT max_concurrent_viewings
        INT floor_number
        VARCHAR address
        VARCHAR city
        VARCHAR district
        VARCHAR ward
        DECIMAL_10_8 latitude
        DECIMAL_11_8 longitude
        DECIMAL_10_2 total_area
        DECIMAL_10_2 usable_area
        INT number_of_bedrooms
        INT number_of_bathrooms
        ENUM_FurnishingStatus furnishing_status
        JSONB amenities
        DECIMAL_12_2 base_rent_price
        DECIMAL_12_2 deposit_amount
        ENUM_ApartmentStatus status
        VARCHAR description
        JSONB images
        VARCHAR video_tour_url
        INT year_built
        VARCHAR partner_id FK
        VARCHAR approved_by_operator_id FK
        TIMESTAMPTZ approved_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    rooms {
        VARCHAR id PK
        VARCHAR apartment_id FK
        VARCHAR room_number
        ENUM_RoomType room_type
        DECIMAL_10_2 area
        BOOLEAN has_window
        BOOLEAN has_air_conditioning
        BOOLEAN has_private_bathroom
        INT max_occupancy
        DECIMAL_12_2 rent_price
        ENUM_RoomStatus status
        VARCHAR description
        JSONB images
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    rental_contracts {
        VARCHAR id PK
        VARCHAR contract_number UK
        VARCHAR apartment_id FK
        TIMESTAMPTZ start_date
        TIMESTAMPTZ end_date
        DECIMAL_12_2 monthly_rent
        DECIMAL_12_2 deposit_amount
        INT payment_due_day
        ENUM_PaymentMethodType payment_method
        JSONB utilities_included
        JSONB utilities_charges
        VARCHAR contract_terms
        VARCHAR special_conditions
        ENUM_ContractStatus status
        TIMESTAMPTZ signed_date
        VARCHAR contract_document_url
        TIMESTAMPTZ termination_date
        VARCHAR termination_reason
        DECIMAL_12_2 early_termination_fee
        VARCHAR created_by_staff_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    user_contract_members {
        VARCHAR id PK
        VARCHAR user_id FK
        VARCHAR rental_contract_id FK
        ENUM_MemberType member_type
        BOOLEAN is_primary_contact
        TIMESTAMPTZ move_in_date
        TIMESTAMPTZ move_out_date
        BOOLEAN notification_enabled
        ENUM_AccessLevel access_level
        DECIMAL_5_2 share_percentage
        ENUM_MemberStatus status
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    contact_requests {
        VARCHAR id PK
        VARCHAR guest_id FK
        VARCHAR apartment_id FK
        VARCHAR full_name
        VARCHAR email
        VARCHAR phone
        TIMESTAMPTZ preferred_move_in_date
        VARCHAR message
        DECIMAL_12_2 budget_range_min
        DECIMAL_12_2 budget_range_max
        INT number_of_occupants
        ENUM_PreferredContactMethod preferred_contact_method
        VARCHAR preferred_contact_time
        ENUM_ContactSource source
        VARCHAR utm_source
        VARCHAR utm_campaign
        ENUM_ContactRequestStatus status
        VARCHAR assigned_to_operator_id FK
        TIMESTAMPTZ received_at
        TIMESTAMPTZ first_contacted_at
        VARCHAR notes
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    booking_requests {
        VARCHAR id PK
        VARCHAR guest_id FK
        VARCHAR apartment_id FK
        VARCHAR contact_request_id FK
        TIMESTAMPTZ desired_start_date
        TIMESTAMPTZ desired_end_date
        INT number_of_occupants
        DECIMAL_12_2 total_amount
        DECIMAL_12_2 deposit_amount
        VARCHAR special_requests
        JSONB identification_documents
        JSONB employment_verification
        ENUM_BookingStatus status
        VARCHAR rejection_reason
        VARCHAR approved_by_operator_id FK
        TIMESTAMPTZ approved_at
        VARCHAR created_rental_contract_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    appointments {
        VARCHAR id PK
        VARCHAR guest_id FK
        VARCHAR apartment_id FK
        VARCHAR contact_request_id FK
        VARCHAR assigned_staff_id FK
        TIMESTAMPTZ appointment_date
        TIMESTAMPTZ appointment_time
        INT duration_minutes
        VARCHAR meeting_location
        ENUM_AppointmentType type
        ENUM_AppointmentStatus status
        VARCHAR guest_notes
        VARCHAR staff_notes
        ENUM_AppointmentOutcome outcome
        BOOLEAN followup_required
        TIMESTAMPTZ reminder_sent_at
        TIMESTAMPTZ cancelled_at
        VARCHAR cancellation_reason
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    partner_requests {
        VARCHAR id PK
        VARCHAR partner_id FK
        ENUM_PropertyType property_type
        VARCHAR address
        VARCHAR city
        VARCHAR district
        DECIMAL_10_2 total_area
        INT number_of_units
        DECIMAL_12_2 expected_rent_price
        JSONB property_images
        JSONB property_documents
        VARCHAR description
        JSONB amenities
        ENUM_ContractType preferred_contract_type
        ENUM_PartnerRequestStatus status
        VARCHAR reviewed_by_operator_id FK
        VARCHAR review_notes
        VARCHAR rejection_reason
        TIMESTAMPTZ approved_at
        JSONB created_apartment_ids
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    tasks {
        VARCHAR id PK
        VARCHAR title
        VARCHAR description
        ENUM_TaskType task_type
        ENUM_Priority priority
        ENUM_TaskStatus status
        VARCHAR assigned_to_staff_id FK
        VARCHAR assigned_by_operator_id FK
        VARCHAR apartment_id FK
        ENUM_RelatedEntityType related_entity_type
        VARCHAR related_entity_id FK
        TIMESTAMPTZ scheduled_date
        TIMESTAMPTZ scheduled_time
        INT estimated_duration_mins
        TIMESTAMPTZ actual_start_time
        TIMESTAMPTZ actual_end_time
        VARCHAR completion_notes
        JSONB attachments
        BOOLEAN requires_followup
        TIMESTAMPTZ followup_date
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    maintenance_requests {
        VARCHAR id PK
        VARCHAR user_id FK
        VARCHAR rental_contract_id FK
        VARCHAR apartment_id FK
        VARCHAR room_id FK
        ENUM_MaintenanceCategory category
        VARCHAR title
        VARCHAR description
        ENUM_Urgency urgency
        JSONB images
        TIMESTAMPTZ preferred_date
        VARCHAR preferred_time_slot
        BOOLEAN is_tenant_present_required
        ENUM_MaintenanceStatus status
        VARCHAR assigned_task_id FK
        JSONB completion_images
        VARCHAR completion_notes
        INT tenant_rating
        VARCHAR tenant_feedback
        DECIMAL_12_2 cost_estimate
        DECIMAL_12_2 actual_cost
        ENUM_CostCoverage cost_covered_by
        TIMESTAMPTZ completed_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    tickets {
        VARCHAR id PK
        VARCHAR ticket_number UK
        VARCHAR user_id FK
        VARCHAR rental_contract_id FK
        ENUM_TicketCategory category
        VARCHAR subject
        VARCHAR description
        ENUM_Priority priority
        ENUM_TicketStatus status
        VARCHAR assigned_to_staff_id FK
        JSONB attachments
        VARCHAR resolution_notes
        INT satisfaction_rating
        VARCHAR satisfaction_feedback
        TIMESTAMPTZ first_response_at
        TIMESTAMPTZ resolved_at
        TIMESTAMPTZ closed_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    invoices {
        VARCHAR id PK
        VARCHAR invoice_number UK
        VARCHAR rental_contract_id FK
        TIMESTAMPTZ billing_period_start
        TIMESTAMPTZ billing_period_end
        TIMESTAMPTZ issue_date
        TIMESTAMPTZ due_date
        DECIMAL_12_2 base_rent
        JSONB utility_charges
        JSONB additional_charges
        JSONB discounts
        DECIMAL_12_2 tax_amount
        DECIMAL_12_2 total_amount
        VARCHAR currency
        ENUM_InvoiceStatus status
        ENUM_PaymentMethodType payment_method
        VARCHAR invoice_document_url
        VARCHAR notes
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ paid_at
        TIMESTAMPTZ cancelled_at
        VARCHAR cancellation_reason
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    payments {
        VARCHAR id PK
        VARCHAR payment_reference UK
        VARCHAR invoice_id FK
        VARCHAR user_id FK
        DECIMAL_12_2 amount
        VARCHAR currency
        ENUM_PaymentMethodType payment_method
        VARCHAR payment_gateway
        VARCHAR transaction_id FK
        TIMESTAMPTZ payment_date
        ENUM_PaymentStatus status
        VARCHAR payment_proof_url
        VARCHAR bank_name
        VARCHAR account_number
        VARCHAR notes
        VARCHAR processed_by_staff_id FK
        DECIMAL_12_2 refund_amount
        TIMESTAMPTZ refund_date
        VARCHAR refund_reason
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    iot_devices {
        VARCHAR id PK
        VARCHAR device_name
        ENUM_IoTDeviceType device_type
        VARCHAR brand
        VARCHAR model
        VARCHAR serial_number UK
        VARCHAR mac_address
        VARCHAR apartment_id FK
        VARCHAR room_id FK
        VARCHAR location_description
        VARCHAR firmware_version
        ENUM_IoTStatus status
        BOOLEAN is_controllable_by_tenant
        TIMESTAMPTZ last_online_at
        TIMESTAMPTZ last_maintenance_date
        TIMESTAMPTZ next_maintenance_date
        TIMESTAMPTZ installation_date
        TIMESTAMPTZ warranty_expiry_date
        JSONB configuration
        BOOLEAN access_logs_enabled
        VARCHAR notes
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    utility_meters {
        VARCHAR id PK
        VARCHAR meter_number UK
        ENUM_MeterType meter_type
        VARCHAR brand
        VARCHAR model
        VARCHAR apartment_id FK
        TIMESTAMPTZ installation_date
        TIMESTAMPTZ last_inspection_date
        TIMESTAMPTZ next_inspection_date
        VARCHAR unit_of_measurement
        DECIMAL_10_2 rate_per_unit
        DECIMAL_12_2 current_reading
        DECIMAL_12_2 previous_reading
        TIMESTAMPTZ reading_date
        ENUM_MeterStatus status
        BOOLEAN is_digital
        TIMESTAMPTZ calibration_date
        TIMESTAMPTZ next_calibration_date
        VARCHAR notes
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    utility_readings {
        VARCHAR id PK
        VARCHAR utility_meter_id FK
        VARCHAR rental_contract_id FK
        TIMESTAMPTZ reading_date
        DECIMAL_12_2 reading_value
        DECIMAL_12_2 previous_reading_value
        DECIMAL_12_2 consumption
        ENUM_ReadingType reading_type
        VARCHAR read_by_staff_id FK
        JSONB images
        VARCHAR notes
        BOOLEAN is_verified
        VARCHAR verified_by_staff_id FK
        TIMESTAMPTZ verified_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    policies {
        VARCHAR id PK
        ENUM_PolicyType policy_type
        VARCHAR title
        VARCHAR content
        VARCHAR version
        VARCHAR language
        TIMESTAMPTZ effective_date
        TIMESTAMPTZ expiry_date
        BOOLEAN is_active
        BOOLEAN requires_acceptance
        INT display_order
        VARCHAR created_by_admin_id FK
        VARCHAR approved_by_admin_id FK
        TIMESTAMPTZ approved_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    legal_documents {
        VARCHAR id PK
        ENUM_DocumentType document_type
        VARCHAR title
        VARCHAR description
        VARCHAR file_url
        VARCHAR file_type
        BIGINT file_size_bytes
        VARCHAR category
        VARCHAR language
        VARCHAR version
        BOOLEAN is_template
        BOOLEAN requires_signature
        BOOLEAN is_public
        JSONB tags
        TIMESTAMPTZ effective_date
        VARCHAR created_by_admin_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    activity_logs {
        VARCHAR id PK
        ENUM_ActorType actor_type
        VARCHAR actor_id FK
        VARCHAR action
        VARCHAR entity_type
        VARCHAR entity_id FK
        VARCHAR description
        JSONB changes
        VARCHAR ip_address
        VARCHAR user_agent
        VARCHAR request_id FK
        ENUM_ActivityStatus status
        VARCHAR error_message
        JSONB metadata
        TIMESTAMPTZ created_at
    }

    notifications {
        VARCHAR id PK
        ENUM_ActorType recipient_type
        VARCHAR recipient_id FK
        ENUM_NotificationType notification_type
        ENUM_NotificationChannel channel
        VARCHAR title
        VARCHAR message
        VARCHAR action_url
        VARCHAR action_label
        ENUM_Priority priority
        VARCHAR related_entity_type
        VARCHAR related_entity_id FK
        BOOLEAN is_read
        TIMESTAMPTZ read_at
        TIMESTAMPTZ sent_at
        ENUM_DeliveryStatus delivery_status
        VARCHAR failure_reason
        INT retry_count
        JSONB metadata
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    staff_notes {
        VARCHAR id PK
        VARCHAR staff_id FK
        VARCHAR user_id FK
        VARCHAR content
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    refresh_tokens {
        VARCHAR id PK
        VARCHAR token UK
        VARCHAR actor_id FK
        ENUM_ActorType actor_type
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ revoked_at
    }

    password_reset_tokens {
        VARCHAR id PK
        VARCHAR email
        VARCHAR token UK
        TIMESTAMPTZ expires_at
        BOOLEAN is_used
        TIMESTAMPTZ used_at
        TIMESTAMPTZ created_at
    }

    otp_verifications {
        VARCHAR id PK
        VARCHAR phone
        VARCHAR code
        ENUM_OtpPurpose purpose
        BOOLEAN is_used
        INT attempts
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ used_at
    }

    pending_guest_registrations {
        VARCHAR id PK
        VARCHAR phone UK
        VARCHAR email
        VARCHAR full_name
        TIMESTAMPTZ date_of_birth
        VARCHAR national_id FK
        VARCHAR passport_number
        VARCHAR emergency_contact_name
        VARCHAR emergency_contact_phone
        VARCHAR notes
        VARCHAR submitted_by_staff_id FK
        ENUM_PendingRegistrationStatus status
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    staff ||--o{ users : "created_by_staff_id"
    partners ||--o{ apartments : "partner_id"
    operators ||--o{ apartments : "approved_by_operator_id"
    apartments ||--o{ rooms : "apartment_id"
    apartments ||--o{ rental_contracts : "apartment_id"
    staff ||--o{ rental_contracts : "created_by_staff_id"
    users ||--o{ user_contract_members : "user_id"
    rental_contracts ||--o{ user_contract_members : "rental_contract_id"
    guests ||--o{ contact_requests : "guest_id"
    apartments ||--o{ contact_requests : "apartment_id"
    operators ||--o{ contact_requests : "assigned_to_operator_id"
    guests ||--o{ booking_requests : "guest_id"
    apartments ||--o{ booking_requests : "apartment_id"
    contact_requests ||--o{ booking_requests : "contact_request_id"
    operators ||--o{ booking_requests : "approved_by_operator_id"
    guests ||--o{ appointments : "guest_id"
    apartments ||--o{ appointments : "apartment_id"
    contact_requests ||--o{ appointments : "contact_request_id"
    staff ||--o{ appointments : "assigned_staff_id"
    partners ||--o{ partner_requests : "partner_id"
    operators ||--o{ partner_requests : "reviewed_by_operator_id"
    staff ||--o{ tasks : "assigned_to_staff_id"
    operators ||--o{ tasks : "assigned_by_operator_id"
    apartments ||--o{ tasks : "apartment_id"
    users ||--o{ maintenance_requests : "user_id"
    rental_contracts ||--o{ maintenance_requests : "rental_contract_id"
    apartments ||--o{ maintenance_requests : "apartment_id"
    rooms ||--o{ maintenance_requests : "room_id"
    tasks ||--|| maintenance_requests : "assigned_task_id"
    users ||--o{ tickets : "user_id"
    rental_contracts ||--o{ tickets : "rental_contract_id"
    staff ||--o{ tickets : "assigned_to_staff_id"
    rental_contracts ||--o{ invoices : "rental_contract_id"
    invoices ||--o{ payments : "invoice_id"
    users ||--o{ payments : "user_id"
    staff ||--o{ payments : "processed_by_staff_id"
    apartments ||--o{ iot_devices : "apartment_id"
    rooms ||--o{ iot_devices : "room_id"
    apartments ||--o{ utility_meters : "apartment_id"
    utility_meters ||--o{ utility_readings : "utility_meter_id"
    rental_contracts ||--o{ utility_readings : "rental_contract_id"
    staff ||--o{ utility_readings : "read_by_staff_id"
    staff ||--o{ utility_readings : "verified_by_staff_id"
    admins ||--o{ policies : "created_by_admin_id"
    admins ||--o{ policies : "approved_by_admin_id"
    admins ||--o{ legal_documents : "created_by_admin_id"
    staff ||--o{ staff_notes : "staff_id"
    users ||--o{ staff_notes : "user_id"
    staff ||--o{ pending_guest_registrations : "submitted_by_staff_id"
```
