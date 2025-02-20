// Constants and Cache
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzpLow9FVw-ZnRVpaFBshp5ZbMsEH_SnnHhMmOY8UBSToJowRYhXx8_0HRs2kfFy4tJ/exec';
const CACHE_DURATION = 300000; // 5 minutes
const searchCache = new Map();
const companyDetailsCache = new Map();

// Format Sri Lanka date and time
function formatSriLankaDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

// Get submission date time
function getSubmissionDateTime() {
    return CURRENT_SL_TIME;
}

// Validate name format
function validateNameFormat(name) {
    // Only allow uppercase letters and single space between words
    return /^[A-Z]+(?:\s[A-Z]+)*$/.test(name);
}

// Calculate age from date of birth
function calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = today.getUTCMonth() - birthDate.getUTCMonth();
    
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
        age--;
    }
    return age;
}

// Calculate passport expiry date
function calculateExpiry(issueDate) {
    const date = new Date(issueDate);
    date.setUTCFullYear(date.getUTCFullYear() + 10);
    return date.toISOString().split('T')[0];
}

// Check for duplicate passport
async function checkDuplicatePassport(passportNumber) {
    try {
        const response = await fetch(
            `${SCRIPT_URL}?action=checkDuplicate&passportNumber=${encodeURIComponent(passportNumber)}`,
            { method: 'GET', mode: 'cors' }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.isDuplicate;
    } catch (error) {
        console.error('Error checking duplicate passport:', error);
        throw new Error('Failed to check for duplicate passport number');
    }
}

// Optimized company search
let searchDebounceTimer;
async function searchCompanies(searchTerm) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  
  const searchResultsDiv = document.getElementById('searchResults');
  const term = searchTerm.trim();
  
  // Immediately clear results if search term is empty
  if (!term) {
    clearCompanyFields();
    searchResultsDiv.style.display = 'none';
    searchResultsDiv.innerHTML = '';
    return;
  }

  // Only search for 2 or more characters
  if (term.length < 2) {
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    try {
      searchResultsDiv.innerHTML = '<div class="search-loading">Searching...</div>';
      searchResultsDiv.style.display = 'block';

      const response = await fetch(
        `${SCRIPT_URL}?action=searchCompanies&term=${encodeURIComponent(term)}`,
        { method: 'GET', mode: 'cors' }
      );

      if (!response.ok) throw new Error('Network response was not ok');
      const companies = await response.json();
      displaySearchResults(companies);
    } catch (error) {
      console.error('Search error:', error);
      searchResultsDiv.innerHTML = '<div class="search-error">Error fetching results</div>';
    }
  }, 300);
}

// Update display results function
function displaySearchResults(companies) {
  const searchResultsDiv = document.getElementById('searchResults');
  searchResultsDiv.innerHTML = '';
  
  if (!Array.isArray(companies) || companies.length === 0) {
    searchResultsDiv.innerHTML = '<div class="search-no-results">No matching companies found</div>';
    searchResultsDiv.style.display = 'block';
    return;
  }

  const fragment = document.createDocumentFragment();
  companies.forEach(company => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    resultItem.innerHTML = `
      <div class="company-name">${company[0]}</div>
      <div class="company-details">
        <span class="customer-code">${company[1]}</span>
        ${company[2] ? ` • ${company[2]}` : ''}
        ${company[3] ? ` • ${company[3]}` : ''}
      </div>
    `;

    // Simplified click handler
    resultItem.addEventListener('click', () => {
      selectCompany(company);
    });

    fragment.appendChild(resultItem);
  });

  searchResultsDiv.appendChild(fragment);
  searchResultsDiv.style.display = 'block';
}

// New function to handle company selection
function selectCompany(company) {
  // Fill in the form fields
  const fields = {
    'companySearch': company[0],
    'customerCode': company[1],
    'town': company[2] || '',
    'district': company[3] || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
      // Only add filled class to readonly fields
      if (element.hasAttribute('readonly')) {
        element.classList.add('filled');
      }
    }
  });

  // Immediately hide and clear search results
  const searchResultsDiv = document.getElementById('searchResults');
  if (searchResultsDiv) {
    searchResultsDiv.style.display = 'none';
    searchResultsDiv.innerHTML = '';
  }

  // Clear any existing search cache
  searchCache.clear();

  // Validate the company search field
  validateField('companySearch');

  // Add focus to the next field after company selection
  const nextField = document.getElementById('participantName');
  if (nextField) {
    setTimeout(() => nextField.focus(), 100);
  }
}

// Optimized company details fill
function fillCompanyDetails(customerCode) {
  const company = companyDetailsCache.get(`company_${customerCode}`);
  if (!company) return;

  const fields = {
    'companySearch': company[0],
    'customerCode': company[1],
    'town': company[2] || '',
    'district': company[3] || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value;
  });

  document.getElementById('searchResults').style.display = 'none';
  validateField('companySearch');
}

// Validate field
function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}Error`);
    
    if (!field || !errorDiv) return true;

    let isValid = true;
    let errorMessage = '';

    field.classList.remove('error');
    errorDiv.textContent = '';

    switch(fieldId) {
        case 'participantName':
        case 'surname':
            if (field.value.trim() === '') {
                isValid = false;
                errorMessage = `${fieldId === 'participantName' ? 'Full Name' : 'Surname'} is required`;
            } else if (!validateNameFormat(field.value.trim())) {
                isValid = false;
                errorMessage = 'Only uppercase letters (A-Z) and single spaces between names are allowed';
            }
            break;

        case 'otherNames':
            if (field.value.trim() !== '' && !validateNameFormat(field.value.trim())) {
                isValid = false;
                errorMessage = 'Only uppercase letters (A-Z) and single spaces between names are allowed';
            }
            break;

        case 'companySearch':
            isValid = field.value.trim() !== '';
            errorMessage = 'Please select a company';
            break;

        case 'mobileNumber':
            const numericValue = field.value.replace(/\s/g, '');
            isValid = /^07[0-9]{8}$/.test(numericValue);
            errorMessage = 'Invalid mobile number format (07XXXXXXXX)';
            break;

        case 'passportNumber':
            isValid = /^[A-Z][0-9]{7,9}$/.test(field.value);
            errorMessage = 'Invalid passport format (1 letter followed by 7-9 digits)';
            break;

        case 'dateOfBirth':
            if (field.value) {
                const age = calculateAge(field.value);
                isValid = age >= 0;
                errorMessage = 'Date of birth cannot be in the future';
            } else {
                isValid = false;
                errorMessage = 'Date of birth is required';
            }
            break;

        case 'issueDate':
            if (field.value) {
                const issueDate = new Date(field.value);
                const today = new Date();
                isValid = issueDate <= today;
                errorMessage = 'Issue date cannot be in the future';
            } else {
                isValid = false;
                errorMessage = 'Issue date is required';
            }
            break;

        default:
            isValid = field.value.trim() !== '';
            errorMessage = `${field.getAttribute('placeholder') || 'This field'} is required`;
    }

    if (!isValid) {
        field.classList.add('error');
        errorDiv.textContent = errorMessage;
    }

    return isValid;
}

// Validate form
function validateForm() {
    let isValid = true;
    
    const requiredFields = [
        'companySearch',
        'customerCode',
        'town',
        'district',
        'participantName',
        'surname',
        'dateOfBirth',
        'mobileNumber',
        'passportNumber',
        'issueDate',
        'expiryDate',
        'tshirtSize',
        'relationshipStatus'
    ];

    requiredFields.forEach(fieldId => {
        if (!validateField(fieldId)) {
            isValid = false;
        }
    });

    const radioGroups = ['gender', 'mealPreference', 'additionalParticipants'];
    radioGroups.forEach(groupName => {
        const checked = document.querySelector(`input[name="${groupName}"]:checked`);
        const errorDiv = document.getElementById(`${groupName}Error`);
        
        if (!checked && errorDiv) {
            errorDiv.textContent = 'Please select an option';
            isValid = false;
        }
    });

    return isValid;
}

// Show success message
function showSuccessMessage(submissionDateTime) {
    const thankYouMessage = document.getElementById('thankYouMessage');
    
    thankYouMessage.innerHTML = `
        <div class="success-message">
            <div class="success-content">
                <div class="checkmark-circle">
                    <div class="checkmark"></div>
                </div>
                <h2 class="text-2xl font-bold text-green-700 mb-4">Thank You!</h2>
                <p class="text-gray-600 mb-6">
                    Your application has been successfully submitted.
                </p>
                <div class="submission-details p-4 bg-gray-50 rounded-lg mb-6">
                    <p class="text-sm text-gray-600">
                        <span class="font-medium">Submission Details:</span><br>
                        Submitted on: ${submissionDateTime}
                    </p>
                </div>
                <button type="button" onclick="resetForm()" 
                    class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Submit Another Application
                </button>
            </div>
        </div>
    `;
    thankYouMessage.classList.remove('hidden');
}

// Show/hide loading state
function showLoadingState(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const formInputs = document.getElementById('formInputs');
    const submitButton = document.querySelector('button[type="submit"]');
    const buttonText = document.getElementById('buttonText');
    const spinner = document.getElementById('spinner');

    if (show) {
        loadingOverlay.classList.add('visible');
        formInputs.style.opacity = '0.5';
        formInputs.style.pointerEvents = 'none';
        submitButton.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.classList.remove('hidden');
    } else {
        loadingOverlay.classList.remove('visible');
        formInputs.style.opacity = '1';
        formInputs.style.pointerEvents = 'auto';
        submitButton.disabled = false;
        buttonText.textContent = 'Submit Application';
        spinner.classList.add('hidden');
    }
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    showLoadingState(true);

    try {
        const form = document.getElementById('participantForm');
        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (['participantName', 'surname', 'otherNames'].includes(key)) {
                data[key] = value.trim().toUpperCase();
            } else if (['passportNumber'].includes(key)) {
                data[key] = value.trim().toUpperCase();
            } else if (key === 'mobileNumber') {
                // Remove spaces from mobile number before saving
                data[key] = value.trim().replace(/\s/g, '');
            } else {
                data[key] = value.trim();
            }
        }

        // Add submission metadata with Sri Lanka time
        data.submissionDateTime = formatSriLankaDateTime();

        const response = await fetch(
            `${SCRIPT_URL}?data=${encodeURIComponent(JSON.stringify(data))}`,
            {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.result === 'success') {
            document.getElementById('formInputs').style.display = 'none';
            showSuccessMessage(result.submissionDateTime);
        } else {
            const errorMessage = result.error;
            if (errorMessage.includes('(')) {
                const fieldName = errorMessage.split('(')[1].split(')')[0];
                const errorDiv = document.getElementById(`${fieldName}Error`);
                if (errorDiv) {
                    errorDiv.textContent = errorMessage.split('(')[0].trim();
                    const fieldElement = document.getElementById(fieldName);
                    if (fieldElement) {
                        fieldElement.classList.add('error');
                        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    alert(errorMessage);
                }
            } else {
                alert(errorMessage);
            }
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('Error submitting form. Please try again or contact support.');
    } finally {
        showLoadingState(false);
    }
}

// Reset form
function resetForm() {
    const form = document.getElementById('participantForm');
    const formInputs = document.getElementById('formInputs');
    const thankYouMessage = document.getElementById('thankYouMessage');
    
    form.reset();
    
    // Clear all error messages and states
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    
    // Reset readonly fields
    ['customerCode', 'town', 'district', 'age', 'expiryDate'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
        }
    });

    // Reset search results
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
    }
    
    formInputs.style.display = 'block';
    formInputs.style.opacity = '1';
    formInputs.style.pointerEvents = 'auto';
    thankYouMessage.classList.add('hidden');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update form listeners initialization
function initializeFormListeners() {
  const companySearchInput = document.getElementById('companySearch');
  const searchResultsDiv = document.getElementById('searchResults');
  const searchContainer = companySearchInput?.closest('.form-group');
  
  if (companySearchInput && searchContainer) {
    // Add active class when focusing search
    companySearchInput.addEventListener('focus', () => {
      searchContainer.classList.add('active');
      const searchTerm = companySearchInput.value.trim();
      if (searchTerm.length >= 2) {
        searchCompanies(searchTerm);
      }
    });

    // Remove active class when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        searchContainer.classList.remove('active');
        searchResultsDiv.style.display = 'none';
      }
    });

    // Handle input events
    companySearchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim();
      searchContainer.classList.add('active');
      
      if (!searchTerm) {
        clearCompanyFields();
        return;
      }
      
      searchCompanies(searchTerm);
    });
  }

  // Name fields listeners
  const nameFields = ['participantName', 'surname', 'otherNames'];
  nameFields.forEach(fieldId => {
      const input = document.getElementById(fieldId);
      if (input) {
          // Handle input events
          input.addEventListener('input', function(e) {
              // Convert to uppercase immediately
              let value = this.value.toUpperCase();
              
              // Remove any characters that aren't letters or spaces
              value = value.replace(/[^A-Z\s]/g, '');
              
              // Remove consecutive spaces
              value = value.replace(/\s{2,}/g, ' ');
              
              // Remove spaces at the start
              value = value.replace(/^\s/, '');
              
              // Update input value
              this.value = value;
              
              validateField(fieldId);
          });

          // Handle blur event
          input.addEventListener('blur', function() {
              // Remove space at the end
              this.value = this.value.trim().toUpperCase();
              validateField(fieldId);
          });

          // Handle paste event
          input.addEventListener('paste', function(e) {
              e.preventDefault();
              const text = (e.clipboardData || window.clipboardData).getData('text');
              
              // Clean the pasted text
              const cleaned = text
                  .toUpperCase() // Convert to uppercase
                  .replace(/[^A-Z\s]/g, '') // Remove non-letters and non-spaces
                  .replace(/\s{2,}/g, ' ') // Remove consecutive spaces
                  .trim(); // Remove leading and trailing spaces
              
              // Insert at cursor position
              const start = this.selectionStart;
              const end = this.selectionEnd;
              const before = this.value.substring(0, start);
              const after = this.value.substring(end);
              this.value = before + cleaned + after;
              
              // Move cursor to the right position
              const newCursorPos = start + cleaned.length;
              this.setSelectionRange(newCursorPos, newCursorPos);
              
              validateField(fieldId);
          });

          // Handle keydown to prevent lowercase input
          input.addEventListener('keydown', function(e) {
              if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                  if (!/[A-Z\s]/.test(e.key.toUpperCase())) {
                      e.preventDefault();
                  }
              }
          });
      }
  });

  // Date of birth listener
  const dateOfBirthInput = document.getElementById('dateOfBirth');
  if (dateOfBirthInput) {
      dateOfBirthInput.addEventListener('change', function() {
          const age = calculateAge(this.value);
          document.getElementById('age').value = age;
          validateField('dateOfBirth');
      });

      const today = new Date().toISOString().split('T')[0];
      dateOfBirthInput.setAttribute('max', today);
  }

  // Issue date listener
  const issueDateInput = document.getElementById('issueDate');
  if (issueDateInput) {
      issueDateInput.addEventListener('change', function() {
          const expiryDate = calculateExpiry(this.value);
          document.getElementById('expiryDate').value = expiryDate;
          validateField('issueDate');
      });

      const today = new Date().toISOString().split('T')[0];
      issueDateInput.setAttribute('max', today);
  }

  // Mobile number listener
  const mobileNumberInput = document.getElementById('mobileNumber');
  if (mobileNumberInput) {
      mobileNumberInput.addEventListener('input', function() {
          // Remove any non-digits
          let value = this.value.replace(/[^0-9]/g, '');
          
          // Truncate to max 10 digits
          if (value.length > 10) {
              value = value.slice(0, 10);
          }
          
          this.value = value;
          validateField('mobileNumber');
      });

      mobileNumberInput.addEventListener('blur', function() {
          if (this.value && !/^07/.test(this.value)) {
              this.value = '07' + this.value.replace(/^0+/, '');
          }
          validateField('mobileNumber');
      });
  }

  // Passport number listener with duplicate check
  const passportNumberInput = document.getElementById('passportNumber');
  if (passportNumberInput) {
      let timeoutId;
      
      passportNumberInput.addEventListener('input', function() {
          this.value = this.value.toUpperCase();
          
          if (timeoutId) {
              clearTimeout(timeoutId);
          }

          if (!validateField('passportNumber')) {
              return;
          }

          const errorDiv = document.getElementById('passportNumberError');
          errorDiv.textContent = 'Checking passport number...';
          
          // Debounce the API call (wait 500ms after user stops typing)
          timeoutId = setTimeout(async () => {
              try {
                  const isDuplicate = await checkDuplicatePassport(this.value);
                  if (isDuplicate) {
                      errorDiv.textContent = 'This passport number is already registered';
                      this.classList.add('error');
                  } else {
                      errorDiv.textContent = '';
                      this.classList.remove('error');
                  }
              } catch (error) {
                  console.error('Error:', error);
                  errorDiv.textContent = 'Error checking passport number';
                  this.classList.add('error');
              }
          }, 500);
      });

      passportNumberInput.addEventListener('blur', function() {
          validateField('passportNumber');
      });
  }

  // Form submit listener
  const form = document.getElementById('participantForm');
  if (form) {
      form.addEventListener('submit', handleSubmit);
  }

  // Close search results when clicking outside
  document.addEventListener('click', function(event) {
      const searchResults = document.getElementById('searchResults');
      const companySearch = document.getElementById('companySearch');
      
      // Only proceed if both elements exist
      if (searchResults && companySearch) {
          if (!companySearch.contains(event.target) && 
              !searchResults.contains(event.target)) {
              searchResults.style.display = 'none';
              searchResults.innerHTML = '';
          }
      }
  });
}

// Add helper function to clear company fields
function clearCompanyFields() {
  const searchResultsDiv = document.getElementById('searchResults');
  if (searchResultsDiv) {
    searchResultsDiv.style.display = 'none';
    searchResultsDiv.innerHTML = '';
  }
  
  ['companySearch', 'customerCode', 'town', 'district'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.value = '';
      element.classList.remove('filled');
    }
  });
  
  // Clear search cache
  searchCache.clear();
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeFormListeners();
    initializeProgress();
    
    // Update the current date time display with Sri Lanka time
    const currentDateTimeElement = document.getElementById('currentDateTime');
    if (currentDateTimeElement) {
        currentDateTimeElement.textContent = formatSriLankaDateTime();
    }
    
    // Live Time Update
    function updateTime() {
        const now = new Date();
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        let hours = now.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const timeString = `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
        document.getElementById('currentDateTime').textContent = timeString;
    }

    // Update time every second
    setInterval(updateTime, 1000);
    // Initial update
    updateTime();

    // Initialize AOS
    AOS.init({
      duration: 1000,
      once: true,
      offset: 100
    });

    // Load Lottie animations
    const animationFiles = {
      company: 'https://assets10.lottiefiles.com/packages/lf20_kyu7xb1v.json',
      personal: 'https://assets10.lottiefiles.com/packages/lf20_DMgKk1.json',
      preferences: 'https://assets10.lottiefiles.com/packages/lf20_q7qjguhk.json'
    };

    // Load animations into section headers
    Object.entries(animationFiles).forEach(([section, file]) => {
      const container = document.querySelector(`[data-section="${section}"] .lottie-icon`);
      if (container) {
        lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: file
        });
      }
    });

    // Add scroll animations to sections
    document.querySelectorAll('.form-section').forEach((section, index) => {
      section.setAttribute('data-aos', 'fade-up');
      section.setAttribute('data-aos-delay', (index * 100).toString());
    });
});

// Enhanced progress tracking
function initializeProgress() {
    const formSections = document.querySelectorAll('.form-section');
    formSections.forEach((section, index) => {
        // Add IDs to sections if they don't exist
        if (!section.id) {
            section.id = `section-${index}`;
        }
    });

    // Create Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionIndex = Array.from(formSections).indexOf(entry.target);
                updateProgressBar(sectionIndex);
            }
        });
    }, {
        threshold: 0.3,
        rootMargin: '-10% 0px -10% 0px'
    });

    formSections.forEach(section => observer.observe(section));
}

function updateProgressBar(activeIndex) {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        if (index < activeIndex) {
            step.classList.remove('active');
            step.classList.add('completed');
        } else if (index === activeIndex) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

// Update progress based on scroll position
function updateProgress() {
    const sections = ['company', 'personal', 'preferences'];
    const scrollPosition = window.scrollY + (window.innerHeight / 3);

    sections.forEach((sectionId, index) => {
        const section = document.querySelector(`[data-step="${sectionId}"]`).closest('.form-section');
        const sectionTop = section.offsetTop;
        const steps = document.querySelectorAll('.step');

        if (scrollPosition > sectionTop) {
            steps.forEach((step, stepIndex) => {
                if (stepIndex <= index) {
                    step.classList.add('active');
                    if (stepIndex < index) {
                        step.classList.add('completed');
                    }
                } else {
                    step.classList.remove('active', 'completed');
                }
            });
        }
    });
}

// Add scroll event listener
window.addEventListener('scroll', updateProgress);
document.addEventListener('DOMContentLoaded', updateProgress);