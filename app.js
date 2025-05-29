import * as dom from './domElements.js';
import { initializeTransactionModal } from './transactionModalController.js';
import { initializeImportExport } from './importExportController.js';
import { initializeSocketHandlers } from './socketController.js';
import { addNewTAccount, clearAllData, arrangeTAccounts } from './tAccountActions.js';
// Note: svgService.js, config.js, state.js, dragController.js, tAccountRenderer.js, transactionRenderer.js, transactionActions.js
// are used by the imported modules, so they don't need to be explicitly imported here unless app.js directly uses their exports.

// --- Session Navigation Setup ---
// This code assumes that 'sessionNameInput' and 'joinSessionBtn' elements
// exist in the HTML when this script runs.
// For this to work reliably, app.js should be loaded with `defer` or at the end of the body.

const sessionNameInput = document.getElementById('sessionNameInput');
const joinSessionBtn = document.getElementById('joinSessionBtn');
const copySessionLinkBtn = document.getElementById('copySessionLinkBtn');

function setupSessionControls() {
    // Setup for session input and join button
    if (sessionNameInput && joinSessionBtn) {
        // Pre-fill session input if session name is in URL, so user sees current session
        const urlParams = new URLSearchParams(window.location.search);
        const sessionNameFromUrl = urlParams.get('session');

        function navigateToSession() {
            const sessionName = sessionNameInput.value.trim();
            if (sessionName) {
                // Reload the page with the new session name in the query parameter.
                // socketService.js will pick this up on the next page load to connect to the correct session.
                window.location.href = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(sessionName)}`;
            } else {
                alert("Please enter a session name."); // Or a more subtle notification
            }
        }

        joinSessionBtn.addEventListener('click', navigateToSession);
        sessionNameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission if it were in a form
                navigateToSession();
            }
        });

        if (sessionNameFromUrl) {
            sessionNameInput.value = decodeURIComponent(sessionNameFromUrl);
        }
    } else {
        console.warn("Session input field ('sessionNameInput') or join button ('joinSessionBtn') not found in the DOM. Session navigation UI may not work correctly.");
    }

    // Setup for copy session link button
    if (copySessionLinkBtn) {
        copySessionLinkBtn.addEventListener('click', () => {
            const urlToCopy = window.location.href;
            navigator.clipboard.writeText(urlToCopy).then(() => {
                const originalText = copySessionLinkBtn.textContent;
                copySessionLinkBtn.textContent = 'Copied!';
                copySessionLinkBtn.disabled = true;
                setTimeout(() => {
                    copySessionLinkBtn.textContent = originalText;
                    copySessionLinkBtn.disabled = false;
                }, 2000); // Revert after 2 seconds
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                alert('Failed to copy link. Your browser might not support this feature or permissions may be denied. Please copy the link manually from the address bar.');
            });
        });
    } else {
        console.warn("Copy Session Link button ('copySessionLinkBtn') not found. This feature will be unavailable.");
    }
}

setupSessionControls(); // Initialize session controls

// --- Initialize Application ---

// Initialize Socket.IO event handlers
// socketService.js handles connecting with the session ID from the URL
initializeSocketHandlers();

// Initialize UI components that require JavaScript interaction
initializeTransactionModal();
initializeImportExport();

// --- Attach Main UI Event Listeners ---
// These rely on domElements.js. Adding checks for robustness.
if (dom.addAccountBtnEl) {
    dom.addAccountBtnEl.addEventListener('click', addNewTAccount);
} else {
    console.warn("Add Account Button (addAccountBtnEl) not found.");
}

if (dom.clearAllBtnEl) {
    dom.clearAllBtnEl.addEventListener('click', clearAllData);
} else {
    console.warn("Clear All Button (clearAllBtnEl) not found.");
}

if (dom.arrangeAccountsBtnEl) {
    dom.arrangeAccountsBtnEl.addEventListener('click', arrangeTAccounts);
} else {
    console.warn("Arrange Accounts Button (arrangeAccountsBtnEl) not found.");
}

console.log("T-Collab application initialized.");