/**
 * ============================================================================
 * GLOW & GRACE SALON - MY APPOINTMENTS CONTROLLER (appointments.js)
 * ============================================================================
 * Handles viewing, filtering, and cancelling booked appointments:
 * 1. Reads stored appointments from localStorage
 * 2. Renders responsive appointment cards with status badges
 * 3. Filters by Status (All, Confirmed, Cancelled)
 * 4. Cancellation workflow with confirmation modal
 * 5. Frees up the date + time slot immediately upon cancellation
 * ============================================================================
 */

let currentFilter = 'ALL';
let appointmentToCancelId = null;

document.addEventListener('DOMContentLoaded', () => {
  initAppointmentsPage();
});

/**
 * Initialize Appointments View
 */
function initAppointmentsPage() {
  renderAppointmentsList();
  setupFilterTabs();
  setupCancellationModal();
}

/**
 * Sets up the filter tab buttons (All, Confirmed, Cancelled)
 */
function setupFilterTabs() {
  const filterButtons = document.querySelectorAll('[data-filter]');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.getAttribute('data-filter');
      renderAppointmentsList();
    });
  });

  // Search input filter
  const searchInput = document.getElementById('appointmentSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderAppointmentsList();
    });
  }
}

/**
 * Renders the appointments list into the DOM based on filter & search
 */
function renderAppointmentsList() {
  const container = document.getElementById('appointmentsContainer');
  const emptyState = document.getElementById('emptyAppointmentsState');
  const searchInput = document.getElementById('appointmentSearch');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!container) return;

  const allAppointments = getStoredAppointments();

  // Sort descending by created date or id so newest appears first
  const sorted = [...allAppointments].reverse();

  // Filter by status
  const filtered = sorted.filter(app => {
    // Filter tab
    if (currentFilter === 'CONFIRMED' && app.status !== 'Confirmed') return false;
    if (currentFilter === 'CANCELLED' && app.status !== 'Cancelled') return false;

    // Search query
    if (searchTerm) {
      const matchId = app.id.toLowerCase().includes(searchTerm);
      const matchName = app.customerName.toLowerCase().includes(searchTerm);
      const matchService = app.serviceName.toLowerCase().includes(searchTerm);
      const matchPhone = app.phone.includes(searchTerm);
      if (!matchId && !matchName && !matchService && !matchPhone) return false;
    }

    return true;
  });

  // Update counts in badges
  updateFilterCounts(allAppointments);

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  // Build HTML cards
  container.innerHTML = filtered.map(app => {
    const isConfirmed = app.status === 'Confirmed';
    const statusClass = isConfirmed ? 'status-confirmed' : 'status-cancelled';
    const statusIcon = isConfirmed ? 'bi-check-circle-fill' : 'bi-x-circle-fill';

    return `
      <div class="col-12 col-lg-6">
        <div class="appointment-card h-100 d-flex flex-column justify-content-between">
          <div>
            <!-- Card Header: ID & Status -->
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge bg-light text-dark border font-monospace px-2 py-1 fs-6">
                <i class="bi bi-ticket-perforated me-1 text-muted"></i>${app.id}
              </span>
              <span class="status-badge ${statusClass}">
                <i class="bi ${statusIcon}"></i>${app.status}
              </span>
            </div>

            <!-- Service Title & Price -->
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 class="mb-1 font-serif text-capitalize">${app.serviceName}</h5>
                <span class="text-muted small"><i class="bi bi-clock me-1"></i>${app.duration}</span>
              </div>
              <div class="text-end">
                <span class="fs-5 fw-bold text-salon-primary" style="color: var(--color-primary);">${formatCurrency(app.price)}</span>
              </div>
            </div>

            <hr class="my-2" style="border-color: var(--color-border);" />

            <!-- Schedule Info -->
            <div class="row g-2 mb-3 small">
              <div class="col-6">
                <div class="p-2 rounded bg-light">
                  <span class="text-muted d-block"><i class="bi bi-calendar3 me-1"></i>Date</span>
                  <strong class="text-dark">${formatDisplayDate(app.date)}</strong>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 rounded bg-light">
                  <span class="text-muted d-block"><i class="bi bi-alarm me-1"></i>Time</span>
                  <strong class="text-dark">${app.time}</strong>
                </div>
              </div>
            </div>

            <!-- Customer Info -->
            <div class="small text-muted mb-3">
              <div><i class="bi bi-person me-2"></i><strong>${app.customerName}</strong></div>
              <div><i class="bi bi-telephone me-2"></i>${app.phone}</div>
              <div><i class="bi bi-envelope me-2"></i>${app.email}</div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="pt-2 border-top d-flex justify-content-between align-items-center">
            <small class="text-muted fst-italic">
              Booked: ${new Date(app.createdAt).toLocaleDateString('en-IN')}
            </small>
            ${isConfirmed ? `
              <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmAppointmentCancellation('${app.id}')">
                <i class="bi bi-x-circle me-1"></i>Cancel Appointment
              </button>
            ` : `
              <span class="badge bg-secondary-subtle text-secondary small py-2 px-3 rounded-pill">
                Slot Released & Available
              </span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Updates the count numbers on filter badges
 * @param {Array} allAppointments 
 */
function updateFilterCounts(allAppointments) {
  const allCount = allAppointments.length;
  const confirmedCount = allAppointments.filter(a => a.status === 'Confirmed').length;
  const cancelledCount = allAppointments.filter(a => a.status === 'Cancelled').length;

  const countAllElem = document.getElementById('countAll');
  const countConfirmedElem = document.getElementById('countConfirmed');
  const countCancelledElem = document.getElementById('countCancelled');

  if (countAllElem) countAllElem.textContent = allCount;
  if (countConfirmedElem) countConfirmedElem.textContent = confirmedCount;
  if (countCancelledElem) countCancelledElem.textContent = cancelledCount;
}

/**
 * Triggers the cancellation confirmation modal
 * @param {string} bookingId 
 */
function confirmAppointmentCancellation(bookingId) {
  appointmentToCancelId = bookingId;

  const all = getStoredAppointments();
  const target = all.find(a => a.id === bookingId);

  if (!target) {
    showToastNotification("Appointment not found.", "danger");
    return;
  }

  // Populate cancel dialog info
  document.getElementById('cancelModalBookingId').textContent = target.id;
  document.getElementById('cancelModalService').textContent = target.serviceName;
  document.getElementById('cancelModalDateTime').textContent = `${formatDisplayDate(target.date)} at ${target.time}`;

  // Show Bootstrap modal
  const modalElem = document.getElementById('cancelConfirmModal');
  if (modalElem && window.bootstrap && window.bootstrap.Modal) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElem);
    modalInstance.show();
  }
}

/**
 * Sets up the cancellation modal confirm button handler
 */
function setupCancellationModal() {
  const confirmBtn = document.getElementById('btnConfirmCancellation');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (!appointmentToCancelId) return;

      const all = getStoredAppointments();
      const targetIndex = all.findIndex(a => a.id === appointmentToCancelId);

      if (targetIndex !== -1) {
        // 1. Change status to Cancelled
        all[targetIndex].status = 'Cancelled';
        all[targetIndex].cancelledAt = new Date().toISOString();

        // 2. Save back to localStorage
        // When dynamic slot generator in booking.js checks slots, it only filters
        // for `status === 'Confirmed'`, so this date/time slot is immediately AVAILABLE again!
        saveStoredAppointments(all);

        // 3. Close the modal
        const modalElem = document.getElementById('cancelConfirmModal');
        if (modalElem && window.bootstrap && window.bootstrap.Modal) {
          const modalInstance = bootstrap.Modal.getInstance(modalElem);
          if (modalInstance) modalInstance.hide();
        }

        // 4. Update the UI immediately
        renderAppointmentsList();

        showToastNotification(`Appointment ${appointmentToCancelId} cancelled. Slot is now available for booking!`, "success");
      }

      appointmentToCancelId = null;
    });
  }
}
