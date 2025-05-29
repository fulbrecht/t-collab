import * as dom from './domElements.js';
import { initializeTransactionModal } from './transactionModalController.js';
import { initializeImportExport } from './importExportController.js';
// Import the socket instance along with the initializer function
import { initializeSocketHandlers} from './socketController.js';
import { initializeSessionControls } from './sessionControlsController.js';
import { addNewTAccount, clearAllData, arrangeTAccounts } from './tAccountActions.js';
// Note: svgService.js, config.js, state.js, dragController.js, tAccountRenderer.js, transactionRenderer.js, transactionActions.js
// are used by the imported modules, so they don't need to be explicitly imported here unless app.js directly uses their exports.

// --- Initialize Application ---

// Initialize Socket.IO connection and handlers first
// This ensures the 'socket' instance is created before being used for .on()
initializeSocketHandlers();

// Initialize session-related UI controls (input, buttons, title)
initializeSessionControls();


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