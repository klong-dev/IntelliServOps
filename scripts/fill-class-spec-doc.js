const { chromium } = require(require.resolve('playwright-core', {
  paths: [process.env.TEMP + '\\pw-gdocs', process.cwd()],
}));

const sections = [
  {
    id: '3.1.1.3',
    navText: '3.1.1.3. Class Specification',
    mode: 'replace',
    replace: { from: [408, 223], to: [1007, 446] },
    controllerTitle: 'ApartmentsController',
    controllerRows: [
      ['create()', 'Accepts apartment creation payload with optional media files and delegates persistence to the service.'],
      ['uploadApartmentMediaFiles()', 'Uploads validated image and video files first so the create flow can store final media URLs.'],
    ],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['create()', 'Creates the apartment record, connects amenities, normalizes media URLs, and returns the created apartment.'],
      ['validateAmenityIds()', 'Verifies every submitted amenity ID exists before relation mapping is persisted.'],
      ['generateUniqueApartmentSlug()', 'Builds a unique frontend-friendly slug from the apartment naming source.'],
    ],
    dtoTitle: 'CreateApartmentDto / CreateApartmentRequestDto',
    dtoRows: [
      ['buildingName + apartmentNumber', 'Define the apartment identity used for listing, display, and slug generation.'],
      ['wardCode + streetAddress', 'Capture structured location data so the service can enrich the full address later.'],
      ['totalArea + usableArea + maxOccupants', 'Validate capacity and physical dimensions before the apartment is published.'],
      ['amenityIds', 'Allow related amenities to be attached in the same create request.'],
      ['images + video', 'Support multipart listing media through the request wrapper used by the controller.'],
    ],
  },
  {
    id: '3.1.2.3',
    navText: '3.1.2.3. Class Specification',
    mode: 'replace',
    replace: { from: [401, 205], to: [1004, 344] },
    controllerTitle: 'ApartmentsController',
    controllerRows: [
      ['update()', 'Receives partial apartment changes and optional replacement media, then forwards the update command to the service.'],
      ['uploadApartmentMediaFiles()', 'Uploads new image or video assets so the update flow can replace stale media URLs safely.'],
    ],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['update()', 'Applies partial field updates, refreshes related amenities/media, and returns the updated apartment record.'],
      ['normalizeApartmentMediaFields()', 'Keeps image and video fields consistent when request data mixes existing and newly uploaded media.'],
      ['generateUniqueApartmentSlug()', 'Regenerates a unique slug when apartment naming data is changed.'],
    ],
    dtoTitle: 'UpdateApartmentDto / UpdateApartmentRequestDto',
    dtoRows: [
      ['inherits CreateApartmentDto as optional fields', 'Makes apartment creation attributes reusable for patch operations without forcing full payloads.'],
      ['status', 'Allows privileged actors to move the apartment between lifecycle states.'],
      ['images + video', 'Carry replacement media files in multipart form-data when the listing assets are updated.'],
      ['amenityIds', 'Support relationship refresh when apartment amenities need to be changed.'],
    ],
  },
  {
    id: '3.1.3.3',
    navText: '3.1.3. Delete Apartment',
    mode: 'insert',
    anchor: [615, 998],
    controllerTitle: 'ApartmentsController',
    controllerRows: [['remove()', 'Handles the delete endpoint and delegates the apartment removal policy to the service layer.']],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['remove()', 'Implements soft delete by marking the apartment inactive instead of removing the database row.'],
      ['updateStatus()', 'Provides reusable status-transition logic for apartment lifecycle updates in operator workflows.'],
    ],
    dtoTitle: 'Delete Apartment Response Shape',
    dtoRows: [
      ['id', 'Returns the deleted apartment identifier so the client can remove the correct item from UI state.'],
      ['apartmentNumber', 'Keeps the deleted apartment human-readable in audit, toast, or confirmation messages.'],
      ['status', 'Confirms the soft-delete result by returning inactive as the final apartment state.'],
    ],
  },
  {
    id: '3.2.1.3',
    navText: '3.2.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ApartmentsController',
    controllerRows: [
      ['submitPartnerCooperation()', 'Receives a partner cooperation submission with apartment metadata and optional media.'],
      ['uploadApartmentMediaFiles()', 'Stores cooperation images and video so the submission can reference stable media URLs.'],
    ],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['submitPartnerCooperation()', 'Creates a cooperation apartment draft after checking partner identity and apartment data validity.'],
      ['validateAmenityIds()', 'Validates amenity references used in the partner-submitted apartment payload.'],
      ['generateUniqueApartmentSlug()', 'Generates a consistent slug even for apartments entering from the cooperation flow.'],
    ],
    dtoTitle: 'CreatePartnerCooperationApartmentDto / SubmitPartnerCooperationRequestDto',
    dtoRows: [
      ['inherits CreateApartmentDto except ownerId and media URL fields', 'Reuses apartment business fields while preventing partners from setting restricted values directly.'],
      ['images', 'Accepts up to 10 cooperation apartment images in the submit step.'],
      ['video', 'Accepts one apartment video file so the unit can be reviewed before approval.'],
      ['partner identity prerequisite', 'The service requires the submitting partner to have verified identity before continuing.'],
    ],
  },
  {
    id: '3.2.2.3',
    navText: '3.2.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ApartmentsController',
    controllerRows: [['uploadCooperationMedia()', 'Allows staff or the partner to upload missing cooperation images/video and optional metadata corrections.']],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['uploadCooperationMedia()', 'Updates media, merges optional apartment field changes, and promotes the apartment when required assets are complete.'],
      ['normalizeApartmentMediaFields()', 'Ensures image and video fields remain normalized after repeated cooperation media uploads.'],
    ],
    dtoTitle: 'UpdatePartnerCooperationApartmentInUploadDto / UploadPartnerCooperationMediaRequestDto',
    dtoRows: [
      ['partial apartment fields', 'Permit staff to correct apartment information while uploading cooperation media.'],
      ['images', 'Carry cooperation apartment images in multipart form-data.'],
      ['video', 'Carry the required apartment tour video in multipart form-data.'],
      ['status exclusion', 'The DTO intentionally excludes direct status edits so lifecycle changes stay in service logic.'],
    ],
  },
  {
    id: '3.2.3.3',
    navText: '3.2.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ApartmentsController',
    controllerRows: [
      ['approvePartnerCooperation()', 'Approves a cooperation apartment after staff has completed the required media package.'],
      ['rejectPartnerCooperation()', 'Rejects a cooperation apartment and records the operator reason sent back to the partner.'],
    ],
    serviceTitle: 'ApartmentsService',
    serviceRows: [
      ['approvePartnerCooperation()', 'Moves the apartment into the next lifecycle stage and generates the cooperation contract package.'],
      ['rejectPartnerCooperation()', 'Marks the apartment inactive, stores the rejection reason, and triggers partner notification.'],
      ['generateCooperationContractNumber()', 'Generates the contract number used when approval creates a cooperation contract draft.'],
    ],
    dtoTitle: 'ApprovePartnerCooperationResultDto / RejectPartnerCooperationApartmentDto',
    dtoRows: [
      ['reason', 'Captures the operator justification when a cooperation apartment is rejected.'],
      ['cooperationContractId + cooperationContractNumber', 'Returned on approval so downstream contract review can start immediately.'],
      ['status + rejectedAt', 'Expose the resulting apartment lifecycle state after approval or rejection.'],
    ],
  },
  {
    id: '3.2.4.3',
    navText: '3.2.4.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ContractsController',
    controllerRows: [['signCooperationContract()', 'Accepts the signed cooperation contract PDF and the optional signing timestamp from the partner.']],
    serviceTitle: 'ContractsService',
    serviceRows: [
      ['signCooperationContract()', 'Stores the signed cooperation document, updates contract status, and returns the signed contract payload.'],
      ['generatePdfToken()', 'Creates public-view tokens so the signed cooperation PDF can be reviewed externally when needed.'],
    ],
    dtoTitle: 'SignCooperationContractDto',
    dtoRows: [
      ['contractPdf', 'Carries the signed cooperation contract file in multipart form-data.'],
      ['signedDate', 'Allows the client to preserve the actual contract signing timestamp.'],
      ['controller validation', 'The controller rejects missing or invalid contract files before service execution.'],
    ],
  },
  {
    id: '3.2.5.3',
    navText: '3.2.5.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ContractsController',
    controllerRows: [['cancelCooperationContract()', 'Handles partner cancellation requests for a cooperation contract that should no longer continue.']],
    serviceTitle: 'ContractsService',
    serviceRows: [
      ['cancelCooperationContract()', 'Cancels the cooperation contract, records the reason, and reverts apartment state as required by the business flow.'],
      ['findOne()', 'Provides the contract lookup used before cancellation is validated and executed.'],
    ],
    dtoTitle: 'CancelCooperationContractDto',
    dtoRows: [
      ['reason', 'Stores the cancellation explanation sent by the partner.'],
      ['optional payload', 'Allows cancellation even when only the contract identity is supplied in the route.'],
      ['result fields', 'The result payload returns apartment and cooperation contract status after cancellation.'],
    ],
  },
  {
    id: '3.3.1.3',
    navText: '3.3.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ViewingRequestsController',
    controllerRows: [['createUserViewingBooking()', 'Creates a viewing booking for the current user with apartment, time, and optional note input.']],
    serviceTitle: 'ViewingRequestsService',
    serviceRows: [
      ['createUserViewingBooking()', 'Builds the appointment, chooses staff, and stores the booking in a single viewing workflow.'],
      ['assignStaff()', 'Selects an available staff member for the requested appointment slot.'],
      ['ensureApartmentSlotAvailable()', 'Prevents overlapping viewing appointments for the same apartment.'],
    ],
    dtoTitle: 'CreateUserViewingRequestDto',
    dtoRows: [
      ['apartmentId', 'Identifies the apartment the user wants to view.'],
      ['appointmentAt', 'Supplies the requested visit date-time in ISO format.'],
      ['durationMinutes', 'Lets the user override the default visit length within allowed bounds.'],
      ['note', 'Carries optional context that staff can read before the appointment.'],
    ],
  },
  {
    id: '3.3.2.3',
    navText: '3.3.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ViewingRequestsController',
    controllerRows: [['acceptViewingRequest()', 'Allows the assigned staff member to confirm a pending viewing appointment.']],
    serviceTitle: 'ViewingRequestsService',
    serviceRows: [
      ['acceptViewingRequest()', 'Maps the staff acceptance command to the common confirmation workflow.'],
      ['confirmAppointment()', 'Validates ownership/status, marks the appointment confirmed, and emits notification events.'],
    ],
    dtoTitle: 'StaffAcceptViewingRequestDto',
    dtoRows: [
      ['appointmentId', 'Targets the appointment that the assigned staff member is confirming.'],
      ['staff ownership check', 'The service only accepts the request when the current staff is assigned to that appointment.'],
      ['confirmed response', 'The endpoint returns the updated appointment detail after confirmation.'],
    ],
  },
  {
    id: '3.3.3.3',
    navText: '3.3.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ViewingRequestsController',
    controllerRows: [['denyViewingRequest()', 'Lets the assigned staff reject a viewing appointment and attach an optional reason.']],
    serviceTitle: 'ViewingRequestsService',
    serviceRows: [
      ['denyViewingRequest()', 'Changes the appointment to cancelled, stores the denial reason, and notifies the user.'],
      ['cancelAppointment()', 'Provides shared cancellation behavior used when appointment state must be transitioned safely.'],
    ],
    dtoTitle: 'StaffDenyViewingRequestDto',
    dtoRows: [
      ['appointmentId', 'Identifies the viewing appointment being denied.'],
      ['reason', 'Stores the staff explanation shown back to the user.'],
      ['status guard', 'The service rejects denial requests for already confirmed or completed appointments.'],
    ],
  },
  {
    id: '3.3.4.3',
    navText: '3.3.4.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ViewingRequestsController',
    controllerRows: [['confirmDoneJob()', 'Marks a viewing appointment as completed once the assigned staff finishes the visit.']],
    serviceTitle: 'ViewingRequestsService',
    serviceRows: [['confirmDoneJob()', 'Validates assignment and updates the appointment outcome to completed with optional staff note.']],
    dtoTitle: 'DoneViewingRequestDto',
    dtoRows: [
      ['note', 'Captures optional staff remarks when the appointment is completed.'],
      ['assigned-staff rule', 'Only the staff member assigned to the appointment can complete the job.'],
      ['completed response', 'Returns the full appointment detail after completion is saved.'],
    ],
  },
  {
    id: '3.3.5.3',
    navText: '3.3.5.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ViewingRequestsController',
    controllerRows: [['cancelAppointment()', 'Lets either the assigned staff or the appointment owner cancel the viewing request.']],
    serviceTitle: 'ViewingRequestsService',
    serviceRows: [['cancelAppointment()', 'Applies actor-based permission checks, stores the cancellation note, and marks the appointment cancelled.']],
    dtoTitle: 'CancelViewingRequestDto',
    dtoRows: [
      ['note', 'Carries the optional cancellation explanation stored with the appointment.'],
      ['actor permission rule', 'Cancellation is restricted to the assigned staff member or the booking owner.'],
      ['cancelled response', 'Returns the appointment after the cancellation state is persisted.'],
    ],
  },
  {
    id: '3.4.1.3',
    navText: '3.4.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ReservationsController',
    controllerRows: [['create()', 'Starts the reservation flow and delegates creation of both reservation and draft contract to the service.']],
    serviceTitle: 'ReservationsService',
    serviceRows: [
      ['create()', 'Creates the reservation, draft rental contract, and initial contract members in one transaction.'],
      ['generateContractNumber()', 'Generates the draft rental contract number linked to the new reservation.'],
    ],
    dtoTitle: 'CreateReservationDto',
    dtoRows: [
      ['apartmentId', 'Targets the apartment the user wants to reserve.'],
      ['desiredStartDate + desiredEndDate', 'Define the expected rental period used to build the draft contract.'],
      ['numberOfOccupants', 'Captures occupancy demand for validation against apartment capacity.'],
      ['additionalMemberNationalIds', 'Allow extra verified members to be inserted into the draft contract immediately.'],
      ['specialRequests', 'Stores free-form notes that staff can review during contract preparation.'],
    ],
  },
  {
    id: '3.4.2.3',
    navText: '3.4.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ContractsController',
    controllerRows: [['uploadSignedPdf()', 'Receives the signed rental contract PDF and optional signing metadata from the user workflow.']],
    serviceTitle: 'ContractsService',
    serviceRows: [
      ['uploadSignedPdf()', 'Stores the signed document, updates contract signing state, and returns contract detail data.'],
      ['createDepositInvoiceForSignedContract()', 'Creates the deposit invoice right after a contract is signed so payment can begin.'],
      ['regenerateContractPdf()', 'Keeps the generated contract PDF synchronized with the latest contract data before or after signing.'],
    ],
    dtoTitle: 'UploadContractPdfDto',
    dtoRows: [
      ['contractPdf', 'Carries the signed rental contract file in multipart form-data.'],
      ['signedDate', 'Preserves the official signing timestamp for the contract record.'],
      ['contractDocumentUrl', 'Allows an existing external document URL to be attached when required by the workflow.'],
    ],
  },
  {
    id: '3.4.3.3',
    navText: '3.4.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'PaymentsController',
    controllerRows: [
      ['createPayOSPaymentLink()', 'Creates a PayOS checkout session for the deposit invoice selected by the client.'],
      ['handlePayOSWebhook()', 'Receives asynchronous PayOS confirmation events after the deposit payment is completed.'],
    ],
    serviceTitle: 'PaymentsService',
    serviceRows: [
      ['createPayOSPayment()', 'Builds the external checkout payload and stores the payment record tied to the deposit invoice.'],
      ['handlePayOSWebhook()', 'Confirms the payment, updates invoice status, and drives post-payment business actions.'],
      ['appendContractActivationOperations()', 'Activates the rental contract and occupancy records once the deposit payment succeeds.'],
    ],
    dtoTitle: 'CreatePayOSPaymentLinkDto',
    dtoRows: [
      ['invoiceId', 'Identifies the deposit invoice that should be paid through PayOS.'],
      ['returnUrl', 'Defines where the client is redirected after successful payment completion.'],
      ['cancelUrl', 'Defines where the client is redirected when the payment flow is cancelled.'],
      ['description', 'Allows a short checkout description to be displayed in the payment session.'],
    ],
  },
  {
    id: '3.4.4.3',
    navText: '3.4.4.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ContractsController',
    controllerRows: [['renewContract()', 'Starts the contract renewal flow from an existing rental contract.']],
    serviceTitle: 'ContractsService',
    serviceRows: [
      ['renewContract()', 'Creates a renewed draft contract based on the selected renewal option and member set.'],
      ['addMonthsKeepingContractDay()', 'Extends contract dates while preserving the intended billing/renewal day alignment.'],
      ['generateContractNumber()', 'Generates a new contract number for the renewed contract record.'],
    ],
    dtoTitle: 'RenewContractDto',
    dtoRows: [
      ['renewalOption', 'Selects the renewal strategy such as keeping the same term or using a custom extension.'],
      ['extensionMonths', 'Specifies the new contract length when the custom renewal option is used.'],
      ['memberNationalIds', 'Allows the renewed contract member set to be rebuilt from verified identity numbers.'],
    ],
  },
  {
    id: '3.4.5.3',
    navText: '3.4.5.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ReservationsController',
    controllerRows: [['cancel()', 'Cancels an active reservation owned by the current user.']],
    serviceTitle: 'ReservationsService',
    serviceRows: [['cancel()', 'Changes reservation status to cancelled and restores apartment availability when allowed.']],
    dtoTitle: 'ReservationResponseDto',
    dtoRows: [
      ['status', 'Returns the reservation lifecycle state so the UI can reflect cancellation immediately.'],
      ['desiredStartDate + desiredEndDate', 'Keep the original reserved time window visible after cancellation.'],
      ['apartment', 'Returns apartment summary data so the user still understands which reservation was cancelled.'],
    ],
  },
  {
    id: '3.4.6.3',
    navText: '3.4.6.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'ContractsController',
    controllerRows: [['cancelByUser()', 'Lets the tenant request rental contract cancellation through the contract API.']],
    serviceTitle: 'ContractsService',
    serviceRows: [['cancelByUser()', 'Validates cancellation rules, updates contract termination fields, and cascades required lifecycle changes.']],
    dtoTitle: 'CancelContractDto',
    dtoRows: [
      ['reason', 'Requires a human-readable cancellation reason before early contract termination is accepted.'],
      ['minimum length rule', 'Prevents empty or overly short cancellation requests from bypassing business review.'],
      ['termination context', 'The same DTO is used to capture the user intent that becomes the stored termination note.'],
    ],
  },
  {
    id: '3.5.1.3',
    navText: '3.5.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'MaintenanceController',
    controllerRows: [['create()', 'Creates a maintenance request with optional issue images uploaded by the resident.']],
    serviceTitle: 'MaintenanceService',
    serviceRows: [
      ['create()', 'Builds the maintenance request, allocates the related task, and triggers notifications.'],
      ['findBestMaintenanceStaffId()', 'Chooses the most suitable maintenance staff member for the new request.'],
      ['mapUrgencyToTaskPriority()', 'Translates maintenance urgency into task priority used by operations workflows.'],
    ],
    dtoTitle: 'CreateMaintenanceDto / CreateMaintenanceRequestDto',
    dtoRows: [
      ['apartmentId + roomId', 'Locate the exact apartment and optional room where the issue happened.'],
      ['title + description', 'Describe the maintenance problem in a structured form.'],
      ['category + priority', 'Classify the issue so routing and SLA handling can be applied.'],
      ['images', 'Allow visual evidence to be submitted together with the request.'],
    ],
  },
  {
    id: '3.5.2.3',
    navText: '3.5.2.3. Class Specification',
    navIndex: 0,
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'MaintenanceController',
    controllerRows: [['accept()', 'Lets maintenance staff accept an assigned maintenance request.']],
    serviceTitle: 'MaintenanceService',
    serviceRows: [
      ['accept()', 'Transitions the maintenance request into the accepted/in-progress state with an optional note.'],
      ['ensureStaffAccess()', 'Confirms the current staff member is allowed to act on the targeted maintenance request.'],
    ],
    dtoTitle: 'AcceptMaintenanceDto',
    dtoRows: [
      ['note', 'Stores optional staff context when the request is accepted.'],
      ['staff-only action', 'Acceptance is restricted to authorized staff actors.'],
      ['status transition', 'The DTO participates in moving the request from pending to an accepted working state.'],
    ],
  },
  {
    id: '3.5.2.3',
    navText: '3.5.2.3. Class Specification',
    navIndex: 1,
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'MaintenanceController',
    controllerRows: [['reject()', 'Lets staff reject a maintenance request and attach rejection evidence when needed.']],
    serviceTitle: 'MaintenanceService',
    serviceRows: [
      ['reject()', 'Changes request status to rejected, stores the reason, and keeps the workflow auditable.'],
      ['ensureStaffAccess()', 'Guards the reject action so only the assigned or authorized staff can perform it.'],
    ],
    dtoTitle: 'RejectMaintenanceDto / RejectMaintenanceRequestDto',
    dtoRows: [
      ['reason', 'Requires the rejection explanation recorded against the maintenance request.'],
      ['images', 'Carry optional evidence images supporting the rejection decision.'],
      ['multipart wrapper', 'The request wrapper allows rejection evidence files to pass through the controller interceptor.'],
    ],
  },
  {
    id: '3.5.3.3',
    navText: '3.5.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'MaintenanceController',
    controllerRows: [['complete()', 'Marks the maintenance request as completed and uploads completion evidence if provided.']],
    serviceTitle: 'MaintenanceService',
    serviceRows: [
      ['complete()', 'Stores completion notes, actual cost, completion images, and final completion status.'],
      ['ensureStaffAccess()', 'Protects the completion endpoint so only authorized staff can close the request.'],
    ],
    dtoTitle: 'CompleteMaintenanceDto / CompleteMaintenanceRequestDto',
    dtoRows: [
      ['resolutionNotes', 'Record the final maintenance resolution provided by staff.'],
      ['cost', 'Store the actual maintenance expense when the job is completed.'],
      ['completionImages', 'Attach optional proof images showing the issue has been resolved.'],
    ],
  },
  {
    id: '3.5.4.3',
    navText: '3.5.4.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'MaintenanceController',
    controllerRows: [['rate()', 'Lets the tenant rate the completed maintenance support experience.']],
    serviceTitle: 'MaintenanceService',
    serviceRows: [['rate()', 'Stores the tenant rating and optional feedback only once the request has been completed.']],
    dtoTitle: 'RateMaintenanceDto',
    dtoRows: [
      ['rating', 'Captures the numerical satisfaction score for the completed maintenance work.'],
      ['feedback', 'Stores optional written feedback from the tenant.'],
      ['completion prerequisite', 'The service only accepts ratings for completed and previously unrated requests.'],
    ],
  },
  {
    id: '3.6.1.3',
    navText: '3.6.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [['createBoard()', 'Creates a new IoT board and optionally registers its initial devices in the same request.']],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['createBoard()', 'Creates or upserts the stored board record and provisions nested board devices when supplied.'],
      ['ensureBoardDoesNotExist()', 'Prevents duplicate board creation for the same normalized board identity.'],
      ['assertBoardAssignmentAvailable()', 'Checks apartment assignment rules before a board is linked to a unit.'],
    ],
    dtoTitle: 'CreateIoTBoardDto',
    dtoRows: [
      ['id', 'Carries the MQTT/ESP board identifier used as the primary board reference in the system.'],
      ['apartmentId', 'Optionally links the board to an apartment at creation time.'],
      ['devices', 'Allows nested device registration but keeps the array optional for empty-board provisioning.'],
      ['nested device payload', 'Each nested device carries deviceName, deviceId, topic, icon, and optional initial state.'],
    ],
  },
  {
    id: '3.6.2.3',
    navText: '3.6.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [['updateBoard()', 'Updates board metadata such as apartment linkage for an existing IoT board.']],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['updateBoard()', 'Applies allowed board changes while preserving normalized board identity rules.'],
      ['upsertStoredBoardRecord()', 'Synchronizes persisted board metadata with the latest board assignment changes.'],
      ['assertUniqueBoardAssignments()', 'Prevents conflicting apartment-to-board mappings during update operations.'],
    ],
    dtoTitle: 'UpdateIoTBoardDto',
    dtoRows: [
      ['partial board fields', 'Expose updateable board attributes as optional values.'],
      ['apartmentId', 'Lets the board be linked, relinked, or detached from an apartment.'],
      ['devices omitted', 'Board device updates are separated into dedicated device endpoints instead of the board patch payload.'],
    ],
  },
  {
    id: '3.6.3.3',
    navText: '3.6.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [['removeBoard()', 'Deletes a stored IoT board reference from the application domain.']],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['removeBoard()', 'Removes the board record and reports how many child devices were affected by the deletion.'],
      ['findStoredBoard()', 'Loads the persisted board snapshot before deletion is executed.'],
    ],
    dtoTitle: 'IoTBoardDeleteResultDto',
    dtoRows: [
      ['id', 'Returns the deleted board identifier for client-side cleanup.'],
      ['name', 'Keeps the removed board human-readable in audit or confirmation flows.'],
      ['affectedDevices', 'Reports how many board devices were impacted by the delete action.'],
      ['status', 'Shows the terminal result state returned by the delete workflow.'],
    ],
  },
  {
    id: '3.7.1.3',
    navText: '3.7.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [['createBoardDevice()', 'Adds a logical device record under an existing IoT board.']],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['createBoardDevice()', 'Creates the board device record and merges MQTT metadata needed for later control flows.'],
      ['buildCreateBoardDeviceData()', 'Builds the normalized persistence payload for the new board device.'],
      ['syncUtilityMeterForBoardDevice()', 'Creates or syncs the utility meter projection when the added device is a utility topic.'],
    ],
    dtoTitle: 'CreateIoTBoardDeviceDto',
    dtoRows: [
      ['deviceName', 'Stores the user-facing device label shown in application screens.'],
      ['deviceId', 'Stores the MQTT device/channel identifier used by the board firmware.'],
      ['topic', 'Defines which device topic the board should use, such as light, curtain, door, electric, or water.'],
      ['icon + state', 'Carry display metadata and the optional initial runtime state for the new device.'],
    ],
  },
  {
    id: '3.7.2.3',
    navText: '3.7.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [['removeBoardDevice()', 'Removes a device from an existing IoT board.']],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['removeBoardDevice()', 'Deletes the board device and clears any linked utility projection that depends on it.'],
      ['findUtilityMeterForDevice()', 'Locates the utility meter relationship attached to the board device before cleanup.'],
    ],
    dtoTitle: 'IoTBoardDeviceDeleteResultDto',
    dtoRows: [
      ['id', 'Returns the removed device identifier.'],
      ['deviceName', 'Preserves the removed device label for confirmation messages.'],
      ['status', 'Confirms the resulting device state after deletion is completed.'],
    ],
  },
  {
    id: '3.8.1.3',
    navText: '3.8.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [
      ['controlDeviceByTopic()', 'Sends a topic-based command to light, curtain, door, or other MQTT-controlled devices.'],
      ['unlockDoor()', 'Unlocks a smart door by validating the supplied PIN against the apartment door policy.'],
    ],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['controlDeviceByTopic()', 'Builds the MQTT command payload and waits for the board acknowledgement relevant to the action.'],
      ['dispatchMqttCommand()', 'Publishes the normalized MQTT command and captures dispatch metadata used by runtime control flows.'],
      ['unlockDoor()', 'Executes PIN-based door unlock while applying access checks and recording door history.'],
    ],
    dtoTitle: 'DirectMqttControlDto / UnlockDoorDto',
    dtoRows: [
      ['topic', 'Selects which board topic should receive the control command.'],
      ['action', 'Specifies the intended command such as ON, OFF, OPEN, CLOSE, or similar mapped actions.'],
      ['pin', 'Supplies the 6-digit door PIN required by the dedicated unlock endpoint.'],
      ['ack-based response', 'The service reports success based on board acknowledgement instead of MQTT dispatch only.'],
    ],
  },
  {
    id: '3.8.2.3',
    navText: '3.8.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'IoTController',
    controllerRows: [
      ['updateDoorPin()', 'Lets a resident change the smart door PIN by providing the old and new values.'],
      ['resetDoorPin()', 'Lets staff reset the smart door PIN without needing the current PIN.'],
    ],
    serviceTitle: 'IoTService',
    serviceRows: [
      ['updateDoorPin()', 'Validates the current PIN, publishes the new PIN to the board, and persists the result only after acknowledgement.'],
      ['resetDoorPin()', 'Publishes a new PIN for staff-assisted recovery without requiring the old PIN.'],
      ['toDoorPinUpdateAckResult()', 'Normalizes the board acknowledgement so the API can return a consistent success/failure response.'],
    ],
    dtoTitle: 'UpdateDoorPinDto / ResetDoorPinDto',
    dtoRows: [
      ['oldPin', 'Required in the resident self-service password change flow.'],
      ['newPin', 'Carries the new 6-digit PIN that should be synchronized to the board.'],
      ['staff reset path', 'The reset DTO allows staff to set a replacement PIN when the old PIN is unavailable.'],
      ['board acknowledgement', 'The change is only considered successful when the device acknowledges the PIN update.'],
    ],
  },
  {
    id: '3.9.1.3',
    navText: '3.9.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'PaymentsController',
    controllerRows: [
      ['createPayOSPaymentLink()', 'Creates a PayOS checkout session for rental or utility invoices selected in the client.'],
      ['handlePayOSWebhook()', 'Processes asynchronous PayOS callbacks after the invoice payment is settled.'],
    ],
    serviceTitle: 'PaymentsService',
    serviceRows: [
      ['createPayOSPayment()', 'Builds PayOS order data from invoice content and stores the pending payment record.'],
      ['handlePayOSWebhook()', 'Confirms the payment outcome, updates invoice balances, and finalizes invoice state transitions.'],
      ['buildPayOSItems()', 'Transforms invoice line items into the external payment gateway item structure.'],
    ],
    dtoTitle: 'CreatePayOSPaymentLinkDto',
    dtoRows: [
      ['invoiceId', 'Targets the rental or utility invoice that should be paid.'],
      ['returnUrl', 'Defines the success redirect or deep-link destination after payment completion.'],
      ['cancelUrl', 'Defines the cancellation redirect or deep-link destination when payment is aborted.'],
      ['description', 'Provides a short payment description displayed in the PayOS flow.'],
    ],
  },
  {
    id: '3.9.2.3',
    navText: '3.9.2.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'PaymentsController',
    controllerRows: [
      ['listDueContractDepositPayouts()', 'Lists expired contracts whose deposit payout is due back to the tenant.'],
      ['confirmContractDepositPayout()', 'Confirms that staff transferred the deposit back and uploads transfer proof.'],
    ],
    serviceTitle: 'PaymentsService',
    serviceRows: [
      ['listDueContractDepositPayouts()', 'Builds the worklist of due deposit refunds from ended contracts and paid deposit invoices.'],
      ['confirmContractDepositPayout()', 'Creates the payout payment record, stores proof, and marks the payout as confirmed.'],
      ['resolveMonthRange()', 'Normalizes the selected payout month so due payout work can be grouped consistently.'],
    ],
    dtoTitle: 'ConfirmContractDepositPayoutDto',
    dtoRows: [
      ['contractId', 'Identifies which rental contract deposit should be refunded.'],
      ['transferReference + transferNote', 'Store optional banking metadata for the payout confirmation.'],
      ['refundReason', 'Captures the staff explanation for the deposit refund.'],
      ['transferProof', 'Requires an uploaded proof image before the payout can be confirmed.'],
    ],
  },
  {
    id: '3.9.3.3',
    navText: '3.9.3.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'PaymentsController',
    controllerRows: [
      ['listDuePartnerMonthlyPayouts()', 'Lists partners whose monthly revenue payout is already due.'],
      ['confirmPartnerMonthlyPayout()', 'Confirms a partner payout transfer and uploads the transfer proof image.'],
    ],
    serviceTitle: 'PaymentsService',
    serviceRows: [
      ['listDuePartnerMonthlyPayouts()', 'Aggregates payable partner revenue for the selected billing month.'],
      ['confirmPartnerMonthlyPayout()', 'Persists the confirmed partner payout and marks the payout status as paid.'],
      ['buildPartnerPayoutDrafts()', 'Calculates gross revenue, commission, and net payout values before confirmation.'],
    ],
    dtoTitle: 'ConfirmPartnerMonthlyPayoutDto',
    dtoRows: [
      ['partnerId', 'Targets the partner whose monthly payout is being confirmed.'],
      ['payoutMonth', 'Identifies the billing month for the payout operation.'],
      ['transferReference + transferNote', 'Store optional transaction metadata attached to the payout.'],
      ['transferProof', 'Requires an uploaded proof image before the payout is accepted.'],
    ],
  },
  {
    id: '3.10.1.3',
    navText: '3.10.1.3. Class Specification',
    mode: 'insert',
    anchor: [650, 195],
    controllerTitle: 'UsersController',
    controllerRows: [
      ['verifyIdentityCard()', 'Uploads front and back identity card images so AI extraction and verification can run.'],
      ['searchByNationalId()', 'Lets operators or workflows look up an already verified user by national ID.'],
    ],
    serviceTitle: 'UsersService',
    serviceRows: [
      ['updateIdentityCard()', 'Calls the AI extraction flow, maps extracted fields into identity data, and auto-verifies the user when valid.'],
      ['searchByNationalId()', 'Loads a user and identity snapshot from the stored national ID index.'],
    ],
    dtoTitle: 'UpdateIdentityCardDto / SearchUserByNationalIdDto',
    dtoRows: [
      ['identityCardFront + identityCardBack', 'The verification flow expects both card images through multipart upload even though the DTO itself is empty.'],
      ['nationalId', 'Supports exact national ID lookup against verified identity data.'],
      ['AI extraction result', 'The service enriches the stored identity record with OCR-extracted attributes from both card sides.'],
      ['verification guard', 'Duplicate national ID detection prevents multiple users from being verified with the same identity.'],
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTable(sectionId, letter, title, header2, rows) {
  const safeTitle = escapeHtml(title);
  const head2 = escapeHtml(header2);
  const body = rows
    .map(
      (row, index) =>
        `<tr><td style="border:1px solid #000;padding:6px 8px;vertical-align:top;">${index + 1}</td><td style="border:1px solid #000;padding:6px 8px;vertical-align:top;">${escapeHtml(row[0])}</td><td style="border:1px solid #000;padding:6px 8px;vertical-align:top;">${escapeHtml(row[1])}</td></tr>`,
    )
    .join('');

  return `
    <p><b>${sectionId}.${letter} ${safeTitle}</b></p>
    <p><i>Table ${sectionId}.${letter}: ${safeTitle} Description Table</i></p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:14px;">
      <tr>
        <th style="border:1px solid #000;padding:6px 8px;background:#f5dec0;text-align:left;">No</th>
        <th style="border:1px solid #000;padding:6px 8px;background:#f5dec0;text-align:left;">${head2}</th>
        <th style="border:1px solid #000;padding:6px 8px;background:#f5dec0;text-align:left;">Description</th>
      </tr>
      ${body}
    </table>
  `;
}

function renderSection(section) {
  return [
    renderTable(section.id, 'a', section.controllerTitle, 'Method', section.controllerRows),
    renderTable(section.id, 'b', section.serviceTitle, 'Method', section.serviceRows),
    renderTable(section.id, 'c', section.dtoTitle, 'Property / Rule', section.dtoRows),
  ].join('');
}

async function writeClipboard(page, html) {
  await page.evaluate(async ({ html }) => {
    const plain = html
      .replace(/<\/tr>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
  }, { html });
}

async function selectRange(page, from, to) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 24 });
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'https://docs.google.com',
  });
  const page = await context.newPage();

  await page.goto(
    'https://docs.google.com/document/d/1KU_GbvWueUxUg2IIrbQSQkmIdoohIb_u4BrBymEzhdo/edit?tab=t.0',
    { waitUntil: 'domcontentloaded', timeout: 120000 },
  );
  await page.waitForTimeout(9000);

  for (const section of sections) {
    console.log(
      'Processing',
      section.id,
      section.navText,
      section.navIndex || 0,
    );

    const locator = page
      .getByText(section.navText, { exact: true })
      .nth(section.navIndex || 0);

    await locator.click();
    await page.waitForTimeout(2500);

    const html = renderSection(section);
    await writeClipboard(page, html);
    await page.waitForTimeout(300);

    if (section.mode === 'replace') {
      await selectRange(page, section.replace.from, section.replace.to);
      await page.waitForTimeout(400);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+V');
    } else {
      await page.mouse.click(section.anchor[0], section.anchor[1]);
      await page.waitForTimeout(250);
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await page.keyboard.press('Control+V');
    }

    await page.waitForTimeout(2200);
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'class-spec-final-pass.png', fullPage: false });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
