-- =====================================================
-- IntelliRentOps Database Initialization Script
-- Database: PostgreSQL 15+
-- Version: 1.0.0
-- Author: Database Engineer
-- Created: 2026-01-21
-- Description: Complete database schema for property rental management platform
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For encryption functions

-- =====================================================
-- SECTION I: CUSTOM TYPES (ENUMS)
-- =====================================================

-- Actors & Authentication
CREATE TYPE preferred_contact_method_enum AS ENUM ('email', 'phone', 'both');
CREATE TYPE staff_role_enum AS ENUM ('technician', 'customer_service', 'maintenance', 'general');
CREATE TYPE operator_shift_enum AS ENUM ('morning', 'afternoon', 'night', 'flexible');
CREATE TYPE admin_role_level_enum AS ENUM ('super_admin', 'admin', 'manager');

-- Properties
CREATE TYPE furnishing_status_enum AS ENUM ('unfurnished', 'semi_furnished', 'fully_furnished');
CREATE TYPE apartment_status_enum AS ENUM ('available', 'occupied', 'maintenance', 'reserved', 'inactive');
CREATE TYPE room_type_enum AS ENUM ('bedroom', 'living_room', 'kitchen', 'bathroom', 'storage', 'balcony');
CREATE TYPE room_status_enum AS ENUM ('available', 'occupied', 'maintenance');

-- Contracts
CREATE TYPE contract_status_enum AS ENUM ('draft', 'pending', 'active', 'expired', 'terminated', 'renewed');
CREATE TYPE payment_method_contract_enum AS ENUM ('bank_transfer', 'cash', 'e_wallet', 'auto_debit');
CREATE TYPE member_type_enum AS ENUM ('primary', 'co_tenant', 'guarantor');
CREATE TYPE access_level_enum AS ENUM ('full', 'limited', 'view_only');
CREATE TYPE user_contract_status_enum AS ENUM ('active', 'moved_out', 'inactive');

-- Requests
CREATE TYPE contact_method_enum AS ENUM ('email', 'phone', 'whatsapp');
CREATE TYPE contact_source_enum AS ENUM ('website', 'mobile_app', 'social_media', 'referral', 'walk_in');
CREATE TYPE contact_status_enum AS ENUM ('new', 'contacted', 'scheduled', 'converted', 'lost', 'spam');
CREATE TYPE booking_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'expired');
CREATE TYPE appointment_type_enum AS ENUM ('physical_viewing', 'virtual_tour', 'consultation');
CREATE TYPE appointment_status_enum AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE appointment_outcome_enum AS ENUM ('interested', 'not_interested', 'needs_followup', 'booked');
CREATE TYPE property_type_enum AS ENUM ('apartment', 'house', 'condo', 'studio');
CREATE TYPE partner_contract_type_enum AS ENUM ('exclusive', 'non_exclusive');
CREATE TYPE partner_request_status_enum AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'on_hold');

-- Operations
CREATE TYPE task_type_enum AS ENUM ('followup', 'maintenance', 'inspection', 'delivery', 'cleaning', 'general');
CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status_enum AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE related_entity_type_enum AS ENUM ('contact_request', 'maintenance_request', 'appointment', 'inspection');
CREATE TYPE maintenance_category_enum AS ENUM ('plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'other');
CREATE TYPE urgency_enum AS ENUM ('low', 'medium', 'high', 'emergency');
CREATE TYPE time_slot_enum AS ENUM ('morning', 'afternoon', 'evening', 'anytime');
CREATE TYPE maintenance_status_enum AS ENUM ('submitted', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE cost_covered_by_enum AS ENUM ('landlord', 'tenant', 'insurance', 'warranty');
CREATE TYPE ticket_category_enum AS ENUM ('billing', 'contract', 'account', 'complaint', 'inquiry', 'documentation', 'other');
CREATE TYPE ticket_status_enum AS ENUM ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'escalated');

-- Financial
CREATE TYPE invoice_status_enum AS ENUM ('draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('bank_transfer', 'cash', 'e_wallet', 'credit_card', 'debit_card');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');

-- IoT & Devices
CREATE TYPE device_type_enum AS ENUM ('smart_lock', 'thermostat', 'light', 'camera', 'sensor', 'alarm', 'doorbell');
CREATE TYPE device_status_enum AS ENUM ('active', 'inactive', 'maintenance', 'error');
CREATE TYPE meter_type_enum AS ENUM ('electricity', 'water', 'gas', 'internet');
CREATE TYPE meter_status_enum AS ENUM ('active', 'inactive', 'faulty', 'replaced');
CREATE TYPE reading_type_enum AS ENUM ('manual', 'automatic', 'estimated');

-- Documents & Policies
CREATE TYPE policy_type_enum AS ENUM ('terms_of_service', 'privacy_policy', 'rental_rules', 'cancellation_policy', 'community_guidelines');
CREATE TYPE document_type_enum AS ENUM ('contract_template', 'addendum', 'disclosure', 'consent_form', 'inspection_report', 'other');

-- Audit & Logging
CREATE TYPE actor_type_enum AS ENUM ('guest', 'user', 'staff', 'operator', 'admin', 'partner', 'system');
CREATE TYPE action_status_enum AS ENUM ('success', 'failure', 'pending');
CREATE TYPE recipient_type_enum AS ENUM ('guest', 'user', 'staff', 'operator', 'admin', 'partner');
CREATE TYPE notification_type_enum AS ENUM ('info', 'warning', 'success', 'error', 'reminder', 'promotion');
CREATE TYPE channel_enum AS ENUM ('in_app', 'email', 'sms', 'push', 'webhook');
CREATE TYPE delivery_status_enum AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- =====================================================
-- SECTION II: CREATE TABLES
-- =====================================================

-- =====================================================
-- I. ACTORS & AUTHENTICATION
-- =====================================================

-- 1. Guest
CREATE TABLE "guest" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    full_name VARCHAR(255),
    preferred_contact_method preferred_contact_method_enum DEFAULT 'email',
    ip_address VARCHAR(45),
    session_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guest_session_token ON "guest"(session_token);

-- 2. Admin (created first as it's referenced by other tables)
CREATE TABLE "admin" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_level admin_role_level_enum DEFAULT 'admin',
    permissions JSONB,
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_role_level ON "admin"(role_level);
CREATE INDEX idx_admin_is_active ON "admin"(is_active);

-- 3. Partner
CREATE TABLE "partner" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    tax_code VARCHAR(50) UNIQUE,
    national_id VARCHAR(50),
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(100),
    address TEXT,
    contract_start_date DATE,
    contract_end_date DATE,
    commission_rate DECIMAL(5,2),
    payment_terms TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_partner_is_verified ON "partner"(is_verified);
CREATE INDEX idx_partner_is_active ON "partner"(is_active);

-- 4. Operator
CREATE TABLE "operator" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    shift operator_shift_enum,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operator_shift ON "operator"(shift);
CREATE INDEX idx_operator_is_active ON "operator"(is_active);

-- 5. Staff
CREATE TABLE "staff" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    role staff_role_enum NOT NULL,
    department VARCHAR(100),
    hire_date DATE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staff_role ON "staff"(role);
CREATE INDEX idx_staff_is_active ON "staff"(is_active);

-- 6. User (Tenant)
CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    national_id VARCHAR(50) UNIQUE,
    passport_number VARCHAR(50),
    profile_image_url TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_phone ON "user"(phone);
CREATE INDEX idx_user_created_by_staff_id ON "user"(created_by_staff_id);
CREATE INDEX idx_user_email_active ON "user"(email, is_active);
CREATE INDEX idx_user_phone_verified ON "user"(phone, is_verified);

-- =====================================================
-- II. ASSETS & PROPERTIES
-- =====================================================

-- 7. Apartment
CREATE TABLE "apartment" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_name VARCHAR(255),
    apartment_number VARCHAR(50) NOT NULL,
    floor_number INT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    ward VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    total_area DECIMAL(10,2) NOT NULL,
    usable_area DECIMAL(10,2),
    number_of_bedrooms INT DEFAULT 0,
    number_of_bathrooms INT DEFAULT 0,
    furnishing_status furnishing_status_enum,
    amenities JSONB,
    base_rent_price DECIMAL(12,2) NOT NULL,
    deposit_amount DECIMAL(12,2),
    status apartment_status_enum DEFAULT 'available',
    description TEXT,
    images JSONB,
    video_tour_url TEXT,
    year_built INT,
    partner_id UUID REFERENCES "partner"(id) ON DELETE SET NULL,
    approved_by_operator_id UUID REFERENCES "operator"(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apartment_status ON "apartment"(status);
CREATE INDEX idx_apartment_city ON "apartment"(city);
CREATE INDEX idx_apartment_district ON "apartment"(district);
CREATE INDEX idx_apartment_partner_id ON "apartment"(partner_id);
CREATE INDEX idx_apartment_base_rent_price ON "apartment"(base_rent_price);
CREATE INDEX idx_apartment_number_of_bedrooms ON "apartment"(number_of_bedrooms);
CREATE INDEX idx_apt_location_status ON "apartment"(city, district, status);
CREATE INDEX idx_apt_price_bedrooms ON "apartment"(base_rent_price, number_of_bedrooms, status);

-- 8. Room
CREATE TABLE "room" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    room_type room_type_enum,
    area DECIMAL(10,2),
    has_window BOOLEAN DEFAULT TRUE,
    has_air_conditioning BOOLEAN DEFAULT FALSE,
    has_private_bathroom BOOLEAN DEFAULT FALSE,
    max_occupancy INT DEFAULT 1,
    rent_price DECIMAL(12,2),
    status room_status_enum DEFAULT 'available',
    description TEXT,
    images JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(apartment_id, room_number)
);

CREATE INDEX idx_room_apartment_id ON "room"(apartment_id);
CREATE INDEX idx_room_status ON "room"(status);
CREATE INDEX idx_room_room_type ON "room"(room_type);

-- =====================================================
-- III. CONTRACTS & MEMBERSHIP
-- =====================================================

-- 9. RentalContract
CREATE TABLE "rental_contract" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(50) NOT NULL UNIQUE,
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_rent DECIMAL(12,2) NOT NULL,
    deposit_amount DECIMAL(12,2) NOT NULL,
    payment_due_day INT NOT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
    payment_method payment_method_contract_enum,
    utilities_included JSONB,
    utilities_charges JSONB,
    contract_terms TEXT,
    special_conditions TEXT,
    status contract_status_enum DEFAULT 'draft',
    signed_date DATE,
    contract_document_url TEXT,
    termination_date DATE,
    termination_reason TEXT,
    early_termination_fee DECIMAL(12,2),
    created_by_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rental_contract_apartment_id ON "rental_contract"(apartment_id);
CREATE INDEX idx_rental_contract_status ON "rental_contract"(status);
CREATE INDEX idx_rental_contract_start_date ON "rental_contract"(start_date);
CREATE INDEX idx_rental_contract_end_date ON "rental_contract"(end_date);
CREATE INDEX idx_contract_apt_dates ON "rental_contract"(apartment_id, start_date, end_date);
CREATE INDEX idx_contract_status_dates ON "rental_contract"(status, end_date, start_date);

-- 10. UserContractMember
CREATE TABLE "user_contract_member" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    rental_contract_id UUID NOT NULL REFERENCES "rental_contract"(id) ON DELETE CASCADE,
    member_type member_type_enum DEFAULT 'co_tenant',
    is_primary_contact BOOLEAN DEFAULT FALSE,
    move_in_date DATE,
    move_out_date DATE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    access_level access_level_enum DEFAULT 'full',
    share_percentage DECIMAL(5,2),
    status user_contract_status_enum DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, rental_contract_id)
);

CREATE INDEX idx_user_contract_member_user_id ON "user_contract_member"(user_id);
CREATE INDEX idx_user_contract_member_rental_contract_id ON "user_contract_member"(rental_contract_id);
CREATE INDEX idx_user_contract_member_status ON "user_contract_member"(status);

-- =====================================================
-- IV. REQUESTS & INQUIRIES
-- =====================================================

-- 11. ContactRequest
CREATE TABLE "contact_request" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES "guest"(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES "apartment"(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    preferred_move_in_date DATE,
    message TEXT,
    budget_range_min DECIMAL(12,2),
    budget_range_max DECIMAL(12,2),
    number_of_occupants INT,
    preferred_contact_method contact_method_enum,
    preferred_contact_time VARCHAR(100),
    source contact_source_enum,
    utm_source VARCHAR(100),
    utm_campaign VARCHAR(100),
    status contact_status_enum DEFAULT 'new',
    assigned_to_operator_id UUID REFERENCES "operator"(id) ON DELETE SET NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_contacted_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contact_request_guest_id ON "contact_request"(guest_id);
CREATE INDEX idx_contact_request_apartment_id ON "contact_request"(apartment_id);
CREATE INDEX idx_contact_request_status ON "contact_request"(status);
CREATE INDEX idx_contact_request_assigned_to_operator_id ON "contact_request"(assigned_to_operator_id);
CREATE INDEX idx_contact_request_received_at ON "contact_request"(received_at);
CREATE INDEX idx_contact_request_email ON "contact_request"(email);
CREATE INDEX idx_contact_request_phone ON "contact_request"(phone);

-- 12. BookingRequest
CREATE TABLE "booking_request" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES "guest"(id) ON DELETE SET NULL,
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE RESTRICT,
    contact_request_id UUID REFERENCES "contact_request"(id) ON DELETE SET NULL,
    desired_start_date DATE NOT NULL,
    desired_end_date DATE NOT NULL,
    number_of_occupants INT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    deposit_amount DECIMAL(12,2) NOT NULL,
    special_requests TEXT,
    identification_documents JSONB,
    employment_verification JSONB,
    status booking_status_enum DEFAULT 'pending',
    rejection_reason TEXT,
    approved_by_operator_id UUID REFERENCES "operator"(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_rental_contract_id UUID REFERENCES "rental_contract"(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_request_guest_id ON "booking_request"(guest_id);
CREATE INDEX idx_booking_request_apartment_id ON "booking_request"(apartment_id);
CREATE INDEX idx_booking_request_status ON "booking_request"(status);
CREATE INDEX idx_booking_request_contact_request_id ON "booking_request"(contact_request_id);
CREATE INDEX idx_booking_request_created_rental_contract_id ON "booking_request"(created_rental_contract_id);

-- 13. Appointment
CREATE TABLE "appointment" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES "guest"(id) ON DELETE SET NULL,
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE RESTRICT,
    contact_request_id UUID REFERENCES "contact_request"(id) ON DELETE SET NULL,
    assigned_staff_id UUID NOT NULL REFERENCES "staff"(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    meeting_location TEXT,
    type appointment_type_enum DEFAULT 'physical_viewing',
    status appointment_status_enum DEFAULT 'scheduled',
    guest_notes TEXT,
    staff_notes TEXT,
    outcome appointment_outcome_enum,
    followup_required BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointment_guest_id ON "appointment"(guest_id);
CREATE INDEX idx_appointment_apartment_id ON "appointment"(apartment_id);
CREATE INDEX idx_appointment_assigned_staff_id ON "appointment"(assigned_staff_id);
CREATE INDEX idx_appointment_status ON "appointment"(status);
CREATE INDEX idx_appointment_date ON "appointment"(appointment_date);
CREATE INDEX idx_appointment_time ON "appointment"(appointment_time);

-- 14. PartnerRequest
CREATE TABLE "partner_request" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES "partner"(id) ON DELETE CASCADE,
    property_type property_type_enum,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    total_area DECIMAL(10,2),
    number_of_units INT DEFAULT 1,
    expected_rent_price DECIMAL(12,2),
    property_images JSONB,
    property_documents JSONB,
    description TEXT,
    amenities JSONB,
    preferred_contract_type partner_contract_type_enum,
    status partner_request_status_enum DEFAULT 'submitted',
    reviewed_by_operator_id UUID REFERENCES "operator"(id) ON DELETE SET NULL,
    review_notes TEXT,
    rejection_reason TEXT,
    approved_at TIMESTAMP,
    created_apartment_ids JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_partner_request_partner_id ON "partner_request"(partner_id);
CREATE INDEX idx_partner_request_status ON "partner_request"(status);
CREATE INDEX idx_partner_request_reviewed_by_operator_id ON "partner_request"(reviewed_by_operator_id);
CREATE INDEX idx_partner_request_city ON "partner_request"(city);
CREATE INDEX idx_partner_request_district ON "partner_request"(district);

-- =====================================================
-- V. OPERATIONS & MAINTENANCE
-- =====================================================

-- 15. Task
CREATE TABLE "task" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type task_type_enum NOT NULL,
    priority priority_enum DEFAULT 'medium',
    status task_status_enum DEFAULT 'pending',
    assigned_to_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    assigned_by_operator_id UUID REFERENCES "operator"(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES "apartment"(id) ON DELETE SET NULL,
    related_entity_type related_entity_type_enum,
    related_entity_id UUID,
    scheduled_date DATE,
    scheduled_time TIME,
    estimated_duration_minutes INT,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    completion_notes TEXT,
    attachments JSONB,
    requires_followup BOOLEAN DEFAULT FALSE,
    followup_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_assigned_to_staff_id ON "task"(assigned_to_staff_id);
CREATE INDEX idx_task_assigned_by_operator_id ON "task"(assigned_by_operator_id);
CREATE INDEX idx_task_status ON "task"(status);
CREATE INDEX idx_task_task_type ON "task"(task_type);
CREATE INDEX idx_task_priority ON "task"(priority);
CREATE INDEX idx_task_scheduled_date ON "task"(scheduled_date);
CREATE INDEX idx_task_apartment_id ON "task"(apartment_id);
CREATE INDEX idx_task_staff_status ON "task"(assigned_to_staff_id, status, scheduled_date);
CREATE INDEX idx_task_priority_status ON "task"(priority, status, created_at);

-- 16. MaintenanceRequest
CREATE TABLE "maintenance_request" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    rental_contract_id UUID NOT NULL REFERENCES "rental_contract"(id) ON DELETE RESTRICT,
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE RESTRICT,
    room_id UUID REFERENCES "room"(id) ON DELETE SET NULL,
    category maintenance_category_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    urgency urgency_enum DEFAULT 'medium',
    images JSONB,
    preferred_date DATE,
    preferred_time_slot time_slot_enum,
    is_tenant_present_required BOOLEAN DEFAULT FALSE,
    status maintenance_status_enum DEFAULT 'submitted',
    assigned_task_id UUID REFERENCES "task"(id) ON DELETE SET NULL,
    completion_images JSONB,
    completion_notes TEXT,
    tenant_rating INT CHECK (tenant_rating >= 1 AND tenant_rating <= 5),
    tenant_feedback TEXT,
    cost_estimate DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    cost_covered_by cost_covered_by_enum,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_request_user_id ON "maintenance_request"(user_id);
CREATE INDEX idx_maintenance_request_rental_contract_id ON "maintenance_request"(rental_contract_id);
CREATE INDEX idx_maintenance_request_apartment_id ON "maintenance_request"(apartment_id);
CREATE INDEX idx_maintenance_request_status ON "maintenance_request"(status);
CREATE INDEX idx_maintenance_request_category ON "maintenance_request"(category);
CREATE INDEX idx_maintenance_request_urgency ON "maintenance_request"(urgency);
CREATE INDEX idx_maintenance_apt_status ON "maintenance_request"(apartment_id, status, created_at);
CREATE INDEX idx_maintenance_urgency ON "maintenance_request"(urgency, status, created_at);

-- 17. Ticket
CREATE TABLE "ticket" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    rental_contract_id UUID NOT NULL REFERENCES "rental_contract"(id) ON DELETE RESTRICT,
    category ticket_category_enum NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority priority_enum DEFAULT 'medium',
    status ticket_status_enum DEFAULT 'open',
    assigned_to_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    attachments JSONB,
    resolution_notes TEXT,
    satisfaction_rating INT CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    satisfaction_feedback TEXT,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_user_id ON "ticket"(user_id);
CREATE INDEX idx_ticket_rental_contract_id ON "ticket"(rental_contract_id);
CREATE INDEX idx_ticket_status ON "ticket"(status);
CREATE INDEX idx_ticket_category ON "ticket"(category);
CREATE INDEX idx_ticket_priority ON "ticket"(priority);
CREATE INDEX idx_ticket_assigned_to_staff_id ON "ticket"(assigned_to_staff_id);

-- =====================================================
-- VI. FINANCIAL
-- =====================================================

-- 18. Invoice
CREATE TABLE "invoice" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    rental_contract_id UUID NOT NULL REFERENCES "rental_contract"(id) ON DELETE RESTRICT,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    base_rent DECIMAL(12,2) NOT NULL,
    utility_charges JSONB,
    additional_charges JSONB,
    discounts JSONB,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    status invoice_status_enum DEFAULT 'draft',
    payment_method payment_method_enum,
    invoice_document_url TEXT,
    notes TEXT,
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_rental_contract_id ON "invoice"(rental_contract_id);
CREATE INDEX idx_invoice_status ON "invoice"(status);
CREATE INDEX idx_invoice_due_date ON "invoice"(due_date);
CREATE INDEX idx_invoice_billing_period_start ON "invoice"(billing_period_start);
CREATE INDEX idx_invoice_billing_period_end ON "invoice"(billing_period_end);
CREATE INDEX idx_invoice_contract_status ON "invoice"(rental_contract_id, status, due_date);
CREATE INDEX idx_invoice_overdue ON "invoice"(status, due_date) WHERE status != 'paid';

-- 19. Payment
CREATE TABLE "payment" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    invoice_id UUID NOT NULL REFERENCES "invoice"(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    payment_method payment_method_enum NOT NULL,
    payment_gateway VARCHAR(100),
    transaction_id VARCHAR(255),
    payment_date TIMESTAMP NOT NULL,
    status payment_status_enum DEFAULT 'pending',
    payment_proof_url TEXT,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    notes TEXT,
    processed_by_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    refund_amount DECIMAL(12,2),
    refund_date TIMESTAMP,
    refund_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_invoice_id ON "payment"(invoice_id);
CREATE INDEX idx_payment_user_id ON "payment"(user_id);
CREATE INDEX idx_payment_status ON "payment"(status);
CREATE INDEX idx_payment_payment_date ON "payment"(payment_date);
CREATE INDEX idx_payment_transaction_id ON "payment"(transaction_id);

-- =====================================================
-- VII. DEVICES & IOT
-- =====================================================

-- 20. IoTDevice
CREATE TABLE "iot_device" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_name VARCHAR(255) NOT NULL,
    device_type device_type_enum NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    mac_address VARCHAR(50),
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE CASCADE,
    room_id UUID REFERENCES "room"(id) ON DELETE SET NULL,
    location_description VARCHAR(255),
    firmware_version VARCHAR(50),
    status device_status_enum DEFAULT 'active',
    is_controllable_by_tenant BOOLEAN DEFAULT TRUE,
    last_online_at TIMESTAMP,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    installation_date DATE,
    warranty_expiry_date DATE,
    configuration JSONB,
    access_logs_enabled BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_iot_device_apartment_id ON "iot_device"(apartment_id);
CREATE INDEX idx_iot_device_room_id ON "iot_device"(room_id);
CREATE INDEX idx_iot_device_device_type ON "iot_device"(device_type);
CREATE INDEX idx_iot_device_status ON "iot_device"(status);
CREATE INDEX idx_iot_device_mac_address ON "iot_device"(mac_address);

-- 21. UtilityMeter
CREATE TABLE "utility_meter" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meter_number VARCHAR(100) NOT NULL UNIQUE,
    meter_type meter_type_enum NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    apartment_id UUID NOT NULL REFERENCES "apartment"(id) ON DELETE CASCADE,
    installation_date DATE NOT NULL,
    last_inspection_date DATE,
    next_inspection_date DATE,
    unit_of_measurement VARCHAR(20),
    rate_per_unit DECIMAL(10,2),
    current_reading DECIMAL(12,2),
    previous_reading DECIMAL(12,2),
    reading_date DATE,
    status meter_status_enum DEFAULT 'active',
    is_digital BOOLEAN DEFAULT FALSE,
    calibration_date DATE,
    next_calibration_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_utility_meter_apartment_id ON "utility_meter"(apartment_id);
CREATE INDEX idx_utility_meter_meter_type ON "utility_meter"(meter_type);
CREATE INDEX idx_utility_meter_status ON "utility_meter"(status);
CREATE INDEX idx_utility_meter_reading_date ON "utility_meter"(reading_date);

-- 22. UtilityReading
CREATE TABLE "utility_reading" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utility_meter_id UUID NOT NULL REFERENCES "utility_meter"(id) ON DELETE CASCADE,
    rental_contract_id UUID REFERENCES "rental_contract"(id) ON DELETE SET NULL,
    reading_date DATE NOT NULL,
    reading_value DECIMAL(12,2) NOT NULL,
    previous_reading_value DECIMAL(12,2),
    consumption DECIMAL(12,2),
    reading_type reading_type_enum,
    read_by_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    images JSONB,
    notes TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_staff_id UUID REFERENCES "staff"(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_utility_reading_utility_meter_id ON "utility_reading"(utility_meter_id);
CREATE INDEX idx_utility_reading_rental_contract_id ON "utility_reading"(rental_contract_id);
CREATE INDEX idx_utility_reading_reading_date ON "utility_reading"(reading_date);
CREATE INDEX idx_utility_reading_read_by_staff_id ON "utility_reading"(read_by_staff_id);
CREATE INDEX idx_utility_reading_reading_type ON "utility_reading"(reading_type);

-- =====================================================
-- VIII. DOCUMENTS & POLICIES
-- =====================================================

-- 23. Policy
CREATE TABLE "policy" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_type policy_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    language VARCHAR(10) DEFAULT 'vi',
    effective_date DATE NOT NULL,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    requires_acceptance BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_by_admin_id UUID REFERENCES "admin"(id) ON DELETE SET NULL,
    approved_by_admin_id UUID REFERENCES "admin"(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policy_policy_type ON "policy"(policy_type);
CREATE INDEX idx_policy_is_active ON "policy"(is_active);
CREATE INDEX idx_policy_effective_date ON "policy"(effective_date);
CREATE INDEX idx_policy_version ON "policy"(version);
CREATE INDEX idx_policy_language ON "policy"(language);

-- 24. LegalDocument
CREATE TABLE "legal_document" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type document_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    category VARCHAR(100),
    language VARCHAR(10) DEFAULT 'vi',
    version VARCHAR(20),
    is_template BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    tags JSONB,
    effective_date DATE,
    created_by_admin_id UUID REFERENCES "admin"(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_legal_document_document_type ON "legal_document"(document_type);
CREATE INDEX idx_legal_document_category ON "legal_document"(category);
CREATE INDEX idx_legal_document_is_public ON "legal_document"(is_public);
CREATE INDEX idx_legal_document_is_template ON "legal_document"(is_template);
CREATE INDEX idx_legal_document_language ON "legal_document"(language);

-- =====================================================
-- IX. AUDIT & LOGGING
-- =====================================================

-- 25. ActivityLog
CREATE TABLE "activity_log" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_type actor_type_enum NOT NULL,
    actor_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    description TEXT,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    status action_status_enum,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_actor_type ON "activity_log"(actor_type);
CREATE INDEX idx_activity_log_actor_id ON "activity_log"(actor_id);
CREATE INDEX idx_activity_log_created_at ON "activity_log"(created_at);
CREATE INDEX idx_activity_log_entity_type ON "activity_log"(entity_type);
CREATE INDEX idx_activity_log_entity_id ON "activity_log"(entity_id);
CREATE INDEX idx_activity_log_action ON "activity_log"(action);
CREATE INDEX idx_activity_log_status ON "activity_log"(status);
CREATE INDEX idx_activity_actor_date ON "activity_log"(actor_type, actor_id, created_at);
CREATE INDEX idx_activity_entity_date ON "activity_log"(entity_type, entity_id, created_at);

-- 26. Notification
CREATE TABLE "notification" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type recipient_type_enum NOT NULL,
    recipient_id UUID NOT NULL,
    notification_type notification_type_enum,
    channel channel_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    action_label VARCHAR(100),
    priority priority_enum DEFAULT 'medium',
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivery_status delivery_status_enum,
    failure_reason TEXT,
    retry_count INT DEFAULT 0,
    metadata JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_recipient_type ON "notification"(recipient_type);
CREATE INDEX idx_notification_recipient_id ON "notification"(recipient_id);
CREATE INDEX idx_notification_is_read ON "notification"(is_read);
CREATE INDEX idx_notification_notification_type ON "notification"(notification_type);
CREATE INDEX idx_notification_channel ON "notification"(channel);
CREATE INDEX idx_notification_sent_at ON "notification"(sent_at);
CREATE INDEX idx_notification_delivery_status ON "notification"(delivery_status);
CREATE INDEX idx_notification_created_at ON "notification"(created_at);

-- =====================================================
-- SECTION III: TRIGGERS FOR updated_at
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_guest_updated_at BEFORE UPDATE ON "guest" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON "staff" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operator_updated_at BEFORE UPDATE ON "operator" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_updated_at BEFORE UPDATE ON "admin" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_updated_at BEFORE UPDATE ON "partner" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apartment_updated_at BEFORE UPDATE ON "apartment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_updated_at BEFORE UPDATE ON "room" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rental_contract_updated_at BEFORE UPDATE ON "rental_contract" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_contract_member_updated_at BEFORE UPDATE ON "user_contract_member" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_request_updated_at BEFORE UPDATE ON "contact_request" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_request_updated_at BEFORE UPDATE ON "booking_request" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointment_updated_at BEFORE UPDATE ON "appointment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_request_updated_at BEFORE UPDATE ON "partner_request" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_updated_at BEFORE UPDATE ON "task" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_request_updated_at BEFORE UPDATE ON "maintenance_request" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ticket_updated_at BEFORE UPDATE ON "ticket" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_updated_at BEFORE UPDATE ON "invoice" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON "payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iot_device_updated_at BEFORE UPDATE ON "iot_device" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_utility_meter_updated_at BEFORE UPDATE ON "utility_meter" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_utility_reading_updated_at BEFORE UPDATE ON "utility_reading" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policy_updated_at BEFORE UPDATE ON "policy" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_legal_document_updated_at BEFORE UPDATE ON "legal_document" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_updated_at BEFORE UPDATE ON "notification" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECTION IV: COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE "guest" IS 'Web visitors who have not yet signed a rental contract. They can browse listings and submit inquiries.';
COMMENT ON TABLE "user" IS 'Tenants who have signed rental contracts and use the mobile app. Multiple users can share one apartment.';
COMMENT ON TABLE "staff" IS 'Employees who handle appointments, maintenance, and tenant support.';
COMMENT ON TABLE "operator" IS 'Personnel who receive and assign requests from guests and coordinate operations.';
COMMENT ON TABLE "admin" IS 'System administrators with full access to manage users, staff, operators, and properties.';
COMMENT ON TABLE "partner" IS 'Property owners who submit their apartments for rental management.';
COMMENT ON TABLE "apartment" IS 'Rental units that can contain multiple rooms. Each apartment has a unique address and specifications.';
COMMENT ON TABLE "room" IS 'Individual rooms within an apartment. Used for properties with multiple rentable rooms.';
COMMENT ON TABLE "rental_contract" IS 'Legal agreements between tenants and the rental service. Multiple users can be associated with one contract.';
COMMENT ON TABLE "user_contract_member" IS 'Junction table linking users to rental contracts. Supports multiple tenants per apartment scenario.';
COMMENT ON TABLE "contact_request" IS 'Initial inquiries from guests interested in renting. First touchpoint in the customer journey.';
COMMENT ON TABLE "booking_request" IS 'Formal requests to reserve an apartment. Leads to contract creation if approved.';
COMMENT ON TABLE "appointment" IS 'Scheduled property viewings arranged between guests and staff.';
COMMENT ON TABLE "partner_request" IS 'Submissions from property owners wanting to list their apartments for rental.';
COMMENT ON TABLE "task" IS 'Work assignments for staff, including follow-ups, maintenance, inspections, and general duties.';
COMMENT ON TABLE "maintenance_request" IS 'Repair and maintenance issues reported by tenants via mobile app.';
COMMENT ON TABLE "ticket" IS 'General support requests from tenants regarding non-maintenance issues (billing, documents, questions).';
COMMENT ON TABLE "invoice" IS 'Monthly rental bills and additional charges generated for each contract.';
COMMENT ON TABLE "payment" IS 'Records of actual payments made by tenants for invoices.';
COMMENT ON TABLE "iot_device" IS 'Smart home devices installed in apartments (locks, lights, thermostats, cameras).';
COMMENT ON TABLE "utility_meter" IS 'Meters tracking utility consumption (electricity, water, gas) for billing purposes.';
COMMENT ON TABLE "utility_reading" IS 'Historical records of meter readings for tracking consumption over time.';
COMMENT ON TABLE "policy" IS 'Terms of service, privacy policies, rental rules displayed to guests and users.';
COMMENT ON TABLE "legal_document" IS 'Legal forms, templates, and compliance documents (contracts, addendums, disclosures).';
COMMENT ON TABLE "activity_log" IS 'System-wide audit trail for tracking user actions and system events.';
COMMENT ON TABLE "notification" IS 'In-app notifications, push notifications, SMS, and email messages sent to users.';

-- =====================================================
-- END OF INITIALIZATION SCRIPT
-- =====================================================

-- To verify the database was created correctly, run:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
