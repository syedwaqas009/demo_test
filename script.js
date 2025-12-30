// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCeIJU8GIGt9OJeAKGFO311Mz0kr8U1vss",
  authDomain: "webb-38c3e.firebaseapp.com",
  databaseURL: "https://webb-38c3e-default-rtdb.firebaseio.com",
  projectId: "webb-38c3e",
  storageBucket: "webb-38c3e.firebasestorage.app",
  messagingSenderId: "573640491478",
  appId: "1:573640491478:web:01beb89a6c61084435e477"
};

// Stripe Configuration
const STRIPE_PUBLIC_KEY = 'pk_test_51SjJLnLzuSrxq3B6HSZqDARNnAGWfpLpAKoeySr7Lpg1tgWx0MMCzel3WpXMCJfIrRsw687JfRLjmxAX18tlfFaf00vN39WNlZ';
const STRIPE_SECRET_KEY = 'sk_test_51SjJLnLzuSrxq3B6U46Li4nEt4w30TAk4XRMl0klj9cYOKxRssVJLqXVOEoBj5bT3Pj3U2XbijXA52kR43j1uIyT00TDBnnmgp'; // This should only be used server-side

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// API Configuration - Update this URL to your Flask API server
// For local development: http://localhost:5000
// For deployed server: your-deployed-server-url.com
const API_BASE_URL = 'http://localhost:5000'; // Change this to match your Flask server

// Global Variables
let currentUser = null;
let userData = null;
let userCredits = 0;
let userPackage = null;
let packageExpiry = null;
let enhancementLevel = 2;
let currentProcessing = {
    bgRemove: { before: null, after: null },
    enhance: { before: null, after: null }
};

// Stripe Variables
let stripe = null;
let elements = null;
let cardElement = null;
let paymentIntentClientSecret = null;
let currentPackage = null;

// Package Definitions
const packages = {
    starter: {
        name: "Starter Pack",
        price: 5,
        credits: 100,
        duration: 30, // days
        stripe_price_id: "price_starter", // You need to create this in Stripe Dashboard
        product_id: "prod_starter"
    },
    growth: {
        name: "Growth Pack",
        price: 10,
        credits: 250,
        duration: 30,
        stripe_price_id: "price_growth",
        product_id: "prod_growth"
    },
    pro: {
        name: "Pro Pack",
        price: 17,
        credits: 500,
        duration: 30,
        stripe_price_id: "price_pro",
        product_id: "prod_pro"
    }
};

// Toastr Configuration
toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": true,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

// DOM Elements
const loginModal = document.getElementById('loginModal');
const paymentModal = document.getElementById('paymentModal');
const successModal = document.getElementById('successModal');
const closeModalBtn = document.querySelector('.close-modal');
const closePaymentModalBtn = document.querySelector('.close-payment-modal');
const closeSuccessModalBtn = document.getElementById('closeSuccessModal');
const cancelPaymentBtn = document.getElementById('cancel-payment');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const authBtn = document.getElementById('authBtn');
const signOutBtn = document.getElementById('signOutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const userGreeting = document.getElementById('userGreeting');
const userName = document.getElementById('userName');
const userDropdown = document.getElementById('userDropdown');
const bgRemoveInput = document.getElementById('bgRemoveInput');
const enhanceInput = document.getElementById('enhanceInput');
const modalLoading = document.getElementById('modalLoading');
const paymentForm = document.getElementById('payment-form');
const submitPaymentBtn = document.getElementById('submit-payment');
const paymentSpinner = document.getElementById('payment-spinner');
const buttonText = document.getElementById('button-text');
const cardErrors = document.getElementById('card-errors');

// Pricing buttons
let pricingButtons = [];

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize event listeners first
    initEventListeners();
    
    // Initialize hero slider
    initHeroSlider();
    
    // Initialize Stripe
    initializeStripe();
    
    // Check if user is already signed in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await handleUserSignIn(user);
        } else {
            handleUserSignOut();
        }
    });

    // Check API health
    checkAPIHealth();
    
    // Initialize pricing buttons
    initPricingButtons();
});

// Initialize Pricing Buttons
function initPricingButtons() {
    // Get all pricing buttons
    pricingButtons = document.querySelectorAll('.pricing-card .btn');
    
    pricingButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Determine which plan was clicked based on button text or parent card
            const card = this.closest('.pricing-card');
            let plan = 'starter'; // default
            
            // Check which plan this button belongs to
            if (card.querySelector('.pricing-header h3').textContent.includes('Starter')) {
                plan = 'starter';
            } else if (card.querySelector('.pricing-header h3').textContent.includes('Growth')) {
                plan = 'growth';
            } else if (card.querySelector('.pricing-header h3').textContent.includes('Pro')) {
                plan = 'pro';
            }
            
            selectPlan(plan);
        });
    });
}

// Check if user has active package that prevents new purchases
function hasActivePackage() {
    if (!currentUser) return false;
    
    // Check if user has a non-free package
    if (!userPackage || userPackage === 'free') {
        return false;
    }
    
    // Check if package is expired
    if (packageExpiry) {
        const expiryDate = new Date(packageExpiry);
        const now = new Date();
        if (now > expiryDate) {
            return false; // Package expired
        }
    }
    
    // Check if credits are below 4
    if (userCredits < 4) {
        return false; // Can purchase new package
    }
    
    // User has active package with 4+ credits
    return true;
}

// Update pricing buttons based on user's eligibility
function updatePricingButtons() {
    const canPurchase = !hasActivePackage();
    
    pricingButtons.forEach(button => {
        if (canPurchase) {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.title = '';
        } else {
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
            button.title = 'You already have an active package. Purchase will be available when credits drop below 4 or package expires.';
            
            // Add tooltip indicator
            if (!button.querySelector('.package-active-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'package-active-indicator';
                indicator.innerHTML = '<i class="fas fa-crown"></i> Active Package';
                indicator.style.cssText = `
                    display: block;
                    font-size: 0.8rem;
                    color: #f59e0b;
                    margin-top: 0.5rem;
                `;
                button.appendChild(indicator);
            }
        }
    });
}

// Check purchase eligibility
function checkPurchaseEligibility() {
    if (!currentUser) {
        return {
            eligible: false,
            reason: 'Please sign in to purchase a package'
        };
    }
    
    if (hasActivePackage()) {
        return {
            eligible: false,
            reason: 'You already have an active package. You can purchase a new package when your credits drop below 4 or your current package expires.'
        };
    }
    
    return {
        eligible: true,
        reason: ''
    };
}

// Initialize Stripe
function initializeStripe() {
    stripe = Stripe(STRIPE_PUBLIC_KEY);
    elements = stripe.elements();
    
    // Create card element
    const style = {
        base: {
            color: '#ffffff',
            fontFamily: '"Poppins", sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
                color: '#94a3b8'
            }
        },
        invalid: {
            color: '#ef4444',
            iconColor: '#ef4444'
        }
    };
    
    cardElement = elements.create('card', {
        style: style,
        hidePostalCode: true
    });
    
    cardElement.mount('#card-element');
    
    // Handle real-time validation errors
    cardElement.addEventListener('change', (event) => {
        if (event.error) {
            cardErrors.textContent = event.error.message;
            cardErrors.style.color = '#ef4444';
        } else {
            cardErrors.textContent = '';
        }
    });
}

// Initialize Event Listeners
function initEventListeners() {
    // Modals
    closeModalBtn.addEventListener('click', () => {
        loginModal.style.display = 'none';
        modalLoading.classList.remove('active');
    });

    closePaymentModalBtn.addEventListener('click', closePaymentModal);
    cancelPaymentBtn.addEventListener('click', closePaymentModal);
    closeSuccessModalBtn.addEventListener('click', closeSuccessModal);

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
            modalLoading.classList.remove('active');
        }
        if (e.target === paymentModal) {
            closePaymentModal();
        }
        if (e.target === successModal) {
            closeSuccessModal();
        }
    });

    // Authentication
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    authBtn.addEventListener('click', () => {
        if (currentUser) {
            userDropdown.classList.toggle('show');
        } else {
            loginModal.style.display = 'block';
        }
    });

    signOutBtn.addEventListener('click', signOut);
    deleteAccountBtn.addEventListener('click', deleteAccount);

    // File uploads
    bgRemoveInput.addEventListener('change', (e) => handleFileUpload(e, 'bgRemove'));
    enhanceInput.addEventListener('change', (e) => handleFileUpload(e, 'enhance'));

    // Payment form
    paymentForm.addEventListener('submit', handlePaymentSubmit);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-section')) {
            userDropdown.classList.remove('show');
        }
    });

    // Mobile menu
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu on click
    document.querySelectorAll('.nav-menu a').forEach(n => n.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }));
}

// Initialize Hero Slider - Professional Version
function initHeroSlider() {
    const sliderHandle = document.getElementById('heroSliderHandle');
    const heroDivider = document.getElementById('heroDivider');
    const heroBefore = document.getElementById('heroBefore');
    const heroAfter = document.getElementById('heroAfter');
    const heroDemo = document.getElementById('heroDemo');
    
    if (!sliderHandle || !heroDivider || !heroBefore || !heroAfter) return;
    
    let isDragging = false;
    let currentPosition = 50; // Start at 50%
    
    // Set initial position
    updateSliderPosition(currentPosition);
    
    // Mouse events
    sliderHandle.addEventListener('mousedown', startDrag);
    heroDemo.addEventListener('mousedown', startDragFromArea);
    
    // Touch events for mobile
    sliderHandle.addEventListener('touchstart', startDragTouch, { passive: false });
    heroDemo.addEventListener('touchstart', startDragFromAreaTouch, { passive: false });
    
    function startDrag(e) {
        isDragging = true;
        sliderHandle.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }
    
    function startDragFromArea(e) {
        if (e.target === sliderHandle || e.target.closest('.slider-handle')) return;
        
        const rect = heroDemo.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        currentPosition = Math.max(5, Math.min(95, percentage));
        updateSliderPosition(currentPosition);
        
        // Start dragging from this position
        isDragging = true;
        sliderHandle.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }
    
    function startDragTouch(e) {
        if (e.touches.length !== 1) return;
        
        isDragging = true;
        document.addEventListener('touchmove', onDragTouch, { passive: false });
        document.addEventListener('touchend', stopDrag);
        e.preventDefault();
    }
    
    function startDragFromAreaTouch(e) {
        if (e.touches.length !== 1) return;
        
        const rect = heroDemo.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        currentPosition = Math.max(5, Math.min(95, percentage));
        updateSliderPosition(currentPosition);
        
        // Start dragging from this position
        isDragging = true;
        document.addEventListener('touchmove', onDragTouch, { passive: false });
        document.addEventListener('touchend', stopDrag);
        e.preventDefault();
    }
    
    function onDrag(e) {
        if (!isDragging) return;
        
        const rect = heroDemo.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        currentPosition = Math.max(5, Math.min(95, percentage));
        updateSliderPosition(currentPosition);
    }
    
    function onDragTouch(e) {
        if (!isDragging || e.touches.length !== 1) return;
        
        const rect = heroDemo.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        currentPosition = Math.max(5, Math.min(95, percentage));
        updateSliderPosition(currentPosition);
        e.preventDefault();
    }
    
    function stopDrag() {
        isDragging = false;
        sliderHandle.style.cursor = 'ew-resize';
        
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDragTouch);
        document.removeEventListener('touchend', stopDrag);
    }
    
    function updateSliderPosition(percentage) {
        // Update slider handle position
        sliderHandle.style.left = `${percentage}%`;
        heroDivider.style.left = `${percentage}%`;
        
        // Update image clipping
        // The "after" image shows everything to the left of the slider
        heroAfter.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
        
        // The "before" image shows everything to the right of the slider
        heroBefore.style.clipPath = `polygon(${percentage}% 0, 100% 0, 100% 100%, ${percentage}% 100%)`;
    }
    
    // Initialize with default position
    updateSliderPosition(currentPosition);
    
    // Add keyboard controls for accessibility
    sliderHandle.setAttribute('tabindex', '0');
    sliderHandle.setAttribute('role', 'slider');
    sliderHandle.setAttribute('aria-label', 'Before and after image comparison slider');
    sliderHandle.setAttribute('aria-valuemin', '5');
    sliderHandle.setAttribute('aria-valuemax', '95');
    sliderHandle.setAttribute('aria-valuenow', '50');
    
    sliderHandle.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                currentPosition = Math.max(5, currentPosition - 5);
                updateSliderPosition(currentPosition);
                sliderHandle.setAttribute('aria-valuenow', currentPosition);
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                currentPosition = Math.min(95, currentPosition + 5);
                updateSliderPosition(currentPosition);
                sliderHandle.setAttribute('aria-valuenow', currentPosition);
                e.preventDefault();
                break;
            case 'Home':
                currentPosition = 5;
                updateSliderPosition(currentPosition);
                sliderHandle.setAttribute('aria-valuenow', currentPosition);
                e.preventDefault();
                break;
            case 'End':
                currentPosition = 95;
                updateSliderPosition(currentPosition);
                sliderHandle.setAttribute('aria-valuenow', currentPosition);
                e.preventDefault();
                break;
        }
    });
    
    // Add smooth animation for demo effect on page load
    setTimeout(() => {
        animateSliderDemo();
    }, 1000);
}

// Animate slider for demo effect
function animateSliderDemo() {
    const sliderHandle = document.getElementById('heroSliderHandle');
    if (!sliderHandle) return;
    
    let isAnimating = false;
    
    // Animate on first view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isAnimating) {
                isAnimating = true;
                startDemoAnimation();
            }
        });
    }, { threshold: 0.5 });
    
    observer.observe(sliderHandle);
    
    function startDemoAnimation() {
        let position = 50;
        let direction = -1; // Start moving left
        let speed = 0.5;
        
        function animate() {
            position += speed * direction;
            
            if (position <= 25) {
                direction = 1; // Change direction to right
            } else if (position >= 75) {
                direction = -1; // Change direction to left
                // After one full cycle, stop animation
                clearInterval(animation);
                return;
            }
            
            updateSliderPosition(position);
        }
        
        const animation = setInterval(animate, 16); // ~60fps
    }
}

// Authentication Functions
async function signInWithGoogle() {
    modalLoading.classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        const result = await auth.signInWithPopup(provider);
        await handleUserSignIn(result.user);
        loginModal.style.display = 'none';
        toastr.success('Successfully signed in!');
    } catch (error) {
        console.error('Google sign-in error:', error);
        toastr.error('Failed to sign in. Please try again.');
    } finally {
        modalLoading.classList.remove('active');
    }
}

async function handleUserSignIn(user) {
    currentUser = user;
    userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
    };

    // Update UI
    userName.textContent = user.displayName || user.email;
    userGreeting.style.display = 'flex';
    authBtn.innerHTML = '<i class="fas fa-user-circle"></i> Account';
    
    // Load user data from database
    await loadUserData(user.uid);
    
    // Update credits display
    updateCreditsDisplay();
    
    // Update pricing buttons based on package status
    updatePricingButtons();
}

async function loadUserData(uid) {
    const userRef = database.ref('users/' + uid);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
        // New user - create record with free tier
        await userRef.set({
            email: userData.email,
            name: userData.displayName,
            credits: 3,
            package: 'free',
            package_expiry: null,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP,
            stripe_customer_id: null,
            purchases: []
        });
        userCredits = 3;
        userPackage = 'free';
        packageExpiry = null;
        toastr.info('Welcome! You have 3 free credits to start.');
    } else {
        const userDataDB = snapshot.val();
        userCredits = userDataDB.credits || 0;
        userPackage = userDataDB.package || 'free';
        packageExpiry = userDataDB.package_expiry || null;
        
        // Check package expiry
        await checkPackageExpiry();
        
        await userRef.update({
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

async function checkPackageExpiry() {
    if (!packageExpiry || userCredits === 0) {
        // Package expired or no credits
        if (userPackage !== 'free') {
            await downgradeToFree();
        }
        return;
    }
    
    const expiryDate = new Date(packageExpiry);
    const now = new Date();
    
    if (now > expiryDate) {
        // Package expired
        await downgradeToFree();
    }
}

async function downgradeToFree() {
    const userRef = database.ref('users/' + currentUser.uid);
    await userRef.update({
        package: 'free',
        package_expiry: null,
        credits: 3
    });
    
    userPackage = 'free';
    packageExpiry = null;
    userCredits = 3;
    
    toastr.warning('Your package has expired. Downgraded to free plan.');
    
    // Update pricing buttons since user can now purchase
    updatePricingButtons();
}

function handleUserSignOut() {
    currentUser = null;
    userData = null;
    userCredits = 0;
    userPackage = null;
    packageExpiry = null;
    
    // Update UI
    userGreeting.style.display = 'none';
    authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    userDropdown.classList.remove('show');
    
    // Reset credit display
    document.querySelectorAll('.credit-display').forEach(el => el.remove());
    
    // Reset pricing buttons
    updatePricingButtons();
}

async function signOut() {
    try {
        await auth.signOut();
        handleUserSignOut();
        toastr.success('Successfully signed out');
    } catch (error) {
        console.error('Sign out error:', error);
        toastr.error('Failed to sign out');
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }

    try {
        // Delete user data from database
        await database.ref('users/' + currentUser.uid).remove();
        
        // Delete user from Firebase Auth
        await currentUser.delete();
        
        toastr.success('Account deleted successfully');
        handleUserSignOut();
    } catch (error) {
        console.error('Delete account error:', error);
        toastr.error('Failed to delete account. Please try again.');
    }
}

// File Handling Functions
function handleFileUpload(event, toolType) {
    const file = event.target.files[0];
    if (file && isImageFile(file)) {
        processFile(file, toolType);
    } else {
        toastr.error('Please select a valid image file (PNG, JPG, JPEG, WEBP)');
    }
}

function isImageFile(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    return validTypes.includes(file.type);
}

async function processFile(file, toolType) {
    // Check authentication
    if (!currentUser) {
        loginModal.style.display = 'block';
        toastr.warning('Please sign in to use this feature');
        return;
    }
    
    // Check package expiry
    await checkPackageExpiry();
    
    // Check credits
    if (userCredits <= 0) {
        showNoCreditsNotification(toolType);
        return;
    }
    
    // Show processing UI
    const uploadArea = document.getElementById(`${toolType}Upload`);
    const processingSection = document.getElementById(`${toolType}Processing`);
    const loadingOverlay = document.getElementById(`${toolType}Loading`);
    
    uploadArea.style.display = 'none';
    processingSection.style.display = 'block';
    loadingOverlay.style.display = 'flex';
    
    // Read file and display before image
    const reader = new FileReader();
    reader.onload = async (e) => {
        const beforeImage = document.getElementById(`${toolType}Before`);
        beforeImage.src = e.target.result;
        currentProcessing[toolType].before = e.target.result;
        
        // Process with real API
        await processWithRealAPI(file, toolType);
    };
    reader.readAsDataURL(file);
}

// Show custom no credits notification with smooth animation
function showNoCreditsNotification(toolType) {
    // Remove any existing no-credits notification
    const existingNotification = document.querySelector('.no-credits-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'no-credits-notification';
    
    // Determine tool name for message
    const toolName = toolType === 'bgRemove' ? 'background removal' : 'image enhancement';
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fas fa-coins"></i>
            </div>
            <div class="notification-text">
                <h4>No Credits Remaining</h4>
                <p>You have used all your free credits for ${toolName}.</p>
                <p>Upgrade to continue using AI Vision Pro!</p>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-actions">
            <button class="btn btn-primary upgrade-btn">
                <i class="fas fa-crown"></i> View Plans
            </button>
            <button class="btn btn-outline close-btn">
                Close
            </button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 20px;
        padding: 2rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        width: 90%;
        max-width: 400px;
        z-index: 9999;
        box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        animation: notificationSlideIn 0.5s ease-out forwards;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    `;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'notification-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9998;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease-out forwards;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes notificationSlideIn {
            from {
                opacity: 0;
                transform: translate(-50%, -60%) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .notification-content {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        
        .notification-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            color: white;
            flex-shrink: 0;
        }
        
        .notification-text {
            flex: 1;
        }
        
        .notification-text h4 {
            font-size: 1.3rem;
            margin-bottom: 0.5rem;
            color: #f59e0b;
        }
        
        .notification-text p {
            color: #cbd5e1;
            margin-bottom: 0.25rem;
            font-size: 0.95rem;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0.25rem;
            transition: color 0.3s;
            align-self: flex-start;
        }
        
        .notification-close:hover {
            color: white;
        }
        
        .notification-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
        }
        
        .notification-actions .btn {
            flex: 1;
            padding: 0.75rem 1rem;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.appendChild(notification);
    
    // Add event listeners
    const closeBtn = notification.querySelector('.notification-close');
    const upgradeBtn = notification.querySelector('.upgrade-btn');
    const overlayCloseBtn = notification.querySelector('.close-btn');
    
    closeBtn.addEventListener('click', closeNotification);
    overlayCloseBtn.addEventListener('click', closeNotification);
    upgradeBtn.addEventListener('click', () => {
        closeNotification();
        setTimeout(() => {
            scrollToPricing();
        }, 300);
    });
    
    overlay.addEventListener('click', closeNotification);
    
    function closeNotification() {
        // Animate out
        notification.style.animation = 'notificationSlideIn 0.3s ease-out reverse forwards';
        overlay.style.animation = 'fadeIn 0.3s ease-out reverse forwards';
        
        setTimeout(() => {
            notification.remove();
            overlay.remove();
            style.remove();
        }, 300);
    }
    
    // Auto-close after 10 seconds
    setTimeout(closeNotification, 10000);
}

// Real API Integration
async function processWithRealAPI(file, toolType) {
    const loadingOverlay = document.getElementById(`${toolType}Loading`);
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        
        let endpoint = '';
        
        if (toolType === 'bgRemove') {
            endpoint = '/api/remove-background';
        } else {
            endpoint = '/api/enhance-image';
            formData.append('level', enhancementLevel);
        }
        
        // Show loading progress
        showProcessingProgress(toolType, 30);
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            body: formData
        });
        
        showProcessingProgress(toolType, 70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }
        
        const result = await response.json();
        
        showProcessingProgress(toolType, 100);
        
        if (result.status === 'success') {
            // Deduct credit
            await deductCredit();
            
            // Display processed image
            const afterImage = document.getElementById(`${toolType}After`);
            const imageSrc = `data:image/${result.format};base64,${result.image}`;
            afterImage.src = imageSrc;
            currentProcessing[toolType].after = imageSrc;
            
            // Hide loading overlay
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                
                // Show success message
                toastr.success(`${toolType === 'bgRemove' ? 'Background removed' : 'Image enhanced'} successfully!`);
                
                // Update stats for enhancement
                if (toolType === 'enhance') {
                    updateEnhancementStats(result.enhancement_level || enhancementLevel, result.size || file.size);
                }
                
                // Initialize comparison slider
                initToolSlider(toolType);
            }, 500);
            
        } else {
            throw new Error(result.error || 'Processing failed');
        }
        
    } catch (error) {
        console.error('API Processing error:', error);
        toastr.error(`Failed to process image: ${error.message}`);
        
        // Restore credit
        await restoreCredit();
        
        // Reset UI
        loadingOverlay.style.display = 'none';
        resetTool(toolType);
    }
}

// Initialize tool comparison slider
function initToolSlider(toolType) {
    const slider = document.querySelector(`#${toolType}Processing .tool-slider`);
    const divider = document.getElementById(`${toolType}Divider`);
    
    if (!slider || !divider) return;
    
    // Reset to middle position
    slider.value = 50;
    divider.style.left = '50%';
    
    // Update slider position on input
    slider.addEventListener('input', (e) => {
        moveToolDivider(e.target, toolType);
    });
}

function moveToolDivider(slider, toolType) {
    const divider = document.getElementById(`${toolType}Divider`);
    if (divider) {
        divider.style.left = `${slider.value}%`;
    }
}

function showProcessingProgress(toolType, percentage) {
    const progressBar = document.querySelector(`#${toolType}Processing .processing-progress`);
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.style.animation = 'none';
        
        // Update progress text
        const header = document.querySelector(`#${toolType}Processing .processing-header h4`);
        if (header) {
            header.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing... ${percentage}%`;
        }
    }
}

function updateEnhancementStats(level, processedSize) {
    const resolutionIncrease = document.getElementById('resolutionIncrease');
    const qualityImprovement = document.getElementById('qualityImprovement');
    const psnrScore = document.getElementById('psnrScore');
    
    // Calculate stats based on enhancement level
    const resolutionBoost = level * 75; // 75%, 150%, 225%, 300%
    const qualityBoost = level * 20; // 20%, 40%, 60%, 80%
    const psnr = 25 + (level * 3); // 28, 31, 34, 37 dB
    
    resolutionIncrease.textContent = `+${resolutionBoost}%`;
    qualityImprovement.textContent = `+${qualityBoost}%`;
    psnrScore.textContent = `${psnr} dB`;
}

// Credit Management
async function deductCredit() {
    if (!currentUser) return;
    
    userCredits--;
    await database.ref('users/' + currentUser.uid).update({
        credits: userCredits
    });
    
    updateCreditsDisplay();
    
    // Check if credits dropped below 4, enable purchase buttons if needed
    if (userCredits < 4 && hasActivePackage()) {
        updatePricingButtons();
    }
    
    // Show warning toast when credits are low (1 or 2 credits left)
    if (userCredits === 1) {
        showLowCreditWarning();
    }
}

async function restoreCredit() {
    if (!currentUser) return;
    
    userCredits++;
    await database.ref('users/' + currentUser.uid).update({
        credits: userCredits
    });
    
    updateCreditsDisplay();
    
    // Check if credits are now 4 or more, disable purchase buttons if needed
    if (userCredits >= 4 && hasActivePackage()) {
        updatePricingButtons();
    }
}

// Show warning when credits are low
function showLowCreditWarning() {
    toastr.warning('Only 1 credit remaining! Consider upgrading your plan.', 'Low Credits', {
        timeOut: 6000,
        extendedTimeOut: 2000
    });
}

// Update credits display with package info
function updateCreditsDisplay() {
    // Remove existing credit displays
    document.querySelectorAll('.credit-display').forEach(el => el.remove());
    
    if (currentUser) {
        const creditElement = document.createElement('div');
        creditElement.className = 'credit-display';
        
        // Determine color and icon
        let creditColor = '#10b981'; // Green
        let icon = 'fas fa-coins';
        let packageInfo = '';
        
        if (userCredits === 0) {
            creditColor = '#ef4444'; // Red
            icon = 'fas fa-exclamation-circle';
        } else if (userCredits <= 10) {
            creditColor = '#f59e0b'; // Orange/Yellow
            icon = 'fas fa-exclamation-triangle';
        }
        
        // Add package info if not free
        if (userPackage && userPackage !== 'free') {
            const expiryDate = new Date(packageExpiry);
            const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
            const packageName = userPackage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            if (hasActivePackage()) {
                packageInfo = `<small class="active-package">${packageName} | ${daysLeft} days left</small>`;
            } else {
                packageInfo = `<small>${packageName} expired</small>`;
            }
        }
        
        creditElement.innerHTML = `
            <i class="${icon}"></i>
            <div class="credit-info">
                <span class="credit-count">${userCredits} Credits</span>
                ${packageInfo}
            </div>
        `;
        
        creditElement.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, ${creditColor} 0%, ${creditColor}80 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            z-index: 100;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            animation: fadeIn 0.3s ease-out;
            cursor: pointer;
            transition: transform 0.3s, box-shadow 0.3s;
            min-width: 160px;
        `;
        
        // Add CSS for active package indicator
        const style = document.createElement('style');
        style.textContent = `
            .active-package {
                color: #fde047 !important;
                font-weight: 600 !important;
            }
        `;
        document.head.appendChild(style);
        
        // Add hover effect
        creditElement.addEventListener('mouseenter', () => {
            creditElement.style.transform = 'scale(1.05)';
            creditElement.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.4)';
        });
        
        creditElement.addEventListener('mouseleave', () => {
            creditElement.style.transform = 'scale(1)';
            creditElement.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
        });
        
        // Click to go to pricing or show package info
        creditElement.addEventListener('click', () => {
            if (userCredits === 0) {
                showNoCreditsNotification('general');
            } else if (hasActivePackage()) {
                toastr.info('You have an active package. You can purchase a new package when your credits drop below 4.');
            } else {
                scrollToPricing();
            }
        });
        
        document.body.appendChild(creditElement);
    }
}

// Tool Functions
function setEnhancementLevel(level) {
    enhancementLevel = level;
    
    // Update UI
    document.querySelectorAll('.level-btn').forEach(btn => {
        if (parseInt(btn.dataset.level) === level) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function downloadImage(toolType) {
    if (!currentProcessing[toolType].after) {
        toastr.error('No image to download');
        return;
    }
    
    const link = document.createElement('a');
    link.href = currentProcessing[toolType].after;
    link.download = `ai-vision-pro-${toolType}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toastr.success('Image downloaded successfully!');
}

function resetTool(toolType) {
    const uploadArea = document.getElementById(`${toolType}Upload`);
    const processingSection = document.getElementById(`${toolType}Processing`);
    const loadingOverlay = document.getElementById(`${toolType}Loading`);
    
    uploadArea.style.display = 'block';
    processingSection.style.display = 'none';
    loadingOverlay.style.display = 'none';
    
    // Reset file input
    const fileInput = document.getElementById(`${toolType}Input`);
    if (fileInput) fileInput.value = '';
    
    // Reset progress bar
    const progressBar = document.querySelector(`#${toolType}Processing .processing-progress`);
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.animation = 'processing 2s ease-in-out infinite';
    }
    
    // Reset header text
    const header = document.querySelector(`#${toolType}Processing .processing-header h4`);
    if (header) {
        if (toolType === 'bgRemove') {
            header.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        } else {
            header.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enhancing Image...`;
        }
    }
    
    // Reset processing data
    currentProcessing[toolType] = { before: null, after: null };
}

// Pricing Functions
function selectPlan(plan) {
    if (!currentUser) {
        loginModal.style.display = 'block';
        toastr.warning('Please sign in to purchase a package');
        return;
    }
    
    // Check purchase eligibility
    const eligibility = checkPurchaseEligibility();
    if (!eligibility.eligible) {
        toastr.warning(eligibility.reason);
        return;
    }
    
    currentPackage = packages[plan];
    if (!currentPackage) {
        toastr.error('Invalid package selected');
        return;
    }
    
    // Update modal with package details
    document.getElementById('selectedPackageName').textContent = currentPackage.name;
    document.getElementById('selectedPackagePrice').textContent = `$${currentPackage.price}`;
    document.getElementById('selectedPackageCredits').textContent = currentPackage.credits;
    document.getElementById('selectedPackageDuration').textContent = `${currentPackage.duration} days`;
    
    // Show payment modal
    showPaymentModal();
}

function showPaymentModal() {
    paymentModal.style.display = 'block';
    
    // Clear any previous errors
    cardErrors.textContent = '';
    
    // Clear card element
    cardElement.clear();
}

function closePaymentModal() {
    paymentModal.style.display = 'none';
    currentPackage = null;
    paymentIntentClientSecret = null;
    
    // Reset form
    paymentForm.reset();
    cardElement.clear();
    cardErrors.textContent = '';
    submitPaymentBtn.disabled = false;
    buttonText.textContent = 'Pay Now';
    paymentSpinner.classList.add('hidden');
}

function closeSuccessModal() {
    successModal.style.display = 'none';
}

// Payment Handling
async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    if (!currentUser || !currentPackage) {
        toastr.error('Please sign in and select a package');
        return;
    }
    
    // Check purchase eligibility again (in case something changed)
    const eligibility = checkPurchaseEligibility();
    if (!eligibility.eligible) {
        toastr.warning(eligibility.reason);
        closePaymentModal();
        return;
    }
    
    // Disable submit button
    submitPaymentBtn.disabled = true;
    buttonText.textContent = 'Processing...';
    paymentSpinner.classList.remove('hidden');
    
    try {
        // Create payment intent via your backend
        const response = await fetch(`${API_BASE_URL}/api/create-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                package: currentPackage.name,
                price: currentPackage.price,
                credits: currentPackage.credits,
                duration: currentPackage.duration,
                user_id: currentUser.uid,
                email: currentUser.email
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create payment intent');
        }
        
        const { clientSecret, paymentIntentId } = await response.json();
        paymentIntentClientSecret = clientSecret;
        
        // Confirm payment with Stripe
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    email: currentUser.email,
                    name: currentUser.displayName
                }
            }
        });
        
        if (error) {
            throw error;
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Payment successful - activate package
            await activatePackage(paymentIntent.id);
            
            // Show success modal
            showSuccessModal();
            
            // Close payment modal
            closePaymentModal();
        } else {
            throw new Error('Payment failed');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        cardErrors.textContent = error.message || 'Payment failed. Please try again.';
        cardErrors.style.color = '#ef4444';
        toastr.error('Payment failed: ' + error.message);
        
        // Re-enable submit button
        submitPaymentBtn.disabled = false;
        buttonText.textContent = 'Pay Now';
        paymentSpinner.classList.add('hidden');
    }
}

async function activatePackage(paymentIntentId) {
    try {
        const userRef = database.ref('users/' + currentUser.uid);
        
        // Calculate expiry date
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setDate(now.getDate() + currentPackage.duration);
        
        // Update user data
        await userRef.update({
            package: currentPackage.name.toLowerCase().replace(' ', '_'),
            package_expiry: expiryDate.toISOString(),
            credits: userCredits + currentPackage.credits,
            last_purchase: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Add to purchase history
        const purchaseRef = database.ref(`purchases/${currentUser.uid}`).push();
        await purchaseRef.set({
            package: currentPackage.name,
            price: currentPackage.price,
            credits: currentPackage.credits,
            duration: currentPackage.duration,
            payment_intent_id: paymentIntentId,
            stripe_customer_id: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'completed'
        });
        
        // Update local variables
        userPackage = currentPackage.name.toLowerCase().replace(' ', '_');
        packageExpiry = expiryDate.toISOString();
        userCredits += currentPackage.credits;
        
        // Update display
        updateCreditsDisplay();
        
        // Update pricing buttons (now disabled)
        updatePricingButtons();
        
    } catch (error) {
        console.error('Error activating package:', error);
        throw error;
    }
}

function showSuccessModal() {
    document.getElementById('successMessage').textContent = 
        `Your ${currentPackage.name} has been activated successfully!`;
    
    document.getElementById('successDetails').innerHTML = `
        <div class="detail-item">
            <span>Credits Added:</span>
            <strong>${currentPackage.credits}</strong>
        </div>
        <div class="detail-item">
            <span>Total Credits:</span>
            <strong>${userCredits}</strong>
        </div>
        <div class="detail-item">
            <span>Package Expires:</span>
            <strong>${new Date(packageExpiry).toLocaleDateString()}</strong>
        </div>
        <div class="detail-item">
            <span>Purchase Status:</span>
            <strong class="active-package">Active</strong>
        </div>
    `;
    
    successModal.style.display = 'block';
    
    // Add reminder about purchase restrictions
    setTimeout(() => {
        toastr.info('Note: You can purchase a new package when your credits drop below 4 or your current package expires.');
    }, 2000);
}

// UI Helper Functions
function scrollToTools() {
    document.getElementById('tools').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

function scrollToPricing() {
    document.getElementById('pricing').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    
    // Highlight pricing section
    const pricingSection = document.getElementById('pricing');
    pricingSection.style.transition = 'box-shadow 0.5s ease';
    pricingSection.style.boxShadow = 'inset 0 0 0 3px #6366f1';
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
        pricingSection.style.boxShadow = 'none';
    }, 3000);
}

async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('API Health:', data);
            
            // Update online users count
            updateOnlineUsers();
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('API health check failed:', error);
        return false;
    }
}

function updateOnlineUsers() {
    // Simulate random online users
    const onlineUsersElement = document.getElementById('onlineUsers');
    if (onlineUsersElement) {
        const randomUsers = Math.floor(Math.random() * 500) + 1000;
        onlineUsersElement.textContent = randomUsers.toLocaleString();
    }
}

// Performance optimization for image processing
function optimizeImageProcessing(imageUrl, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate optimal size (max 1000px on longest side)
        const maxSize = 1000;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
        } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw optimized image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to data URL with reduced quality for faster processing
        const optimizedUrl = canvas.toDataURL('image/jpeg', 0.9);
        callback(optimizedUrl);
    };
    img.src = imageUrl;
}

// Initialize API health check on load
setTimeout(checkAPIHealth, 1000);

// Update online users periodically
setInterval(updateOnlineUsers, 30000);

// Add payment modal CSS styles
const paymentModalStyles = `
/* Payment Modal Styles */
.payment-modal .modal-content {
    max-width: 500px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.payment-content {
    padding: 2rem;
}

.package-summary {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 1.5rem;
    margin: 1.5rem 0;
}

.summary-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.summary-item:last-child {
    margin-bottom: 0;
    border-bottom: none;
}

.summary-item span {
    color: #94a3b8;
}

.summary-item strong {
    color: #ffffff;
    font-weight: 600;
}

.card-element-container {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}

.stripe-logo {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1rem;
    font-size: 2rem;
    color: #94a3b8;
}

.StripeElement {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.05);
}

#card-errors {
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    min-height: 1.5rem;
}

.payment-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
}

.payment-actions .btn {
    flex: 1;
}

.secure-note {
    text-align: center;
    color: #94a3b8;
    font-size: 0.875rem;
    margin-top: 1rem;
}

.secure-note i {
    margin-right: 0.5rem;
    color: #10b981;
}

/* Success Modal Styles */
.success-modal .modal-content {
    max-width: 400px;
    text-align: center;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.success-content {
    padding: 3rem 2rem;
}

.success-icon {
    font-size: 4rem;
    color: #10b981;
    margin-bottom: 1.5rem;
}

.success-details {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 1.5rem;
    margin: 1.5rem 0;
}

.detail-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-item:last-child {
    margin-bottom: 0;
    border-bottom: none;
}

.detail-item span {
    color: #94a3b8;
}

.detail-item strong {
    color: #ffffff;
    font-weight: 600;
}

.detail-item .active-package {
    color: #fde047 !important;
}

/* Spinner for payment button */
.spinner {
    display: inline-block;
    margin-left: 0.5rem;
}

.spinner.hidden {
    display: none;
}

.spinner .double-bounce1,
.spinner .double-bounce2 {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #ffffff;
    opacity: 0.6;
    position: absolute;
    top: 0;
    left: 0;
    animation: sk-bounce 2.0s infinite ease-in-out;
}

.spinner .double-bounce2 {
    animation-delay: -1.0s;
}

@keyframes sk-bounce {
    0%, 100% { 
        transform: scale(0.0);
    } 50% { 
        transform: scale(1.0);
    }
}

.credit-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
}

.credit-count {
    font-size: 1.1rem;
}

.credit-info small {
    font-size: 0.75rem;
    opacity: 0.9;
    font-weight: 400;
}

/* Package active indicator */
.package-active-indicator {
    display: block;
    font-size: 0.8rem;
    color: #f59e0b;
    margin-top: 0.5rem;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

/* Disabled pricing buttons */
.pricing-card .btn:disabled {
    position: relative;
}

.pricing-card .btn:disabled::after {
    content: '\\f023';
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    color: #f59e0b;
}
`;

// Add the styles to the document
const styleSheet = document.createElement("style");
styleSheet.textContent = paymentModalStyles;
document.head.appendChild(styleSheet);
