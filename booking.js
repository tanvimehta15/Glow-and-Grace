/**
 * ============================================================================
 * GLOW & GRACE SALON - BOOKING CONTROLLER (booking.js)
 * ============================================================================
 * Manages the interactive 5-step booking system:
 * 1. Loading and pre-selecting salon services
 * 2. Date picker constraints (preventing past dates)
 * 3. Dynamic real-time slot generation (checking localStorage for booked slots)
 * 4. Client-side form validation (name, 10-digit phone, email)
 * 5. Live summary calculation
 * 6. Appointment creation, duplicate prevention, and confirmation receipt
 * ============================================================================
 */

// Application booking state
let allServices = [];
let selectedService = null;
let selectedDate = '';
let selectedSlot = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize the booking flow
  await initBookingPage();
});

/**
 * Main initialization routine
 */
async function initBookingPage() {
  // 1. Fetch / Load services catalog
  allServices = await loadSalonServices();

  // 2. Populate service selection dropdown
  populateServicesDropdown();

  // 3. Set minimum and maximum dates on date input
  setupDatePicker();

  // 4. Check for URL query parameter (e.g., booking.html?service=Haircut or booking.html?service=2)
  handleUrlServicePreselection();

  // 5. Attach event listeners
  setupEventListeners();

  // 6. Initial summary render
  updateBookingSummary();
}

/**
 * Populates the Service select dropdown
 */
function populateServicesDropdown() {
  const serviceSelect = document.getElementById('serviceSelect');
  if (!serviceSelect) return;

  serviceSelect.innerHTML = '<option value="">-- Choose a Salon Service --</option>';

  allServices.forEach(service => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} (${formatCurrency(service.price)} • ${service.duration})`;
    serviceSelect.appendChild(option);
  });
}

/**
 * Configures the date picker to block past dates and cap at 60 days ahead
 */
function setupDatePicker() {
  const dateInput = document.getElementById('appointmentDate');
  if (!dateInput) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const minDate = `${yyyy}-${mm}-${dd}`;

  // Max date: 60 days in the future
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 60);
  const maxY = maxDateObj.getFullYear();
  const maxM = String(maxDateObj.getMonth() + 1).padStart(2, '0');
  const maxD = String(maxDateObj.getDate()).padStart(2, '0');
  const maxDate = `${maxY}-${maxM}-${maxD}`;

  dateInput.min = minDate;
  dateInput.max = maxDate;
}

/**
 * Handles automatic pre-selection if user navigated from Services page (e.g. ?service=Haircut or ?service=1)
 */
function handleUrlServicePreselection() {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceParam = urlParams.get('service');

  if (serviceParam) {
    // Try matching by numeric ID or by name
    const matchedService = allServices.find(s => 
      s.id.toString() === serviceParam ||
      s.name.toLowerCase() === decodeURIComponent(serviceParam).toLowerCase()
    );

    if (matchedService) {
      const serviceSelect = document.getElementById('serviceSelect');
      if (serviceSelect) {
        serviceSelect.value = matchedService.id;
        handleServiceChange(matchedService.id);
      }
    }
  }
}

/**
 * Binds DOM events for interactive updates
 */
function setupEventListeners() {
  // Service selection change
  const serviceSelect = document.getElementById('serviceSelect');
  if (serviceSelect) {
    serviceSelect.addEventListener('change', (e) => {
      handleServiceChange(e.target.value);
    });
  }

  // Date selection change
  const dateInput = document.getElementById('appointmentDate');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      handleDateChange(e.target.value);
    });
  }

  // Customer details input validation listeners
  const nameInput = document.getElementById('customerName');
  const phoneInput = document.getElementById('customerPhone');
  const emailInput = document.getElementById('customerEmail');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      validateField(nameInput, validateName(nameInput.value));
      updateBookingSummary();
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      validateField(phoneInput, validatePhone(phoneInput.value));
      updateBookingSummary();
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      validateField(emailInput, validateEmail(emailInput.value));
      updateBookingSummary();
    });
  }

  // Form submission
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
  }
}

/**
 * Handles service selection change
 */
function handleServiceChange(serviceId) {
  if (!serviceId) {
    selectedService = null;
    document.getElementById('serviceInfoCard').classList.add('d-none');
  } else {
    selectedService = allServices.find(s => s.id.toString() === serviceId.toString()) || null;
    
    // Display selected service details pill
    if (selectedService) {
      const infoCard = document.getElementById('serviceInfoCard');
      document.getElementById('selectedServiceName').textContent = selectedService.name;
      document.getElementById('selectedServicePrice').textContent = formatCurrency(selectedService.price);
      document.getElementById('selectedServiceDuration').textContent = selectedService.duration;
      document.getElementById('selectedServiceDesc').textContent = selectedService.description;
      infoCard.classList.remove('d-none');
    }
  }

  updateBookingSummary();
}

/**
 * Handles date picker change and renders dynamic slots
 */
function handleDateChange(newDate) {
  selectedDate = newDate;
  selectedSlot = ''; // Reset slot selection when date changes

  const slotsContainer = document.getElementById('slotsContainer');
  const slotsPlaceholder = document.getElementById('slotsPlaceholder');

  if (!selectedDate) {
    if (slotsContainer) slotsContainer.classList.add('d-none');
    if (slotsPlaceholder) slotsPlaceholder.classList.remove('d-none');
    updateBookingSummary();
    return;
  }

  // Show slots container, hide placeholder
  if (slotsContainer) slotsContainer.classList.remove('d-none');
  if (slotsPlaceholder) slotsPlaceholder.classList.add('d-none');

  // Render slots dynamically for this date
  renderTimeSlotsForDate(selectedDate);
  updateBookingSummary();
}

/**
 * Renders the 9 standard slots for the chosen date.
 * Marks slots as AVAILABLE or BOOKED by querying localStorage.
 * @param {string} dateStr 
 */
function renderTimeSlotsForDate(dateStr) {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  // 1. Fetch existing confirmed bookings from localStorage
  const allAppointments = getStoredAppointments();
  
  // Find all appointments for this date that are currently 'Confirmed'
  const bookedTimes = allAppointments
    .filter(app => app.date === dateStr && app.status === 'Confirmed')
    .map(app => app.time);

  // 2. Build time slot buttons
  SALON_TIME_SLOTS.forEach(time => {
    const isBooked = bookedTimes.includes(time);
    const isSelected = selectedSlot === time;

    const slotBtn = document.createElement('button');
    slotBtn.type = 'button';
    slotBtn.className = `time-slot-btn ${isBooked ? 'slot-booked' : 'slot-available'} ${isSelected ? 'slot-selected' : ''}`;
    slotBtn.setAttribute('data-time', time);

    if (isBooked) {
      slotBtn.disabled = true;
      slotBtn.title = 'This slot is already booked. Please choose another time.';
      slotBtn.innerHTML = `
        <span class="slot-time"><i class="bi bi-clock-history me-1"></i>${time}</span>
        <span class="slot-status"><i class="bi bi-x-circle me-1"></i>Booked</span>
      `;
    } else {
      slotBtn.title = `Click to select ${time}`;
      slotBtn.innerHTML = `
        <span class="slot-time"><i class="bi bi-clock me-1"></i>${time}</span>
        <span class="slot-status"><i class="bi bi-check-circle me-1"></i>Available</span>
      `;

      // Click handler for available slot
      slotBtn.addEventListener('click', () => {
        selectTimeSlot(time);
      });
    }

    grid.appendChild(slotBtn);
  });

  // Slot status summary note
  const availableCount = SALON_TIME_SLOTS.length - bookedTimes.length;
  const statusNote = document.getElementById('slotAvailabilityNote');
  if (statusNote) {
    statusNote.innerHTML = `
      <i class="bi bi-info-circle me-1"></i>
      <strong>${availableCount} of ${SALON_TIME_SLOTS.length} slots</strong> available for <strong>${formatDisplayDate(dateStr)}</strong>.
    `;
  }
}

/**
 * Selects a time slot and updates styling
 * @param {string} time 
 */
function selectTimeSlot(time) {
  selectedSlot = time;

  // Clear slot error if present
  const slotError = document.getElementById('slotErrorMsg');
  if (slotError) slotError.classList.add('d-none');

  // Update button active classes
  const allSlotBtns = document.querySelectorAll('.time-slot-btn');
  allSlotBtns.forEach(btn => {
    if (btn.getAttribute('data-time') === time) {
      btn.classList.add('slot-selected');
    } else {
      btn.classList.remove('slot-selected');
    }
  });

  updateBookingSummary();
}

/**
 * Updates the Live Summary Card on the sidebar
 */
function updateBookingSummary() {
  const summaryService = document.getElementById('summaryService');
  const summaryPrice = document.getElementById('summaryPrice');
  const summaryDuration = document.getElementById('summaryDuration');
  const summaryDate = document.getElementById('summaryDate');
  const summaryTime = document.getElementById('summaryTime');
  const summaryCustomer = document.getElementById('summaryCustomer');
  const summaryTotal = document.getElementById('summaryTotal');

  // Service details
  if (selectedService) {
    if (summaryService) summaryService.textContent = selectedService.name;
    if (summaryPrice) summaryPrice.textContent = formatCurrency(selectedService.price);
    if (summaryDuration) summaryDuration.textContent = selectedService.duration;
    if (summaryTotal) summaryTotal.textContent = formatCurrency(selectedService.price);
  } else {
    if (summaryService) summaryService.textContent = 'Not selected';
    if (summaryPrice) summaryPrice.textContent = '₹0';
    if (summaryDuration) summaryDuration.textContent = '--';
    if (summaryTotal) summaryTotal.textContent = '₹0';
  }

  // Date
  if (summaryDate) {
    summaryDate.textContent = selectedDate ? formatDisplayDate(selectedDate) : 'Not selected';
  }

  // Time
  if (summaryTime) {
    summaryTime.textContent = selectedSlot || 'Not selected';
  }

  // Customer Name
  const nameInput = document.getElementById('customerName');
  if (summaryCustomer) {
    summaryCustomer.textContent = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Guest';
  }
}

/**
 * Client-side validation helpers
 */
function validateName(val) {
  const trimmed = val.trim();
  return trimmed.length >= 3 && /^[a-zA-Z\s'.]+$/.test(trimmed);
}

function validatePhone(val) {
  const trimmed = val.trim();
  // Valid Indian 10-digit mobile number starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(trimmed);
}

function validateEmail(val) {
  const trimmed = val.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function validateField(inputElement, isValid) {
  if (isValid) {
    inputElement.classList.remove('is-invalid');
    inputElement.classList.add('is-valid');
  } else {
    inputElement.classList.remove('is-valid');
    inputElement.classList.add('is-invalid');
  }
  return isValid;
}

/**
 * Handles appointment form submission
 */
function handleBookingSubmit(event) {
  event.preventDefault();

  // 1. Validate Service Selection
  const serviceSelect = document.getElementById('serviceSelect');
  if (!selectedService) {
    serviceSelect.classList.add('is-invalid');
    serviceSelect.focus();
    showToastNotification("Please select a salon service in Step 1.", "warning");
    return;
  } else {
    serviceSelect.classList.remove('is-invalid');
  }

  // 2. Validate Date Selection
  const dateInput = document.getElementById('appointmentDate');
  if (!selectedDate) {
    dateInput.classList.add('is-invalid');
    dateInput.focus();
    showToastNotification("Please pick an appointment date in Step 2.", "warning");
    return;
  } else {
    dateInput.classList.remove('is-invalid');
  }

  // 3. Validate Time Slot Selection
  const slotError = document.getElementById('slotErrorMsg');
  if (!selectedSlot) {
    if (slotError) {
      slotError.classList.remove('d-none');
      slotError.textContent = "Please select an available time slot in Step 3.";
    }
    dateInput.scrollIntoView({ behavior: 'smooth' });
    showToastNotification("Please select an available time slot.", "warning");
    return;
  } else {
    if (slotError) slotError.classList.add('d-none');
  }

  // 4. Validate Customer Details
  const nameInput = document.getElementById('customerName');
  const phoneInput = document.getElementById('customerPhone');
  const emailInput = document.getElementById('customerEmail');

  const isNameValid = validateField(nameInput, validateName(nameInput.value));
  const isPhoneValid = validateField(phoneInput, validatePhone(phoneInput.value));
  const isEmailValid = validateField(emailInput, validateEmail(emailInput.value));

  if (!isNameValid || !isPhoneValid || !isEmailValid) {
    if (!isNameValid) nameInput.focus();
    else if (!isPhoneValid) phoneInput.focus();
    else if (!isEmailValid) emailInput.focus();
    showToastNotification("Please fill in all customer details correctly.", "danger");
    return;
  }

  // 5. CRITICAL CHECK: Real-time duplicate booking prevention check
  const allAppointments = getStoredAppointments();
  const isAlreadyBooked = allAppointments.some(
    app => app.date === selectedDate && app.time === selectedSlot && app.status === 'Confirmed'
  );

  if (isAlreadyBooked) {
    showToastNotification("This time slot was just booked by another customer! Please choose a different slot.", "danger");
    // Re-render slots to disable the newly booked slot
    renderTimeSlotsForDate(selectedDate);
    selectedSlot = '';
    updateBookingSummary();
    return;
  }

  // 6. Create the Appointment Object
  const bookingId = generateBookingId();
  const newAppointment = {
    id: bookingId,
    customerName: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    email: emailInput.value.trim(),
    serviceId: selectedService.id,
    serviceName: selectedService.name,
    price: selectedService.price,
    duration: selectedService.duration,
    date: selectedDate,
    time: selectedSlot,
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  // 7. Save to localStorage
  allAppointments.push(newAppointment);
  saveStoredAppointments(allAppointments);

  // 8. Display Booking Confirmation Modal
  showBookingConfirmationModal(newAppointment);

  // 9. Re-render slots for the date so this slot becomes disabled / Booked immediately
  renderTimeSlotsForDate(selectedDate);
}

/**
 * Displays the confirmation modal with complete booking receipt
 * @param {Object} appointment 
 */
function showBookingConfirmationModal(appointment) {
  // Populate confirmation modal fields
  document.getElementById('confirmBookingId').textContent = appointment.id;
  document.getElementById('confirmCustomerName').textContent = appointment.customerName;
  document.getElementById('confirmService').textContent = appointment.serviceName;
  document.getElementById('confirmDate').textContent = formatDisplayDate(appointment.date);
  document.getElementById('confirmTime').textContent = appointment.time;
  document.getElementById('confirmPrice').textContent = formatCurrency(appointment.price);
  document.getElementById('confirmDuration').textContent = appointment.duration;

  // Show the Bootstrap modal
  const modalElem = document.getElementById('bookingConfirmModal');
  if (modalElem && window.bootstrap && window.bootstrap.Modal) {
    const modalInstance = new window.bootstrap.Modal(modalElem, {
      backdrop: 'static',
      keyboard: false
    });
    modalInstance.show();
  }

  showToastNotification(`Appointment ${appointment.id} successfully confirmed!`, 'success');
}

/**
 * Resets the booking form to allow booking another appointment
 */
function resetBookingForm() {
  document.getElementById('bookingForm').reset();
  selectedService = null;
  selectedDate = '';
  selectedSlot = '';

  document.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
    el.classList.remove('is-valid', 'is-invalid');
  });

  document.getElementById('serviceInfoCard').classList.add('d-none');
  document.getElementById('slotsContainer').classList.add('d-none');
  document.getElementById('slotsPlaceholder').classList.remove('d-none');

  setupDatePicker();
  updateBookingSummary();
}
