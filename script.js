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
let enhancementLevel = 2;
let currentProcessing = {
    bgRemove: { before: null, after: null },
    enhance: { before: null, after: null }
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
const closeModalBtn = document.querySelector('.close-modal');
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

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize event listeners first
    initEventListeners();
    
    // Initialize hero slider
    initHeroSlider();
    
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
});

// Initialize Event Listeners
function initEventListeners() {
    // Modal
    closeModalBtn.addEventListener('click', () => {
        loginModal.style.display = 'none';
        modalLoading.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
            modalLoading.classList.remove('active');
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

    // Drop zone functionality
    ['bgRemoveUpload', 'enhanceUpload'].forEach(id => {
        const dropZone = document.getElementById(id);
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#6366f1';
            dropZone.style.background = 'rgba(99, 102, 241, 0.1)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            dropZone.style.background = 'rgba(15, 23, 42, 0.5)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            dropZone.style.background = 'rgba(15, 23, 42, 0.5)';
            
            const file = e.dataTransfer.files[0];
            if (file && isImageFile(file)) {
                const toolType = id === 'bgRemoveUpload' ? 'bgRemove' : 'enhance';
                processFile(file, toolType);
            } else {
                toastr.error('Please upload a valid image file');
            }
        });

        dropZone.addEventListener('click', () => {
            const inputId = id === 'bgRemoveUpload' ? 'bgRemoveInput' : 'enhanceInput';
            document.getElementById(inputId).click();
        });
    });

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

// Initialize Hero Slider
function initHeroSlider() {
    const sliderHandle = document.querySelector('.hero .slider-handle');
    const afterOverlay = document.querySelector('.hero .after-overlay');
    const beforeAfterDemo = document.getElementById('heroDemo');
    
    if (!sliderHandle || !afterOverlay) return;
    
    let isDragging = false;
    let startX = 0;
    let sliderLeft = 50; // Start at 50%
    
    // Set initial position
    updateSliderPosition(sliderLeft);
    
    // Mouse events
    sliderHandle.addEventListener('mousedown', startDrag);
    beforeAfterDemo.addEventListener('mousedown', startDragFromArea);
    
    // Touch events for mobile
    sliderHandle.addEventListener('touchstart', startDragTouch);
    beforeAfterDemo.addEventListener('touchstart', startDragFromAreaTouch);
    
    function startDrag(e) {
        isDragging = true;
        startX = e.clientX;
        sliderHandle.style.cursor = 'grabbing';
        
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }
    
    function startDragFromArea(e) {
        if (e.target === sliderHandle) return;
        
        const rect = beforeAfterDemo.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        sliderLeft = Math.max(0, Math.min(100, percentage));
        updateSliderPosition(sliderLeft);
    }
    
    function startDragTouch(e) {
        if (e.touches.length !== 1) return;
        
        isDragging = true;
        startX = e.touches[0].clientX;
        
        document.addEventListener('touchmove', onDragTouch);
        document.addEventListener('touchend', stopDrag);
        e.preventDefault();
    }
    
    function startDragFromAreaTouch(e) {
        if (e.touches.length !== 1) return;
        
        const rect = beforeAfterDemo.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        sliderLeft = Math.max(0, Math.min(100, percentage));
        updateSliderPosition(sliderLeft);
        e.preventDefault();
    }
    
    function onDrag(e) {
        if (!isDragging) return;
        
        const rect = beforeAfterDemo.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        sliderLeft = Math.max(0, Math.min(100, percentage));
        updateSliderPosition(sliderLeft);
    }
    
    function onDragTouch(e) {
        if (!isDragging || e.touches.length !== 1) return;
        
        const rect = beforeAfterDemo.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        
        sliderLeft = Math.max(0, Math.min(100, percentage));
        updateSliderPosition(sliderLeft);
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
        afterOverlay.style.width = `${100 - percentage}%`;
        sliderHandle.style.left = `${percentage}%`;
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
    
    // Check if user exists in database
    const userRef = database.ref('users/' + user.uid);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
        // New user - create record with 3 free credits
        await userRef.set({
            email: user.email,
            name: user.displayName,
            credits: 3,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        });
        userCredits = 3;
        toastr.info('Welcome! You have 3 free credits to start.');
    } else {
        // Existing user - update last login and get credits
        const userData = snapshot.val();
        userCredits = userData.credits || 0;
        await userRef.update({
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    // Update credits display
    updateCreditsDisplay();
}

function handleUserSignOut() {
    currentUser = null;
    userData = null;
    userCredits = 0;
    
    // Update UI
    userGreeting.style.display = 'none';
    authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    userDropdown.classList.remove('show');
    
    // Reset credit display
    document.querySelectorAll('.credit-display').forEach(el => el.remove());
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
    
    // Check credits and show custom notification if 0 credits
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
}

// Show warning when credits are low
function showLowCreditWarning() {
    toastr.warning('Only 1 credit remaining! Consider upgrading your plan.', 'Low Credits', {
        timeOut: 6000,
        extendedTimeOut: 2000
    });
}

function updateCreditsDisplay() {
    // Remove existing credit displays
    document.querySelectorAll('.credit-display').forEach(el => el.remove());
    
    if (currentUser) {
        const creditElement = document.createElement('div');
        creditElement.className = 'credit-display';
        
        // Change color based on credit count
        let creditColor = '#10b981'; // Green for 3+ credits
        let icon = 'fas fa-coins';
        
        if (userCredits === 0) {
            creditColor = '#ef4444'; // Red for 0 credits
            icon = 'fas fa-exclamation-circle';
        } else if (userCredits <= 2) {
            creditColor = '#f59e0b'; // Orange/Yellow for low credits
            icon = 'fas fa-exclamation-triangle';
        }
        
        creditElement.innerHTML = `
            <i class="${icon}"></i>
            <span>${userCredits} Credits</span>
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
        `;
        
        // Add hover effect
        creditElement.addEventListener('mouseenter', () => {
            creditElement.style.transform = 'scale(1.05)';
            creditElement.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.4)';
        });
        
        creditElement.addEventListener('mouseleave', () => {
            creditElement.style.transform = 'scale(1)';
            creditElement.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
        });
        
        // Click to go to pricing
        creditElement.addEventListener('click', () => {
            if (userCredits === 0) {
                showNoCreditsNotification('general');
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
        toastr.warning('Please sign in to select a plan');
        return;
    }
    
    const plans = {
        free: { name: 'Free', price: 0, credits: 3 },
        pro: { name: 'Pro', price: 19, credits: 100 },
        business: { name: 'Business', price: 49, credits: 'unlimited' }
    };
    
    const selectedPlan = plans[plan];
    
    if (plan === 'free') {
        toastr.info('You are already on the Free plan');
        return;
    }
    
    // Simulate payment processing
    setTimeout(() => {
        toastr.success(`Thank you for choosing ${selectedPlan.name} plan!`);
        
        // Record pricing history
        recordPricingHistory(plan, selectedPlan.price);
        
        // Update credits for Pro plan
        if (plan === 'pro') {
            userCredits = 100;
            updateCreditsDisplay();
            database.ref('users/' + currentUser.uid).update({
                credits: 100
            });
        } else if (plan === 'business') {
            userCredits = 9999; // Unlimited
            updateCreditsDisplay();
            database.ref('users/' + currentUser.uid).update({
                credits: 9999
            });
        }
    }, 1000);
}


async function recordPricingHistory(plan, price) {
    if (!currentUser) return;
    
    await database.ref('pricingHistory/' + currentUser.uid).push({
        plan: plan,
        price: price,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
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
