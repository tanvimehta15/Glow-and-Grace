/**
 * ============================================================================
 * GLOW & GRACE SALON - MAIN JAVASCRIPT UTILITIES (main.js)
 * ============================================================================
 * This file provides shared utility functions used across all pages:
 * 1. Service catalog loader (with fetch + offline/file:// fallback)
 * 2. LocalStorage management for appointments
 * 3. Booking ID generator (e.g. GG-2026-001)
 * 4. Date and currency formatters
 * 5. Available time slots definition
 * ============================================================================
 */

// Storage keys used in browser localStorage
const STORAGE_KEYS = {
  APPOINTMENTS: 'glow_grace_appointments',
  LAST_ID_COUNTER: 'glow_grace_id_counter'
};

// Standard daily appointment time slots for Glow & Grace Salon
const SALON_TIME_SLOTS = [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM"
];

// Fallback services catalog (guarantees the app runs even if fetch is blocked by file:// CORS)
const FALLBACK_SERVICES = [
  {
    id: 1,
    name: "Haircut",
    category: "Hair",
    price: 300,
    duration: "30 min",
    icon: "bi-scissors",
    badge: "Popular",
    description: "Precision haircut tailored to your personal style and facial profile. Includes consultation, gentle hair wash, and blow-dry finish."
  },
  {
    id: 2,
    name: "Hair Styling",
    category: "Hair",
    price: 500,
    duration: "45 min",
    icon: "bi-wind",
    badge: "Trending",
    description: "Expert blowouts, beachy waves, glamorous curls, or sleek straightening using premium ceramic tools and heat protection serums."
  },
  {
    id: 3,
    name: "Hair Spa",
    category: "Hair",
    price: 800,
    duration: "60 min",
    icon: "bi-droplet-half",
    badge: "Recommended",
    description: "Intense restorative treatment featuring an organic hair mask, relaxing acupressure scalp massage, and hydrating ozone steam therapy."
  },
  {
    id: 4,
    name: "Facial",
    category: "Skin",
    price: 700,
    duration: "60 min",
    icon: "bi-flower1",
    badge: "Bestseller",
    description: "Deep pore cleansing, gentle fruit enzyme exfoliation, lymphatic facial massage, and a radiant herbal glow mask tailored to your skin type."
  },
  {
    id: 5,
    name: "Manicure",
    category: "Nails",
    price: 400,
    duration: "45 min",
    icon: "bi-hand-index",
    badge: "Essential",
    description: "Comprehensive hand care including nail shaping, gentle cuticle treatment, exfoliating sugar scrub, moisturizing hand massage, and fresh polish."
  },
  {
    id: 6,
    name: "Pedicure",
    category: "Nails",
    price: 500,
    duration: "45 min",
    icon: "bi-heart-pulse",
    badge: "Relaxing",
    description: "Soothing aromatic warm foot soak, dead skin exfoliation, callus smoothing, calming calf massage, and professional nail finishing."
  },
  {
    id: 7,
    name: "Makeup",
    category: "Beauty",
    price: 1500,
    duration: "90 min",
    icon: "bi-stars",
    badge: "Glamour",
    description: "Flawless party and event makeup using high-definition, long-lasting luxury cosmetics. Customized highlighting to match your outfit and event."
  },
  {
    id: 8,
    name: "Hair Coloring",
    category: "Hair",
    price: 1200,
    duration: "90 min",
    icon: "bi-palette",
    badge: "Premium",
    description: "Global hair color, radiant balayage, or vibrant highlights formulated with ammonia-free, nourishing botanical colorants for glossy shine."
  }
];

/**
 * Loads the salon services data.
 * Attempts to fetch from 'data/services.json' (working with VS Code Live Server).
 * If fetch fails (e.g. file:/// protocol security), smoothly falls back to FALLBACK_SERVICES.
 * @returns {Promise<Array>} Array of service objects
 */
async function loadSalonServices() {
  try {
    const response = await fetch('data/services.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && Array.isArray(data.services)) {
      return data.services;
    }
    return FALLBACK_SERVICES;
  } catch (error) {
    console.warn("Could not fetch 'data/services.json' via HTTP. Using local fallback services.", error);
    return FALLBACK_SERVICES;
  }
}

/**
 * Reads all stored appointments from browser localStorage.
 * @returns {Array} Array of appointment objects
 */
function getStoredAppointments() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (!rawData) {
      // Return empty list if first time
      return [];
    }
    const parsed = JSON.parse(rawData);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading appointments from localStorage:", err);
    return [];
  }
}

/**
 * Saves appointments array to localStorage.
 * @param {Array} appointments 
 */
function saveStoredAppointments(appointments) {
  try {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return true;
  } catch (err) {
    console.error("Error saving appointments to localStorage:", err);
    return false;
  }
}

/**
 * Generates a unique sequential booking ID like "GG-2026-001".
 * Increments an internal counter stored in localStorage.
 * @returns {string} Formatted Booking ID
 */
function generateBookingId() {
  let currentCounter = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ID_COUNTER) || '0', 10);
  currentCounter += 1;
  localStorage.setItem(STORAGE_KEYS.LAST_ID_COUNTER, currentCounter.toString());

  // Format counter to 3 digits (e.g., 001, 002)
  const paddedNumber = String(currentCounter).padStart(3, '0');
  const year = new Date().getFullYear();
  return `GG-${year}-${paddedNumber}`;
}

/**
 * Formats a currency amount into Indian Rupee format (e.g. ₹500).
 * @param {number} amount 
 * @returns {string}
 */
function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into readable format: "10 Sep 2026".
 * @param {string} dateString 
 * @returns {string}
 */
function formatDisplayDate(dateString) {
  if (!dateString) return 'Not selected';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  return dateString;
}

/**
 * Helper to show temporary alert toast
 * @param {string} message 
 * @param {string} type 'success' | 'danger' | 'warning'
 */
function showToastNotification(message, type = 'success') {
  // Check if toast container exists, otherwise create it
  let container = document.getElementById('toastNotificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastNotificationContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1090';
    document.body.appendChild(container);
  }

  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'text-bg-success' : type === 'danger' ? 'text-bg-danger' : 'text-bg-warning';
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill';

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icon}"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastElem = document.getElementById(toastId);
  if (window.bootstrap && window.bootstrap.Toast) {
    const toastInstance = new window.bootstrap.Toast(toastElem, { delay: 4000 });
    toastInstance.show();
    toastElem.addEventListener('hidden.bs.toast', () => toastElem.remove());
  }
}
